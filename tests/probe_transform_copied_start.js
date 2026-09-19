#!/usr/bin/env node
/* tests/probe_transform_copied_start.js — DOES A BODY THAT TRANSFORMS RUN THE COPIED ABILITY'S `Start`?
 *   SHOWDOWN_PATH=... node tests/probe_transform_copied_start.js            (live tree, scratch store)
 *   SHOWDOWN_PATH=... node tests/probe_transform_copied_start.js --only hospitality [--dump]
 * The parent plays clean, then re-runs itself under MEDI_TRANSFORM_NO_COPIED_START=1, which must part
 * every live red and hold every control.
 * ==================================================================================================
 *
 * THE AUTHORITY, READ RATHER THAN RECALLED.
 *   `Pokemon#transformInto` (sim/pokemon.ts:1276) ends with
 *       if (this.battle.gen > 2) this.setAbility(pokemon.ability, this, null, true, true);      (:1356)
 *   and `setAbility` (sim/pokemon.ts:1913-1951) with `isTransform = true` skips the `SetAbility` event
 *   and the `-ability` line and then runs
 *       if (ability.id && this.battle.gen > 3 && (!isTransform || oldAbility.id !== ability.id || gen <= 4))
 *         this.battle.singleEvent('Start', ability, this.abilityState, this, source);           (:1946-1948)
 *   so the COPIED ability's `onStart` runs whenever its id differs from the copier's own. Both callers
 *   reach that one primitive: Imposter's `onSwitchIn` (data/abilities.ts:2105-2115) and the move
 *   Transform's `onHit(target, pokemon) { return pokemon.transformInto(target); }` (data/moves.ts).
 *   Champions overrides neither — `data/mods/champions/{abilities,moves,scripts}.ts` hold no `imposter`,
 *   no `transform` and no `transformInto`.
 *
 * THE CLASS, DERIVED ON EVERY RUN. Every ability carried by a legal species (filtered by
 * `isNonstandard`/`tier`, never `.all()` raw) whose handler has an `onStart`. The only legal
 * Transform/Imposter carrier is DERIVED too, and the file refuses to run if that changes.
 *
 * THE MOVE ARMS. For each class member, one game: Ditto (its non-Imposter ability, so its own ability
 * can never equal the copied one) clicks Transform at the carrier in p2a. Judged with no typed
 * expectation:
 *   BOARD   the two engines' boards agree after the turn (the differential's own state comparator);
 *   LINES   the multiset of effect lines written between Ditto's `|-transform|` and the next action
 *           agrees (weather, terrain, heal, unboost, -ability, -activate ...).
 * THE FIXTURE IS BUILT SO THE Start HAS SOMETHING TO DO, per shape read off the handler source:
 *   a WEATHER setter      — the partner is a SLOWER setter of a different weather, so at the lead the
 *                           partner's sky wins and the copied Start has a sky to change;
 *   a TERRAIN setter      — the partner, faster than Ditto, lays a different terrain first that turn;
 *   anything else         — the foe in p2b hits the partner first, so an ally-facing Start
 *                           (Hospitality) has a wound to see.
 * The authority's own log is the fixture receipt: an arm where the authority wrote NOTHING after the
 * transform and no board leaf moved is INERT-IN-AUTHORITY and is printed as such — it is the Start
 * having nothing to do on that board (Frisk on itemless foes, Supreme Overlord with no fainted ally),
 * never counted as proof.
 *
 * THE CONTROLS. (1) Ditto transforming into a body whose ability has NO `onStart` (derived): nothing
 * may follow the transform in either engine. (2) THE IMPOSTER DOOR — a Ditto carrying Imposter switched
 * in mid-game opposite a Hospitality body and an Intimidate body. That door runs the copied ability
 * through `runEntryPass` and was already right; it must stay right in BOTH knob positions.
 *
 * DECLARED, NOT STAGED: an ability that replaces ITSELF at the carrier's own entry (Trace) is never the
 * carrier's ability by the time a Transform can copy it — the copy takes what the body is holding. It
 * is listed by name every run.
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent. This is not a pass.'); process.exit(2); }
const IS_CHILD = process.argv.includes('--child');
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const SEEN = M.MEDSEEN;
/* PRESENCE, not truthiness: the harness zeroes counters between games and a stamp read as `!!` went false. */
const STAMPED = (k = 'transformNoCopiedStart') => Object.prototype.hasOwnProperty.call(M.MEDFAILS, k);
const NL = String.fromCharCode(10);
const KNOB = process.env.MEDI_TRANSFORM_NO_COPIED_START === '1';
const argOf = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = argOf('--only');
const DUMP = process.argv.includes('--dump');
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- THE COPIER ------------------------------------------------------------------------------------ */
const SPECIES = dex.species.all().filter(legal);
const TF_LEARNERS = SPECIES.filter(s => CS.canLearn(s.name, 'Transform'));
const IMP = SPECIES.filter(s => Object.values(s.abilities).some(a => idOf(a) === 'imposter'));
console.log('  Transform learners: ' + TF_LEARNERS.map(s => s.name).join(', ') + '   Imposter carriers: ' + IMP.map(s => s.name).join(', '));
if (TF_LEARNERS.length !== 1 || IMP.length !== 1 || TF_LEARNERS[0].id !== IMP[0].id) {
  console.log('NOT RUN — the copier set changed; this file stages one body for both doors.'); process.exit(2);
}
const COPIER = TF_LEARNERS[0];
const COPIER_OTHER = Object.values(COPIER.abilities).find(a => idOf(a) !== 'imposter');

