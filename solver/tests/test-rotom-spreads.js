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
const tourAt = (t, i) => !!(t.spreads && t.spreads[i] && /^observed:tournament:/.test(t.spreads[i].source || ''));
/* ROLE (1.72.0): a Choice Scarf set and a Trick Room set are held to the top / bottom of their Speed whether the spread
 * is derived or from the Smogon chain (the hook takes only a spread that fits: spreads.js observedSpread); a Tailwind set
 * only when derived (players run Tailwind setters below the cap, and the observed spread is theirs); a published
 * tournament spread is the player's own and is never judged. */
function checkRole(name, rot, tally) {
  const bad = [];
  for (const t of rot.teams) for (const [i, s] of Teams.unpack(t.packed).entries()) {
    if (tourAt(t, i)) continue;
    const r = SP.role(s);
    if (r.role !== 'fast' && r.role !== 'trickroom') continue;
    if (r.role === 'fast' && X.toID(s.item) !== 'choicescarf' && observedAt(t, i)) continue;
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
    if (tally) tally.derived_other++;
    if (s.evs.spe !== want) bad.push(name + ' ' + t.id + ' ' + s.species + ' runs Speed SP ' + s.evs.spe + ' (speed ' + eff[s.evs.spe] + '); the rule gives ' + want + ' (speed ' + eff[want] + ', cap ' + eff[SP.SP_CAP] + ', top tier ' + eq.top_speed + ')');
    if (top && s.evs.spe !== SP.SP_CAP) bad.push(name + ' ' + t.id + ' ' + s.species + ' reaches the top tier (' + eff[SP.SP_CAP] + ' >= ' + eq.top_speed + ') but runs Speed SP ' + s.evs.spe);
  }
  /* THE RULE ITSELF over every `other` set of the rotation, whatever its spread's source (1.72.0: the Smogon chain now
   * serves most rotation sets, and the rule still decides the fallback and the arena's role-v1 table): a set whose cap
   * speed reaches the top tier gets the cap from speedFor. SPREADS_BREAK=median must turn this red. */
  for (const t of rot.teams) for (const s of Teams.unpack(t.packed)) {
    if (SP.role(s).role !== 'other') continue;
    const eff = _spe.speeds(s), top = eff[SP.SP_CAP] >= eq.top_speed;
    if (tally) { tally.other++; if (top) tally.top++; }
    if (top && _spe.speedFor(s, eq.median_speed) !== SP.SP_CAP) bad.push(name + ' ' + t.id + ' ' + s.species + ' reaches the top tier (' + eff[SP.SP_CAP] + ' >= ' + eq.top_speed + ') but the rule gives Speed SP ' + _spe.speedFor(s, eq.median_speed));
  }
  return bad;
}
/* OBSERVED (1.72.0): every set whose recorded source is a Smogon moveset file plays EXACTLY the spread that file lists for
 * it — read here by an independent scan of the named file (the block titled with the set's battle forme; the
 * highest-share "Nature:hp/.../spe" line with the sheet nature that fits the set's Choice Scarf / Trick Room Speed, and
 * whose weighted count Raw count x Avg. weight x share clears spreads.js OBS_MIN_WEIGHT) — and no EARLIER file of the
 * recorded chain serves it (the fallback went down in order). */
