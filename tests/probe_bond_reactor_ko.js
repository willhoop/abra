#!/usr/bin/env node
/* tests/probe_bond_reactor_ko.js — A PARENTAL BOND CLICK WHOSE FIRST HIT KILLS: HOW MANY TIMES IS THE
 * `onDamagingHit` REACTOR SET OFF?
 *   SHOWDOWN_PATH=... node tests/probe_bond_reactor_ko.js          (live tree, scratch store)
 * The parent plays clean, then re-runs itself under MEDI_BOND_REACT_DRAWN=1, which must part the KO-on-
 * hit-1 arms and hold every control.
 * ==================================================================================================
 *
 * THE AUTHORITY, READ RATHER THAN RECALLED.
 *   Parental Bond: `onPrepareHit` writes `move.multihit = 2; move.multihitType = 'parentalbond'`
 *   (data/abilities.ts:3160-3166, no Champions override).
 *   The Champions hit loop (`data/mods/champions/scripts.ts:461-464`, the override, not mainline):
 *       for (hit = 1; hit <= targetHits; hit++) {
 *         if (damage.includes(false)) break;
 *         if (hit > 1 && pokemon.status === 'slp' && ...) break;
 *         if (targets.every(target => !target?.hp)) break;
 *   so a second arrival is never OPENED against a body the first one killed, and `runEvent('DamagingHit')`
 *   is raised inside `spreadMoveHit`, once per arrival that landed. Rough Skin
 *   (data/abilities.ts:3928-3934) is `onDamagingHit` + `checkMoveMakesContact` -> `damage(baseMaxhp/8)`,
 *   so it is paid ONCE on that click. `-hitcount` is suppressed for a Parental Bond click that landed one
 *   hit (scripts.ts:548-549), so the fixture is read off the `-damage` lines, not the count line.
 *
 * WHAT THIS ENGINE DID. `_react` answered "2" for every Parental Bond click (`bondMultFor(...) != null`)
 * — the landed-count guard `tests/probe_volley_reactor_count.js` installed for the `multiHit` family was
 * never reached by the Parental Bond road.
 *
 * THE ARMS (each a real two-engine game, `--state`, every turn played: the board is compared per turn
 * from the streams rather than by stopping at the first divergence):
 *   ROUGH-SKIN  Kangaskhan-Mega clicks a contact move into Rough Skin Garchomp each turn until it faints.
 *               Turns BEFORE the KO are the SURVIVOR CONTROL — two arrivals, two tolls on both engines.
 *               The move is SEARCHED over the derived contact pool and selected on the AUTHORITY's log
 *               alone so that the KO turn lands exactly one arrival.
 *   GOOEY       the same class through a different reactor (a Speed drop on the ATTACKER), same search.
 *   NON-CONTACT the same carrier with a derived non-contact move into Rough Skin: no toll on either
 *               engine, and the body still dies.
 * Nothing is typed as an expected value: the verdict per turn is whether the two streams carry the same
 * number of reactor lines, and the attacker's HP after the turn.
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent. This is not a pass.'); process.exit(2); }
const IS_CHILD = process.argv.includes('--child');
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const SEEN = M.MEDSEEN;
const STAMPED = () => Object.prototype.hasOwnProperty.call(M.MEDFAILS, 'bondReactDrawnRestored');
const KNOB = process.env.MEDI_BOND_REACT_DRAWN === '1';
const NL = String.fromCharCode(10);
const TAGS = require(D('data', 'tags.json'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- THE CARRIER: the format's one legal `hitsTwice` holder ---------------------------------------- */
const HT = Object.keys(TAGS.abilities || {}).filter(a => (TAGS.abilities[a].tags || []).includes('hitsTwice'));
const MEGA = dex.species.all().filter(legal).filter(s => s.isMega && Object.values(s.abilities).some(a => HT.includes(idOf(a))));
if (MEGA.length !== 1) { console.log('NOT RUN — expected exactly one legal hitsTwice carrier, found ' + MEGA.length); process.exit(2); }
const MSP = MEGA[0], BASE = dex.species.get(MSP.changesFrom || MSP.baseSpecies);
const STONE = [].concat(MSP.requiredItem || [], MSP.requiredItems || [])[0];
console.log('  carrier ' + BASE.name + ' + ' + STONE + ' -> ' + MSP.name);