/* ---- THE CLASS ------------------------------------------------------------------------------------- */
const carriers = {};
for (const s of SPECIES) for (const a of Object.values(s.abilities)) (carriers[idOf(a)] = carriers[idOf(a)] || []).push(s);
const src = id => String(dex.abilities.get(id).onStart || '');
const CLASS = Object.keys(carriers).filter(id => dex.abilities.get(id).onStart).sort();
const NO_START = Object.keys(carriers).filter(id => { const a = dex.abilities.get(id); return !a.onStart && !a.onSwitchIn; }).sort();
/* SELF-REPLACING: the handler's own Start rewrites the holder's ability (Trace's `setAbility`, reached
 * through its seek/Update pair). Read off the handler source, not named. */
const SELF_REPLACING = CLASS.filter(id => /setAbility/.test(String(dex.abilities.get(id).onUpdate || '') + src(id)));
const WEATHER = CLASS.filter(id => /setWeather\(/.test(src(id)));
const TERRAIN = CLASS.filter(id => /setTerrain\(/.test(src(id)));
const CLEARS = CLASS.filter(id => /clearBoosts\(/.test(src(id)));
const weatherOf = id => (src(id).match(/setWeather\("([a-z]+)"\)/) || [])[1];
const terrainOf = id => (src(id).match(/setTerrain\("([a-z]+)"\)/) || [])[1];
console.log('  class (legal abilities with onStart): ' + CLASS.length + '  ' + CLASS.join(', '));
console.log('  weather setters ' + WEATHER.join(',') + '   terrain setters ' + TERRAIN.join(',') + '   self-replacing (declared) ' + SELF_REPLACING.join(','));

/* THE CAST AROUND THE CARRIER — each row checked against the validator. */
const ALLY = { species: 'snorlax', item: '', ability: 'Thick Fat', moves: [CS.INERT_MOVE] };
const HITTER = { species: 'garchomp', item: '', ability: 'Sand Veil', moves: ['Dragon Claw', 'Protect'] };
for (const [s, m] of [[ALLY.species, ALLY.moves[0]], [HITTER.species, 'Dragon Claw'], [HITTER.species, 'Protect'], [COPIER.id, 'Transform']]) {
  if (!CS.canLearn(s, m)) { console.log('NOT RUN — ' + s + ' cannot learn ' + m + ' in this format.'); process.exit(2); }
}
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));

/* A carrier the Transform can copy. A mega is reached through the forme it evolves FROM (`changesFrom`),
 * because the validator judges the team sheet, not the battle forme. */
function pickCarrier(id) {
  const all = (carriers[id] || []).filter(s => s.id !== COPIER.id);
  const base = all.filter(s => !s.isMega && !s.battleOnly && !s.requiredItem && CS.canLearn(s.name, 'Protect'))
    .sort((a, b) => b.baseStats.spe - a.baseStats.spe);
  if (base.length) return { sp: base[0], sheet: base[0].name, mega: false, item: '' };
  for (const mg of all.filter(s => s.isMega)) {
    const from = dex.species.get(mg.changesFrom || mg.baseSpecies);
    if (legal(from) && CS.canLearn(from.name, 'Protect'))
      return { sp: mg, sheet: from.name, mega: true, item: [].concat(mg.requiredItem || [], mg.requiredItems || [])[0] };
  }
  return null;
}
/* THE PARTNER THAT GIVES A WEATHER Start SOMETHING TO CHANGE: a SLOWER carrier of a DIFFERENT weather,
 * so at the lead its sky lands last and is the one on the field when the copy happens. */
function weatherPartner(id, carrierSp) {
  for (const w of WEATHER) {
    if (weatherOf(w) === weatherOf(id)) continue;
    const c = (carriers[w] || []).filter(s => !s.isMega && !s.battleOnly && !s.requiredItem
      && s.baseStats.spe + 10 < carrierSp.baseStats.spe && CS.canLearn(s.name, 'Protect'));
    if (c.length) return { species: c[0].name, item: '', ability: dex.abilities.get(w).name, moves: ['Protect'], click: { m: 'protect' } };
  }
  return null;
}
/* THE PARTNER THAT GIVES A TERRAIN Start SOMETHING TO CHANGE: faster than the copier, and it lays a
 * DIFFERENT terrain by move on the same turn, after the mega has laid the carrier's. */
function terrainPartner(id) {
  const moves = ['grassyterrain', 'psychicterrain', 'mistyterrain', 'electricterrain'].map(m => dex.moves.get(m))
    .filter(m => legal(m) && m.terrain !== terrainOf(id));
  for (const mv of moves) {
    const c = SPECIES.filter(s => !s.isMega && !s.battleOnly && !s.requiredItem && s.baseStats.spe > COPIER.baseStats.spe + 20
      && CS.canLearn(s.name, mv.name)).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
    const ok = c.find(s => { const a = dex.abilities.get(Object.values(s.abilities)[0]); return !a.onStart && !a.onSwitchIn; });
    if (ok) return { species: ok.name, item: '', ability: Object.values(ok.abilities)[0], moves: [mv.name], click: { m: mv.id } };
  }
  return null;
}

/* THE PARTNER THAT GIVES A BOOST-CLEARING Start SOMETHING TO CLEAR: faster than the copier, and it
 * raises its own stat that turn before the copy. */
function boosterPartner() {
  const c = SPECIES.filter(s => !s.isMega && !s.battleOnly && !s.requiredItem && s.baseStats.spe > COPIER.baseStats.spe + 20
    && CS.canLearn(s.name, 'Swords Dance')).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
  const ok = c.find(s => Object.values(s.abilities).some(a => { const x = dex.abilities.get(a); return !x.onStart && !x.onSwitchIn; }));
  if (!ok) return null;
  const ab = Object.values(ok.abilities).find(a => { const x = dex.abilities.get(a); return !x.onStart && !x.onSwitchIn; });
  return { species: ok.name, item: '', ability: ab, moves: ['Swords Dance'], click: { m: 'swordsdance' } };
}

function unsplit(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const l = String(log[i]);
    if (/^\|split\|/.test(l)) { if (log[i + 1] !== undefined) out.push(String(log[i + 1])); i += 2; continue; }
    out.push(l);
  }
  return out;
}
/* THE LINES THE COPIED Start WROTE: everything after the `|-transform|` up to the next action, folded
 * to (event, side, what) so the two narrators' spellings and HP numbers do not decide anything. */