const FILES = new Map();
function scan(file) {
  if (FILES.has(file)) return FILES.get(file);
  const by = {}; let cur = null, sec = null, prevSep = false;
  for (const raw of fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/)) {
    const sep = /^\+-+\+$/.test(raw.trim());
    const l = raw.replace(/^\s*\|\s?/, '').replace(/\s*\|\s*$/, '').trim();
    if (sep) { prevSep = true; sec = null; continue; }
    const afterSep = prevSep; prevSep = false;
    let m;
    if (/^(Abilities|Items|Spreads|Moves|Teammates|Checks and Counters)$/.test(l)) { sec = l; continue; }
    if (afterSep && sec === null && l && !/^(Raw count|Avg\. weight|Viability)/.test(l)) { cur = X.toID(l); by[cur] = { raw: null, w: null, spreads: [] }; continue; }
    if (!cur) continue;
    if ((m = /^Raw count:\s*(\d+)/.exec(l))) { by[cur].raw = +m[1]; continue; }
    if ((m = /^Avg\. weight:\s*([\d.eE+-]+)/.exec(l))) { by[cur].w = +m[1]; continue; }
    if (sec === 'Spreads' && (m = /^(\w+):([\d/]+)\s+([\d.]+)%$/.exec(l))) by[cur].spreads.push({ nature: m[1], evs: m[2], pct: +m[3] });
  }
  FILES.set(file, by); return by;
}
function fileServes(file, s) {
  const b = scan(file)[X.toID(SP.forme(s).species)];
  if (!b) return null;
  const r = SP.role(s), scarf = X.toID(s.item) === 'choicescarf' && r.role === 'fast';
  const fit = e => { const v = e.split('/').map(Number); return v.every(x => x <= SP.SP_CAP) && v.reduce((a, x) => a + x, 0) <= SP.SP_TOTAL && (scarf ? v[5] === SP.SP_CAP : r.role === 'trickroom' ? v[5] === 0 : true); };
  const hit = b.spreads.filter(x => X.toID(x.nature) === X.toID(s.nature) && fit(x.evs)).sort((a, c) => c.pct - a.pct)[0];
  if (!hit) return null;
  if (b.raw != null && b.w != null && b.raw * b.w * hit.pct / 100 < SP.OBS_MIN_WEIGHT) return null;
  return hit.evs;
}
function checkObserved(name, rot, tally) {
  const bad = [];
  const chain = ((rot.spread_source && rot.spread_source.observed && rot.spread_source.observed.files) || []).map(f => f.file);
  for (const t of rot.teams) for (const [i, s] of Teams.unpack(t.packed).entries()) {
    const z = t.spreads[i], m = /^observed:(data\/smogon-stats\/\S+\.txt)/.exec(z.source || '');
    if (!m) continue;
    if (tally) tally.observed++;
    const plays = STATS.map(k => s.evs[k] || 0).join('/');
    const want = fileServes(m[1], s);
    if (want !== plays) bad.push(name + ' ' + t.id + ' ' + s.species + ' plays ' + plays + ' from ' + m[1] + ', which lists ' + want);
    const k = chain.indexOf(m[1]);
    if (k < 0) bad.push(name + ' ' + t.id + ' ' + s.species + ' names ' + m[1] + ', not in the recorded chain');
    for (let j = 0; j < k; j++) if (fileServes(chain[j], s)) { bad.push(name + ' ' + t.id + ' ' + s.species + ' skipped ' + chain[j] + ', which serves it'); break; }
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
  scarf: r => { for (const t of r.teams) { const sets = Teams.unpack(t.packed); const i = sets.findIndex((s, k) => X.toID(s.item) === 'choicescarf' && SP.role(s).role === 'fast' && !tourAt(t, k)); if (i >= 0) { const s = sets[i]; s.evs.spe -= 1; s.evs.hp < SP.SP_CAP ? s.evs.hp++ : s.evs.def++; t.packed = Teams.pack(sets); if (t.spreads) t.spreads[i].evs = Object.assign({}, s.evs); return r; } } return r; },
  /* the first Smogon-observed set plays a spread one SP off the file's (packed and recorded kept consistent) */
  observed: r => { for (const t of r.teams) { const sets = Teams.unpack(t.packed); const i = sets.findIndex((s, k) => t.spreads && /^observed:data\//.test(t.spreads[k].source || '')); if (i >= 0) { const s = sets[i]; const a = STATS.find(k => s.evs[k] > 0 && k !== 'spe'), b = STATS.find(k => s.evs[k] < SP.SP_CAP && k !== a && k !== 'spe'); s.evs[a]--; s.evs[b]++; t.packed = Teams.pack(sets); t.spreads[i].evs = Object.assign({}, s.evs); return r; } } return r; },
  trickroom: r => editFirst(r, 'trickroom', s => { const k = STATS.filter(x => x !== 'spe').sort((a, b) => s.evs[b] - s.evs[a])[0]; s.evs[k]--; s.evs.spe++; }),
  record: r => { if (!r.teams[0].spreads) return r; const z = r.teams[0].spreads[0]; const k = z.evs.hp > 0 ? 'hp' : 'atk'; z.evs = Object.assign({}, z.evs, { [k]: z.evs[k] + (z.evs[k] > 0 ? -1 : 1) }); return r; },
  /* the first DERIVED `other` set with Speed SP drops to 0 (the 1.35.0 answer for Sneasler / Gengar-Mega), SP moved to HP /
   * Def. (Until 1.72.0 it took a top-tier set; the Smogon chain now serves every top-tier rotation set.) */
  tier: r => {
    const eq = r.spread_source && r.spread_source.speed_equilibrium; if (!eq) return r;
    for (const t of r.teams) { const sets = Teams.unpack(t.packed); const i = sets.findIndex((s, k) => !observedAt(t, k) && SP.role(s).role === 'other' && s.evs.spe > 0);
      if (i >= 0) { const s = sets[i]; let n = s.evs.spe; s.evs.spe = 0; for (const k of ['hp', 'def', 'spd', 'atk', 'spa']) { const add = Math.min(n, SP.SP_CAP - s.evs[k]); s.evs[k] += add; n -= add; } t.packed = Teams.pack(sets); if (t.spreads) t.spreads[i].evs = Object.assign({}, s.evs); return r; } }
    return r;
  },
};
if (BREAK && !BREAKS[BREAK]) { console.error('unknown --break ' + BREAK + ' (scarf | trickroom | record | tier | observed)'); process.exit(2); }

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
const tally = { fast: 0, tr: 0, other: 0, top: 0, derived_other: 0, observed: 0 };
for (const [f, rot] of ROTS) {
  const subj = BREAK ? BREAKS[BREAK](clone(rot)) : rot;
  const b1 = checkRole(f, subj, tally);
  ok('ROLE', !b1.length, b1.join(' | '));
  const b2 = checkRecord(f, subj);
  ok('RECORD', !b2.length, b2.join(' | '));
  const b3 = checkTier(f, subj, tally);
  ok('TIER', !b3.length, b3.join(' | '));
  const b4 = checkObserved(f, subj, tally);
  ok('OBSERVED', !b4.length, b4.join(' | '));
}
ok('ROLE', tally.fast >= 1 && tally.tr >= 1, 'the rotations hold ' + tally.fast + ' fast-role and ' + tally.tr + ' Trick Room sets (need >= 1 of each, or ROLE asks nothing)');
ok('TIER', tally.top >= 1 && tally.other > tally.top, 'the rotations hold ' + tally.top + ' top-tier and ' + (tally.other - tally.top) + ' other `other` sets (need >= 1 of each, or TIER asks nothing)');
console.log('  TIER    ' + tally.other + ' `other` sets checked, ' + tally.top + ' of them in the top speed tier; ' + tally.derived_other + ' derived `other` sets checked against speedFor');
ok('OBSERVED', SP.findObserved() === null || tally.observed >= 1, 'a Reg M-C moveset file exists and no rotation set plays from it (' + tally.observed + ')');
console.log('  OBSERVED ' + tally.observed + ' rotation sets play a Smogon spread, each matched against its file and the chain above it');

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
  /* THE CHAIN (1.72.0): two synthetic levels. Level 0 lists Jolly Garchomp at a weighted count under OBS_MIN_WEIGHT
   * (Raw 100 x Avg. weight 1 x 20% = 20) and must be passed over for level 1; a Choice Scarf set takes only a spread
   * with Speed at the cap (level 0's 45% Adamant runs 30); a mega stone keys the mega forme's block. */
  const blk = (name, raw, w, lines) => [sep, ' | ' + name + ' | ', sep, ' | Raw count: ' + raw + ' | ', ' | Avg. weight: ' + w + ' | ', sep, ' | Spreads | ', ...lines.map(l => ' | ' + l + ' | '), sep].join('\n');
  const L0 = SP.parseMovesetFull(blk('Garchomp', 100, 1, ['Adamant:4/32/0/0/0/30 45.000%', 'Adamant:2/32/0/0/0/32 30.000%', 'Jolly:2/32/0/0/0/32 20.000%']) + '\n' + blk('Salamence-Mega', 1000, 1, ['Timid:2/0/0/32/0/32 50.000%']) + '\n' + blk('Salamence', 1000, 1, ['Timid:32/0/0/0/2/32 50.000%']));
  const L1 = SP.parseMovesetFull(blk('Garchomp', 1000, 1, ['Jolly:0/32/2/0/0/32 25.000%']));
  const lv = (full, file) => { const by = {}; for (const [k, e] of Object.entries(full)) by[k] = e.spreads; return { file, bySpecies: by, full }; };
  const CH = { chain: [lv(L0, 'L0'), lv(L1, 'L1')] };
  const j = SP.observedSpread({ species: 'Garchomp', item: 'Life Orb', nature: 'Jolly', moves: ['Protect'] }, CH);
  ok('HOOK', j && j.file === 'L1' && SP.evStr(j.evs) === '0/32/2/0/0/32', 'a level whose spread is under the weight floor is passed over for the next: ' + JSON.stringify(j));
  const a = SP.observedSpread({ species: 'Garchomp', item: 'Life Orb', nature: 'Adamant', moves: ['Protect'] }, CH);
  ok('HOOK', a && a.file === 'L0' && SP.evStr(a.evs) === '4/32/0/0/0/30', 'the highest-share nature-matched spread at the first level that serves: ' + JSON.stringify(a));
  const sc = SP.observedSpread({ species: 'Garchomp', item: 'Choice Scarf', nature: 'Adamant', moves: ['Protect'] }, CH);
  ok('HOOK', sc && SP.evStr(sc.evs) === '2/32/0/0/0/32', 'a Choice Scarf set takes only a spread with Speed at the cap (env SPREADS_BREAK=itemblind must turn this red): ' + JSON.stringify(sc));
  const mg = SP.observedSpread({ species: 'Salamence', item: 'Salamencite', nature: 'Timid', moves: ['Protect'] }, CH);
  ok('HOOK', mg && SP.evStr(mg.evs) === '2/0/0/32/0/32', 'a mega stone keys the mega forme\'s block, not the base species\': ' + JSON.stringify(mg));
  ok('HOOK', SP.observedSpread({ species: 'Garchomp', item: 'Life Orb', nature: 'Timid', moves: ['Protect'] }, CH) === null, 'no level serves the nature -> null (derive)');
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
    const { D } = B.spreadDeriver(B.readStore(sf), { tournament: null, observed: null });
    ok('REPRODUCE', D.eq.median_speed === ss.speed_equilibrium.median_speed, 'the speed benchmark re-derives: ' + D.eq.median_speed + ' vs ' + ss.speed_equilibrium.median_speed);
    const pick = [];
    for (const want of ['fast', 'trickroom', 'other']) for (const t of rot.teams) { const i = t.spreads.findIndex(z => z.role === want && z.source === 'derived'); if (i >= 0) { pick.push(t.spreads[i]); break; } }
    for (const z of pick) {
      const re = D.spreadFor(z);
      ok('REPRODUCE', SP.evStr(re.evs) === SP.evStr(z.evs), f + ' ' + z.species + ' (' + z.role + ') re-derives ' + SP.evStr(re.evs) + ', recorded ' + SP.evStr(z.evs));
    }
  }
}

/* ---------------- CONTROL ---------------- */
if (!BREAK) for (const [k, fn] of Object.entries(BREAKS)) {
  let seen = false;
  for (const [f, rot] of ROTS) { const b = clone(rot); fn(b); if ((k === 'record' ? checkRecord(f, b) : k === 'tier' ? checkTier(f, b) : k === 'observed' ? checkObserved(f, b) : checkRole(f, b)).length) seen = true; }
  ok('CONTROL', seen, 'the ' + k + ' break is refused');
}

console.log((fails ? 'RED' : 'GREEN') + ' ' + (checks - fails) + '/' + checks + (notChecked ? '  (' + notChecked + ' NOT CHECKED, named above)' : '') + (BREAK ? '  (deliberate break: ' + BREAK + ')' : ''));
process.exit(fails ? 1 : 0);