const pool = contact => Object.keys((dex.species.getLearnsetData(BASE.id) || {}).learnset || {}).map(id => dex.moves.get(id))
  .filter(m => legal(m) && m.category !== 'Status' && m.target === 'normal' && !m.multihit && !m.flags.charge
    && !m.flags.noparentalbond && !m.flags.futuremove && (m.accuracy === true || m.accuracy === 100) && !m.recoil && !m.drain
    && !m.self && !m.selfSwitch && m.priority === 0 && !(m.secondaries || []).length && !!m.flags.contact === contact
    && !m.damageCallback && !m.onTry && !m.onTryHit && !m.overrideOffensiveStat && (m.critRatio || 1) <= 1 && m.basePower > 0
    && !m.basePowerCallback && CS.canLearn(BASE.name, m.id))
  .sort((a, b) => b.basePower - a.basePower || a.id.localeCompare(b.id));
const CONTACT = pool(true), NONCONTACT = pool(false);
console.log('  contact pool ' + CONTACT.map(m => m.id).join(',') + '   non-contact pool ' + NONCONTACT.map(m => m.id).join(','));

/* ---- THE REACTORS: `punishesAttacker` on contact, carried by a legal body ---------------------------- */
const IDLES = ['Swords Dance', 'Calm Mind', 'Coil', 'Bulk Up', 'Agility', 'Nasty Plot', 'Work Up', 'Howl', 'Iron Defense', 'Acid Armor'];
const reactorBody = (ab, frail) => {
  const c = dex.species.all().filter(legal).filter(s => !s.isMega && !s.battleOnly && !s.requiredItem
    && Object.values(s.abilities).some(a => idOf(a) === ab))
    .sort((x, y) => (frail ? -1 : 1) * ((y.baseStats.hp * y.baseStats.def) - (x.baseStats.hp * x.baseStats.def)));   // bulkiest: room for survivor turns
  for (const s of c) { const idle = IDLES.find(m => CS.canLearn(s.name, m)); if (idle) return { sp: s, idle }; }
  return null;
};
const punisher = ab => { const p = ((TAGS.abilities[ab] || {}).params || {}).punishesAttacker; return p && p.trigger === 'contact' && !p.onFaintOnly; };
const REACT = ['roughskin', 'gooey'].filter(punisher);
console.log('  reactors (punishesAttacker, contact, not faint-only): ' + REACT.join(', '));
if (REACT.length !== 2) { console.log('NOT RUN — the reactor rows changed in data/tags.json'); process.exit(2); }

const ATK_PARTNER = { species: 'clefable', item: '', ability: 'Unaware', moves: ['Calm Mind'] };
const DEF_PARTNER = { species: 'milotic', item: '', ability: 'Marvel Scale', moves: ['Coil'] };
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));

function unsplit(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const l = String(log[i]);
    if (/^\|split\|/.test(l)) { if (log[i + 1] !== undefined) out.push(String(log[i + 1])); i += 2; continue; }
    out.push(l);
  }
  return out;
}
/* ONE TURN on either stream: arrivals onto the target (p2a), reactor lines (a `[from] ability:` HP line or
 * an attacker unboost), the attacker's HP after the turn, and whether the target fainted. */
function turns(lines, abName) {
  const out = []; let cur = null;
  const abRe = new RegExp('\\[from\\] ability: *' + abName.replace(/\s/g, ' ?'), 'i');
  for (const raw of lines.map(String)) {
    if (/^\|turn\|/.test(raw)) { cur = { n: +raw.split('|')[2], hits: 0, tolls: 0, atkUnboost: 0, atkHP: null, faint: false }; out.push(cur); continue; }
    if (!cur) continue;
    const f = raw.split('|');
    if (f[1] === '-damage' && /^p2a/.test(f[2]) && !/\[from\]/.test(raw)) cur.hits++;
    if (f[1] === '-damage' && /^p1a/.test(f[2])) { cur.atkHP = f[3]; if (abRe.test(raw)) cur.tolls++; }
    if (f[1] === '-unboost' && /^p1a/.test(f[2])) cur.atkUnboost += +f[4] || 1;
    if (f[1] === 'faint' && /^p2a/.test(f[2])) cur.faint = true;
  }
  return out;
}