function afterTransform(lines) {
  const L = lines.map(String);
  const i = L.findIndex(l => l.startsWith('|-transform|'));
  if (i < 0) return null;
  /* The authority writes a bare `|` before the residual phase and this engine does not, so the window
   * also closes on the first residual line (the weather's own `[upkeep]` tick). */
  const j = L.findIndex((l, k) => k > i && (/^\|(move|switch|drag|upkeep|turn|cant)\|?/.test(l) || l === '|' || /\|\[upkeep\]$/.test(l)));
  /* `-hint` is the authority's help text, and `-ability` is dropped by the differential's own
   * `ability-announcement` equivalence (engine/game_differential.js EQUIV[0]): every consequence of an
   * announcement is a separate line and is kept. */
  return L.slice(i + 1, j < 0 ? L.length : j).filter(l => !/^\|-(hint|ability)\|/.test(l)).map(l => {
    const f = l.split('|');
    const side = s => String(s || '').slice(0, 3);
    const what = f[1] === '-weather' || f[1] === '-fieldstart' ? idOf(f[2]).replace(/^move/, '')
      : /^-(boost|unboost|ability|item|enditem|sideend|fieldend|activate|start|end|clearboost)$/.test(f[1]) ? idOf(f[3])
      : '';
    return [f[1], /^-(weather|fieldstart|fieldend)$/.test(f[1]) ? '' : side(f[2]), what].join(':');
  }).sort();
}