function playArm(ab, body, mv, nTurns) {
  const A = [{ species: BASE.id, item: STONE, ability: Object.values(BASE.abilities)[0], moves: [mv.name] }, ATK_PARTNER].concat(BENCH('corviknight', 'toxapex'));
  const B = [{ species: body.sp.name, item: '', ability: dex.abilities.get(ab).name, moves: [body.idle] }, DEF_PARTNER].concat(BENCH('toxapex', 'corviknight'));
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { err: 'NOT-STAGED (buildPair returned null)' };
  const script = [];
  for (let i = 0; i < nTurns; i++) script.push({ p1: [{ m: mv.id, t: 0, mega: i === 0 }, { m: 'calmmind' }], p2: [{ m: idOf(body.idle) }, { m: 'coil' }] });
  const r0 = SEEN.parentalBondReactedTwice | 0, k0 = SEEN.bondReactStoppedAtKO | 0;
  const r = G.playGame(a, b, 'directed', 'probe_bond_reactor_ko :: ' + ab + ' ' + mv.id + ' x' + nTurns,
    { script, onBoundary: snap => { snap.identical = true; snap.diffs = []; } });
  if (r.err) return { err: String(r.err) };
  const name = dex.abilities.get(ab).name;
  return { sd: turns(unsplit((G.lastSdLog ? G.lastSdLog() : []).map(String)), name), me: turns((r.mediTrace || []).map(String), name),
           twice: (SEEN.parentalBondReactedTwice | 0) - r0, stopped: (SEEN.bondReactStoppedAtKO | 0) - k0 };
}
/* Play 1..4 turns until the AUTHORITY's target faints; return that game. */
function untilKO(ab, body, mv) {
  for (let n = 1; n <= 4; n++) {
    const g = playArm(ab, body, mv, n);
    if (g.err) return g;
    const k = g.sd.findIndex(t => t.faint);
    if (k >= 0) return Object.assign(g, { koIdx: k, nTurns: n });
  }
  return { err: 'the authority never fainted the target in 4 turns' };
}

console.log(NL + (KNOB ? 'KNOB ARM — MEDI_BOND_REACT_DRAWN=1' : 'CLEAN ARM') + '   release ' + (REL && REL.id) + NL);
const results = [];
for (const ab of REACT) {
  const body = reactorBody(ab);
  if (!body) { claim(false, ab + ' — a legal carrier with an idle move', 'NOT-STAGED (a claim about the fixture)'); continue; }
  let chosen = null;
  const tried = [];
  for (const mv of CONTACT) {
    const g = untilKO(ab, body, mv);
    tried.push(mv.id + ':' + (g.err ? 'err' : g.sd[g.koIdx].hits + '-hit KO'));
    /* A move whose KO turn lands BOTH arrivals is the other control: the guard must not fire on it. */
    if (!g.err && g.sd[g.koIdx].hits === 2 && !results.some(r => r.kind === 'control2'))
      results.push({ arm: ab + '/' + mv.id + ' (KO on arrival 2)', kind: 'control2', ab, g });
    if (!g.err && g.sd[g.koIdx].hits === 1) { chosen = { mv, g }; break; }
  }
  console.log('  ' + ab + ' on ' + body.sp.name + ' — search (move: authority KO shape) ' + tried.join('  '));
  if (!chosen) { claim(false, ab + ' — FIXTURE: some contact move KOs on the first arrival', tried.join(' ')); continue; }
  results.push({ arm: ab + '/' + chosen.mv.id, kind: 'red', ab, g: chosen.g });
}
{
  const body = reactorBody('roughskin', true);   // the FRAILEST carrier: a non-contact move must still finish it
  const mv = NONCONTACT[0];
  if (!mv) claim(false, 'NON-CONTACT — a derived non-contact move', 'none in the pool');
  else {
    const g = untilKO('roughskin', body, mv);
    if (g.err) claim(false, 'NON-CONTACT staged', g.err); else results.push({ arm: 'roughskin/' + mv.id + ' (non-contact)', kind: 'control', ab: 'roughskin', g });
  }
}