function play(label, pA, pB, script) {
  const a = G.buildPair(pA), b = G.buildPair(pB);
  if (!a || !b) return { label, err: 'NOT-STAGED (buildPair returned null)' };
  const s0 = SEEN.transformCopiedStartRan | 0;
  const f0 = Object.assign({}, M.MEDFAILS);
  const r = G.playGame(a, b, 'directed', 'probe_transform_copied_start :: ' + label, { script });
  if (r.err) return { label, err: String(r.err) };
  const sdLog = unsplit((G.lastSdLog ? G.lastSdLog() : []).map(String));
  if (DUMP) {
    console.log('---- SHOWDOWN ' + label + NL + sdLog.filter(l => /^\|(switch|move|-|turn|faint)/.test(l)).join(NL));
    console.log('---- MEDICHAM ' + label + NL + (r.mediTrace || []).map(String).join(NL));
  }
  /* THE ENGINE'S OWN DECLARED NARRATION GAPS, counted by name (`...Unannounced`, `...Unmodelled`): the
   * entry door carries the identical gap, so a line one of these accounts for is not THIS defect. */
  const declared = Object.keys(M.MEDFAILS).filter(k => /Unannounced$|Unmodelled$/.test(k)
    && typeof M.MEDFAILS[k] === 'number' && M.MEDFAILS[k] > ((M.MEDFAILS[k] >= (f0[k] | 0)) ? (f0[k] | 0) : 0));
  return { label, sd: afterTransform(sdLog), me: afterTransform((r.mediTrace || []).map(String)),
           ran: (SEEN.transformCopiedStartRan | 0) - s0, stateDiv: r.stateDiv, declared };
}

console.log(NL + (KNOB ? 'KNOB ARM — MEDI_TRANSFORM_NO_COPIED_START=1' : 'CLEAN ARM') + '   release ' + (REL && REL.id) + NL);
const rows = [];
const DITTO_MOVE = { species: COPIER.id, item: '', ability: COPIER_OTHER, moves: ['Transform'] };
function moveArm(id, cast, kind) {
  let partner = ALLY, pClick = { m: idOf(CS.INERT_MOVE) }, hit = { m: 'dragonclaw', t: 1 }, fixture = 'the foe hits the partner first';
  if (WEATHER.includes(id)) {
    const w = weatherPartner(id, cast.sp);
    if (!w) return { label: 'MOVE  ' + id, err: 'NOT-STAGED — no slower setter of a different weather (a claim about the fixture)' };
    partner = w; pClick = w.click; hit = { m: 'protect' }; fixture = 'partner ' + w.species + ' (' + w.ability + ') owns the sky at the lead';
  } else if (CLEARS.includes(id)) {
    const b = boosterPartner();
    if (!b) return { label: 'MOVE  ' + id, err: 'NOT-STAGED — no faster partner that learns Swords Dance (a claim about the fixture)' };
    partner = b; pClick = b.click; hit = { m: 'protect' }; fixture = 'partner ' + b.species + ' raises its Attack before the copy';
  } else if (TERRAIN.includes(id)) {
    const t = terrainPartner(id);
    if (!t) return { label: 'MOVE  ' + id, err: 'NOT-STAGED — no faster partner with a different terrain move (a claim about the fixture)' };
    partner = t; pClick = t.click; hit = { m: 'protect' }; fixture = 'partner ' + t.species + ' lays ' + t.moves[0] + ' before the copy';
  }
  const P1 = [DITTO_MOVE, { species: partner.species, item: partner.item, ability: partner.ability, moves: partner.moves }].concat(BENCH('milotic', 'corviknight'));
  const P2 = [{ species: cast.sheet, item: cast.item, ability: dex.abilities.get(cast.mega ? Object.values(dex.species.get(cast.sheet).abilities)[0] : id).name, moves: ['Protect'] },
              HITTER].concat(BENCH('milotic', 'corviknight'));
  const x = play('MOVE  ' + id + ' (' + cast.sp.name + ')', P1, P2,
    [{ p1: [{ m: 'transform', t: 0 }, pClick], p2: [{ m: 'protect', mega: cast.mega }, hit] }]);
  x.id = id; x.kind = kind; x.fixture = fixture; x.door = 'move';
  return x;
}
/* THE IMPOSTER DOOR: turn 1 wounds the partner, turn 2 Ditto walks into slot a and copies the DIAGONAL
 * (p2b) — `data/abilities.ts:2111`. */
const IDLES = ['Calm Mind', 'Coil', 'Bulk Up', 'Swords Dance', 'Agility', 'Nasty Plot', 'Work Up', 'Howl'];
function imposterArm(id) {
  const cast = (carriers[id] || []).filter(s => !s.isMega && !s.battleOnly && !s.requiredItem && CS.canLearn(s.name, 'Protect'))
    .map(s => ({ sp: s, sheet: s.name, idle: IDLES.find(m => CS.canLearn(s.name, m)) })).find(c => c.idle);
  if (!cast) return { label: 'IMPOSTER  ' + id, err: 'NOT-STAGED — no carrier with Protect and a second idle move (a claim about the fixture)' };
  const P1 = [{ species: 'milotic', item: '', ability: 'Marvel Scale', moves: ['Protect', 'Coil'] }, ALLY,
              { species: COPIER.id, item: '', ability: 'Imposter', moves: ['Transform'] }, BENCH('corviknight')[0]];
  const idle2 = cast.idle;
  const P2 = [HITTER, { species: cast.sheet, item: '', ability: dex.abilities.get(id).name, moves: ['Protect', idle2] }].concat(BENCH('milotic', 'corviknight'));
  const x = play('IMPOSTER  ' + id + ' (' + cast.sp.name + ')', P1, P2, [
    { p1: [{ m: 'protect' }, { m: idOf(CS.INERT_MOVE) }], p2: [{ m: 'dragonclaw', t: 1 }, { m: 'protect' }] },
    { p1: [{ sw: COPIER.id }, { m: idOf(CS.INERT_MOVE) }], p2: [{ m: 'dragonclaw', t: 1 }, { m: idOf(idle2) }] }]);
  x.id = id; x.kind = 'control'; x.fixture = 'imposter enters turn 2 opposite ' + cast.sp.name; x.door = 'imposter';
  return x;
}