const summary = [];
for (const x of results) {
  const g = x.g;
  console.log(NL + x.arm + '   [' + x.kind + ']   parentalBondReactedTwice +' + g.twice + '   bondReactStoppedAtKO +' + g.stopped);
  console.log('    turn | SHOWDOWN hits/tolls/atk-unboost/atkHP/faint | MEDICHAM');
  const n = Math.max(g.sd.length, g.me.length);
  const f = t => t ? [t.hits, t.tolls, t.atkUnboost, t.atkHP, t.faint ? 'FAINT' : ''].join(' / ') : '(none)';
  for (let i = 0; i < n; i++) console.log('    ' + String((g.sd[i] || g.me[i] || {}).n).padEnd(5) + '| ' + f(g.sd[i]).padEnd(44) + '| ' + f(g.me[i]));
  let agree = true;
  for (let i = 0; i <= g.koIdx && i < g.me.length; i++) {
    const s = g.sd[i], m = g.me[i];
    if (!(s.tolls === m.tolls && s.atkUnboost === m.atkUnboost && s.atkHP === m.atkHP)) agree = false;
  }
  summary.push({ arm: x.arm, kind: x.kind, agree, stopped: g.stopped });
  if (IS_CHILD) { console.log('    ' + (agree ? 'HOLDS' : 'PARTS')); continue; }
  const pre = g.sd.slice(0, g.koIdx);
  if (x.kind === 'red') {
    claim(pre.length > 0 && pre.every(t => t.hits === 2), x.arm + ' — SURVIVOR CONTROL: every pre-KO turn lands two arrivals on the authority',
      pre.map(t => t.hits).join(' '));
    claim(pre.every(t => (t.tolls + t.atkUnboost) === 2), x.arm + ' — SURVIVOR CONTROL: the authority reacts twice on every pre-KO turn',
      pre.map(t => t.tolls + '+' + t.atkUnboost).join(' '));
    const k = g.sd[g.koIdx];
    claim(k.hits === 1 && (k.tolls + k.atkUnboost) === 1, x.arm + ' — THE AUTHORITY: the killing click lands ONE arrival and reacts ONCE',
      'hits ' + k.hits + ', reactions ' + (k.tolls + k.atkUnboost));
    claim(g.stopped === 1, x.arm + ' — bondReactStoppedAtKO is exactly 1 (the KO turn only)', '+' + g.stopped);
  } else if (x.kind === 'control2') {
    const k = g.sd[g.koIdx];
    claim(k.hits === 2 && (k.tolls + k.atkUnboost) === 2, x.arm + ' — CONTROL: the killing click lands BOTH arrivals and reacts twice on the authority',
      'hits ' + k.hits + ', reactions ' + (k.tolls + k.atkUnboost));
    claim(g.stopped === 0, x.arm + ' — bondReactStoppedAtKO is 0', '+' + g.stopped);
  } else {
    claim(g.sd.every(t => t.tolls === 0) && g.me.every(t => t.tolls === 0), x.arm + ' — CONTROL: no toll on either engine');
    claim(g.me.some(t => t.faint), x.arm + ' — CONTROL: the body still dies on this engine');
    claim(g.stopped === 0, x.arm + ' — bondReactStoppedAtKO is 0', '+' + g.stopped);
  }
  claim(g.me.length > g.koIdx && g.me[g.koIdx].faint, x.arm + ' — both engines kill the body on the same turn');
  claim(agree, x.arm + ' — every turn through the KO: same reactor count and the same attacker HP on both engines');
}
if (IS_CHILD) { console.log('CHILD-SUMMARY ' + JSON.stringify({ knob: KNOB, stamp: STAMPED(), summary })); process.exit(0); }
claim(!STAMPED(), 'the clean load carries no knob stamp');

console.log(NL + 'RE-RUNNING UNDER MEDI_BOND_REACT_DRAWN=1' + NL);
const ch = spawnSync(process.execPath, [__filename, '--child'].concat(process.argv.includes('--release') ? ['--release', process.argv[process.argv.indexOf('--release') + 1]] : []),
  { env: Object.assign({}, process.env, { MEDI_BOND_REACT_DRAWN: '1' }), encoding: 'utf8', maxBuffer: 1 << 28 });
const line = String(ch.stdout || '').split(NL).find(l => l.startsWith('CHILD-SUMMARY '));
if (!line) claim(false, 'the knob child reported', String(ch.stderr || '').slice(-600));
else {
  const k = JSON.parse(line.slice('CHILD-SUMMARY '.length));
  claim(k.knob && k.stamp, 'the knob child loaded an engine that stamped MEDFAILS.bondReactDrawnRestored');
  for (const s of k.summary) {
    if (s.kind === 'red') claim(!s.agree, 'KNOB parts ' + s.arm);
    else claim(s.agree, 'KNOB holds the control ' + s.arm);
  }
}
console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