for (const id of CLASS) {
  if (ONLY && id !== ONLY) continue;
  if (SELF_REPLACING.includes(id)) { console.log('DECLARED    ' + id + ' — replaces itself at the carrier\'s own entry; a Transform copies what the body holds'); continue; }
  const cast = pickCarrier(id);
  if (!cast) { console.log('NOT-STAGED  ' + id + ' — no legal carrier that can learn Protect (a claim about the fixture)'); fails++; continue; }
  rows.push(moveArm(id, cast, 'red'));
}
if (!ONLY) {
  const ctl = NO_START.map(id => ({ id, cast: pickCarrier(id) })).find(c => c.cast && !c.cast.mega);
  rows.push(moveArm(ctl.id, ctl.cast, 'control'));
  for (const id of ['hospitality', 'intimidate']) if (CLASS.includes(id)) rows.push(imposterArm(id));
}

const summary = [];
for (const x of rows) {
  console.log(NL + x.label + '   [' + x.kind + (x.fixture ? '; ' + x.fixture : '') + ']');
  if (x.err) { claim(false, x.label + ' — staged', x.err); continue; }
  const inert = (!x.sd || x.sd.length === 0);
  console.log('    showdown ' + JSON.stringify(x.sd) + (inert ? '   (nothing written after the transform)' : ''));
  console.log('    medicham ' + JSON.stringify(x.me) + '   transformCopiedStartRan +' + x.ran);
  const linesAgree = JSON.stringify(x.sd) === JSON.stringify(x.me);
  const sdOnly = (x.sd || []).filter(l => !(x.me || []).includes(l)), meOnly = (x.me || []).filter(l => !(x.sd || []).includes(l));
  /* A parting that is ONLY authority-side lines, in an arm where the engine counted a declared narration
   * gap, is that declared gap and is printed as such rather than passed silently. */
  const declaredOnly = !linesAgree && meOnly.length === 0 && sdOnly.length > 0 && x.declared.length > 0;
  if (declaredOnly) console.log('    DECLARED NARRATION  ' + JSON.stringify(sdOnly) + '  <- ' + x.declared.join(', '));
  const agree = !x.stateDiv && (linesAgree || declaredOnly);
  const live = !inert || !!x.stateDiv;
  summary.push({ id: x.id, door: x.door, kind: x.kind, agree, live, ran: x.ran, declaredOnly, boardParts: !!x.stateDiv });
  if (IS_CHILD) {
    console.log('    ' + (agree ? 'HOLDS' : 'PARTS') + (x.kind === 'red' && !live ? ' (inert in authority)' : ''));
    continue;
  }
  claim(x.sd !== null && x.me !== null, x.label + ' — both engines wrote a -transform line');
  if (x.kind === 'control' && x.door === 'move') claim(inert && x.me && x.me.length === 0, x.label + ' — CONTROL: nothing follows the transform in either engine');
  if (x.door === 'imposter') claim(!inert, x.label + ' — FIXTURE: the authority ran the copied Start at the entry', JSON.stringify(x.sd));
  /* The door is ASKED whenever the copied id differs from the copier's (the authority's own test), so
   * the no-onStart control is asked too — and must write nothing. */
  if (x.door === 'move') claim(x.ran === 1, x.label + ' — transformCopiedStartRan is exactly 1', '+' + x.ran);
  claim(!x.stateDiv, x.label + ' — the two boards agree after the turn', x.stateDiv ? JSON.stringify(x.stateDiv.diffs.slice(0, 4)) : '');
  claim(linesAgree || declaredOnly, x.label + ' — the same effect lines follow the transform (or only a DECLARED narration gap)',
    linesAgree ? '' : 'showdown-only ' + JSON.stringify(sdOnly) + '  medicham-only ' + JSON.stringify(meOnly));
}
const liveReds = summary.filter(s => s.kind === 'red' && s.live).map(s => s.id);
console.log(NL + '  live reds (the authority wrote or moved something): ' + liveReds.length + '  ' + liveReds.join(', '));
console.log('  inert reds (Start had nothing to do on this board): ' + summary.filter(s => s.kind === 'red' && !s.live).map(s => s.id).join(', '));

if (IS_CHILD) {
  console.log('CHILD-SUMMARY ' + JSON.stringify({ knob: KNOB, stamps: { transformNoCopiedStart: STAMPED('transformNoCopiedStart'),
    mimicryTransformBlind: STAMPED('mimicryTransformBlind') }, summary }));
  process.exit(0);
}
claim(!STAMPED('transformNoCopiedStart') && !STAMPED('mimicryTransformBlind'), 'the clean load carries no knob stamp');
if (!ONLY) claim(liveReds.length >= 4, 'at least four class members are LIVE on their board (the probe can see the defect)', liveReds.join(', '));

/* ---- THE KNOB CHILDREN -------------------------------------------------------------------------------
 * MEDI_TRANSFORM_NO_COPIED_START=1   the move door runs no copied Start: every live red must part.
 * MEDI_MIMICRY_TRANSFORM_BLIND=1     Mimicry reads the COPIED species' types: only the Mimicry arm may part.
 * Both must hold every control, and each must load an engine that stamped its own receipt. */
function child(env) {
  const ch = spawnSync(process.execPath, [__filename, '--child'].concat(process.argv.includes('--release') ? ['--release', argOf('--release')] : []),
    { env: Object.assign({}, process.env, env), encoding: 'utf8', maxBuffer: 1 << 28 });
  const line = String(ch.stdout || '').split(NL).find(l => l.startsWith('CHILD-SUMMARY '));
  if (!line) { claim(false, 'the knob child ' + JSON.stringify(env) + ' reported', String(ch.stderr || '').slice(-600)); return null; }
  return JSON.parse(line.slice('CHILD-SUMMARY '.length));
}
if (!ONLY) {
  console.log(NL + 'RE-RUNNING UNDER MEDI_TRANSFORM_NO_COPIED_START=1' + NL);
  const k = child({ MEDI_TRANSFORM_NO_COPIED_START: '1' });
  if (k) {
    claim(k.stamps.transformNoCopiedStart, 'the knob child loaded an engine that stamped MEDFAILS.transformNoCopiedStart');
    for (const s of k.summary) {
      const clean = summary.find(c => c.id === s.id && c.door === s.door);
      if (!clean) continue;
      /* An arm whose ONLY authority output was a declared narration gap (the entry door shares it) can
       * part only on the board; one that parts on neither is printed, never passed as a red. */
      if (s.kind === 'red' && clean.live && !clean.declaredOnly) claim(!s.agree, 'KNOB parts the live red ' + s.door + ':' + s.id);
      if (s.kind === 'red' && clean.declaredOnly) {
        if (s.boardParts) claim(true, 'KNOB parts the BOARD of ' + s.door + ':' + s.id + ' (its lines are a declared gap)');
        else console.log('  (knob) ' + s.door + ':' + s.id + ' — narration-only and declared on both doors; the knob cannot be seen here');
      }
      if (s.kind === 'control') claim(s.agree, 'KNOB holds the control ' + s.door + ':' + s.id);
      claim(s.ran === 0, 'KNOB ' + s.door + ':' + s.id + ' — transformCopiedStartRan is 0', '+' + s.ran);
    }
  }
  console.log(NL + 'RE-RUNNING UNDER MEDI_MIMICRY_TRANSFORM_BLIND=1' + NL);
  const b = child({ MEDI_MIMICRY_TRANSFORM_BLIND: '1' });
  if (b) {
    claim(b.stamps.mimicryTransformBlind && !b.stamps.transformNoCopiedStart, 'the mimicry child stamped its own receipt and no other');
    const parted = b.summary.filter(s => !s.agree).map(s => s.door + ':' + s.id);
    claim(parted.length === 1 && parted[0] === 'move:mimicry', 'MIMICRY KNOB parts the Mimicry arm and nothing else', JSON.stringify(parted));
  }
}
console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
