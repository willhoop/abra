/* probe_move_effect_leads.js — FOUR SINGLE-GAME LEADS FROM THE 482e8f5ca701 LATTICES, STAGED AGAINST
 * THE AUTHORITY ONE MECHANISM AT A TIME. 2026-09-19, ENGINE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_move_effect_leads.js [--release <id>] [--only <lead>]
 *
 * A lattice card says WHERE two engines parted, never WHY. Each lead below is the WHY, read off the
 * authority (Champions mod first, cited file:line in the lead's own block), staged on a board where
 * ONE input differs between the red arm and its control, with a MEDI_* knob that restores the defect.
 *
 * EVERY LEAD IS CHECKED THREE WAYS, in this order:
 *   1. THE AUTHORITY SEPARATES the red arm from its control (else the fixture cannot see the mechanic
 *      and the arm is refused, not passed);
 *   2. BOTH ENGINES AGREE on every board of every arm, knob off;
 *   3. THE KNOB PARTS EVERY RED ARM AND NO CONTROL — so the probe could have seen the defect.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
const NL = '\n';
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
if (!process.argv.includes('--state')) process.argv.push('--state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) REL_ID = ER.cut('tests/probe_move_effect_leads.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');

let _cur = null, _G = null;
function harness(knob) {
  const key = knob || '';
  if (_G && _cur === key) return _G;
  for (const L of LEADS) delete process.env[L.knob];
  if (knob) process.env[knob] = '1';
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const mid = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[mid]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
const CH = f => fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', f), 'utf8');
const src = f => String(f || '').replace(/\s+/g, ' ');
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const FILL = [['sylveon', '', 'Cute Charm', ['Protect']], ['snorlax', '', 'Immunity', ['Protect']]];
const J = o => JSON.stringify(o);
const P = { m: 'protect' };

/* THE AUTHORITY'S HP LOSS PER SLOT, off its own log (the last `-damage`/`-heal` HP per slot minus the
 * switch-in HP). Used only to prove the red arm and its control differ ON THE AUTHORITY. */
function hpBySlot(lines) {
  const out = {};
  for (const raw of lines.map(String)) {
    const m = /^\|(?:switch|-damage|-heal)\|(p[12][ab])[^|]*\|(?:[^|]*\|)?(\d+)\/(\d+)/.exec(raw)
           || /^\|(?:-damage|-heal)\|(p[12][ab])[^|]*\|(\d+)\/(\d+)/.exec(raw);
    if (m) out[m[1]] = +m[2];
  }
  return out;
}

/* =================================================================================================
 * LEAD 1 — GRAV APPLE UNDER GRAVITY.
 *
 * The card (g1350, `gen9championsvgc2026regmbbo3-2654508003 vs …-2654613453`, turn 4) reads Torkoal
 * `16/145` on the authority and `39/145` here after a Grav Apple; Sableye had set Gravity on turn 1.
 * 85 -> 16 is 69, 85 -> 39 is 46, and 69/46 = 1.5.
 *
 *   data/moves.ts gravapple.onBasePower:  if (this.field.getPseudoWeather('gravity'))
 *                                            return this.chainModify(1.5);
 *   data/mods/champions/moves.ts gravapple: { inherit: true, basePower: 90 }   — the handler inherits.
 *
 * The red arm: Sableye (Prankster) clicks Gravity, then Flapple Grav Apples Snorlax, same turn.
 * The control: Sableye clicks Protect instead — no Gravity, same Grav Apple.
 * ================================================================================================= */
const L1 = {
  id: 'gravapple', knob: 'MEDI_GRAV_APPLE_IGNORES_GRAVITY', stamp: 'gravAppleGravityIgnoredRestored',
  authority() {
    const m = dex.moves.get('gravapple');
    const s = src(m.onBasePower);
    const ch = /gravapple:\s*\{[^}]*\}/.exec(CH('moves.ts'));
    console.log('    gravapple.onBasePower      : ' + s.slice(0, 140));
    console.log('    champions override         : ' + (ch ? ch[0].replace(/\s+/g, ' ') : 'none') + '   basePower ' + m.basePower);
    return /getPseudoWeather\(\s*"gravity"\s*\)/.test(s) && /chainModify\(\s*1\.5\s*\)/.test(s);
  },
  cases() {
    const def = stage([['snorlax', '', 'Immunity', ['Endure', 'Protect']], ['tinkaton', '', 'Own Tempo', ['Protect']]].concat(FILL));
    const att = stage([['flapple', '', 'Ripen', ['Grav Apple', 'Protect']], ['sableye', '', 'Prankster', ['Gravity', 'Protect']]].concat(FILL));
    const hit = { m: 'gravapple', t: 0 };
    const out = [];
    for (const pin of ['top-tie-first', 'middle']) {
      out.push({ id: 'gravity@' + pin, kind: 'red', pin, a: att, b: def,
                 script: [{ p1: [hit, { m: 'gravity' }], p2: [{ m: 'endure' }, P] }] });
      out.push({ id: 'ctl-no-gravity@' + pin, red: 'gravity@' + pin, kind: 'control', pin, a: att, b: def,
                 script: [{ p1: [hit, P], p2: [{ m: 'endure' }, P] }] });
    }
    return out;
  },
  outcome: sd => ({ snorlaxHp: hpBySlot(sd).p2a }),
};

/* =================================================================================================
 * LEAD 2 — HEAL PULSE OUT OF A MEGA LAUNCHER USER HEALS 75%, NOT 50%.
 *
 * The card (g1950, `…-2656570989 vs …-2656519068`, turn 12): Clawitzer (Mega Launcher) Heal Pulses
 * a Blastoise at 55/154; the authority lands it at 154/154, this engine at 132/154 (= 55 + 77, the
 * plain half). The brief's "on Blastoise" is the RECIPIENT; the ability that matters is the USER's.
 *
 *   data/moves.ts healpulse.onHit(target, source):
 *     if (source.hasAbility("megalauncher")) success = !!this.heal(this.modify(target.baseMaxhp, 0.75));
 *     else success = !!this.heal(Math.ceil(target.baseMaxhp * 0.5));
 *   No Champions override of healpulse or megalauncher (checked at run time below).
 *
 * The only legal Mega Launcher carriers are Clawitzer and Blastoise-Mega (derived), both single-ability,
 * and Blastoise does not learn Heal Pulse (derived) — so the ability cannot be varied on one species.
 * The varied input is THE USER: Clawitzer (red) against Slowbro / Oblivious (control). The amount is
 * sized off the RECIPIENT's max HP in both branches, so nothing else about the user reaches the
 * number. Turn 1: two Night Shades (level damage, 50 each) into Sylveon while the user Protects.
 * Turn 2: the user Heal Pulses Sylveon; both foes Protect.
 * ================================================================================================= */
const L2 = {
  id: 'healpulse', knob: 'MEDI_HEAL_PULSE_IGNORES_LAUNCHER', stamp: 'healPulseLauncherIgnoredRestored',
  authority() {
    const s = src(dex.moves.get('healpulse').onHit);
    console.log('    healpulse.onHit            : ' + s.slice(0, 230));
    const ov = ['healpulse', 'megalauncher'].filter(k => new RegExp('\\b' + k + '\\s*:').test(CH('moves.ts') + CH('abilities.ts')));
    console.log('    champions overrides        : ' + (ov.join(',') || 'none'));
    return !ov.length && /hasAbility\(\s*"megalauncher"\s*\)[^}]*this\.modify\(\s*target\.baseMaxhp\s*,\s*0\.75\s*\)/.test(s);
  },
  cases() {
    const def = stage([['sableye', '', 'Keen Eye', ['Night Shade', 'Protect']], ['froslass', '', 'Snow Cloak', ['Night Shade', 'Protect']]].concat(FILL));
    const att = u => stage([u, ['sylveon', '', 'Cute Charm', ['Calm Mind', 'Protect']]].concat(FILL));
    const CLAW = ['clawitzer', '', 'Mega Launcher', ['Heal Pulse', 'Protect']], BRO = ['slowbro', '', 'Oblivious', ['Heal Pulse', 'Protect']];
    const shade = { m: 'nightshade', t: 1 };
    const out = [];
    for (const pin of ['top-tie-first', 'middle']) {
      for (const red of [true, false]) {
        out.push({ id: (red ? 'launcher' : 'ctl-slowbro') + '@' + pin, red: red ? undefined : 'launcher@' + pin,
                   kind: red ? 'red' : 'control', pin, a: att(red ? CLAW : BRO), b: def,
                   script: [{ p1: [P, { m: 'calmmind' }], p2: [shade, shade] },
                            { p1: [{ m: 'healpulse', ally: true }, { m: 'calmmind' }], p2: [P, P] }] });
      }
      /* THE DEEP PAIR: a third Night Shade first, so the 75% does NOT cap at full and the ROUNDING is
       * on the board — `this.modify(170, 0.75)` is 127 where a `Math.ceil` would be 128. Froslass (the
       * faster foe) shades on turn 2 so the chip lands BEFORE either user's Heal Pulse. */
      for (const red of [true, false]) {
        out.push({ id: (red ? 'launcher-deep' : 'ctl-slowbro-deep') + '@' + pin, red: red ? undefined : 'launcher-deep@' + pin,
                   kind: red ? 'red' : 'control', pin, a: att(red ? CLAW : BRO), b: def,
                   script: [{ p1: [P, { m: 'calmmind' }], p2: [shade, shade] },
                            { p1: [{ m: 'healpulse', ally: true }, { m: 'calmmind' }], p2: [P, shade] }] });
      }
    }
    return out;
  },
  outcome: sd => ({ sylveonHp: hpBySlot(sd).p1b }),
};

/* =================================================================================================
 * LEAD 3 — A MOVE'S BOOST TABLE ONTO ANOTHER BODY (`boostsTarget`: Decorate, Coaching, Aromatic Mist,
 * Howl) RUNS THE RECIPIENT'S OWN BOOST REACTIONS.
 *
 * The card (g1950, `…-2656419834 vs …-2656731493`, turn 16): Alcremie Decorates a Contrary Malamar
 * across the field; the authority writes `|-unboost|p2b: Malamar|atk|2`, this engine `|-boost|…|atk|2`.
 *
 *   sim/battle-actions.ts runMoveEffects: `this.battle.boost(moveData.boosts, target, source, move, …)`
 *   sim/battle.ts Battle#boost: runEvent('ChangeBoost') [Contrary x-1, Simple x2], 'TryBoost' [the
 *     drop refusals], then per stat 'AfterEachBoost' [Defiant, Competitive].
 *   data/moves.ts decorate: `boosts: { atk: 2, spa: 2 }`, no handler. Champions overrides none of
 *     decorate / contrary (checked at run time below).
 *
 * The `boostally` branch wrote the table raw. Flatter and Swagger — the other two `boostsTarget`
 * members — already route through `affect`, which asks Contrary; they are the reference, not the bug.
 * Varied input: THE RECIPIENT'S ABILITY, Malamar / Contrary (red) against Malamar / Suction Cups, once
 * aimed across the field and once at the partner.
 * ================================================================================================= */
const L3 = {
  id: 'decorate', knob: 'MEDI_TARGET_BOOST_RAW', stamp: 'targetBoostRawRestored',
  authority() {
    const m = dex.moves.get('decorate');
    console.log('    decorate                   : boosts ' + J(m.boosts) + '  onHit ' + !!m.onHit + '  target ' + m.target);
    console.log('    contrary.onChangeBoost     : ' + src(dex.abilities.get('contrary').onChangeBoost).slice(0, 140));
    const ov = ['decorate', 'contrary'].filter(k => new RegExp('\\b' + k + '\\s*:').test(CH('moves.ts') + CH('abilities.ts')));
    console.log('    champions overrides        : ' + (ov.join(',') || 'none'));
    return !ov.length && m.boosts && m.boosts.atk === 2 && !m.onHit
      && /boost\[i\]\s*\*=\s*-1/.test(src(dex.abilities.get('contrary').onChangeBoost));
  },
  cases() {
    const ALC = ['alcremie', '', 'Sweet Veil', ['Decorate', 'Protect']];
    const MAL = ab => ['malamar', '', ab, ['Endure', 'Protect']];
    const TIN = ['tinkaton', '', 'Own Tempo', ['Protect']];
    const out = [];
    for (const pin of ['top-tie-first', 'middle']) {
      for (const [red, ab] of [[true, 'Contrary'], [false, 'Suction Cups']]) {
        const tag = red ? '' : 'ctl-';
        out.push({ id: tag + 'foe@' + pin, red: red ? undefined : 'foe@' + pin, kind: red ? 'red' : 'control', pin,
                   a: stage([ALC, TIN].concat(FILL)), b: stage([MAL(ab), TIN].concat(FILL)),
                   script: [{ p1: [{ m: 'decorate', t: 0 }, P], p2: [{ m: 'endure' }, P] }] });
        out.push({ id: tag + 'ally@' + pin, red: red ? undefined : 'ally@' + pin, kind: red ? 'red' : 'control', pin,
                   a: stage([ALC, MAL(ab)].concat(FILL)), b: stage([TIN, ['corviknight', '', 'Pressure', ['Protect']]].concat(FILL)),
                   script: [{ p1: [{ m: 'decorate', ally: true }, { m: 'endure' }], p2: [P, P] }] });
      }
    }
    return out;
  },
  outcome: sd => {
    const o = {};
    for (const raw of sd.map(String)) {
      const m = /^\|-(un)?boost\|(p[12][ab])[^|]*\|(\w+)\|(\d+)/.exec(raw);
      if (m) o[m[2] + '.' + m[3]] = (o[m[2] + '.' + m[3]] || 0) + (m[1] ? -1 : 1) * (+m[4]);
    }
    return o;
  },
};

/* =================================================================================================
 * LEAD 4 — "RAISED A STAT THIS TURN" IS NOT CARRIED ACROSS A SWITCH.
 *
 * The card (g1950, `…-2635665638 vs …-2635612029`, turn 2): Clefable's Alluring Voice confuses a
 * Swampert here and not on the authority. Replayed on 482e8f5ca701 (engine/replay_one.js): Swampert led,
 * took Scrafty's Intimidate (-1 Atk), switched out on turn 1 and back in on turn 2. The engine's
 * `statsRoseThisTurn` compares against `_boostSnap`, a snapshot taken at the top of each turn for the
 * ACTIVE bodies only — so the returning Swampert still held turn 1's `{at:-1}` snapshot, its reset 0
 * read as a rise, and the condition fired. NOT a missing condition: a stale baseline.
 *
 *   data/moves.ts alluringvoice.secondary.onHit: `if (target?.statsRaisedThisTurn)
 *     target.addVolatile("confusion", source, move)`; burningjealousy the same with `trySetStatus("brn")`.
 *   sim/battle-actions.ts:123 (switchIn): `oldActive.statsRaisedThisTurn = false` — cleared on the way
 *     OUT; sim/battle.ts:2082 sets it inside `boost()`. No Champions override of either move.
 *
 * Red: Scizor (Fairy-resisting, so no roll KOs it; faster than the Clefable) is Intimidated at lead and holds -1 into turn 2's snapshot, switches out turn 2, back
 * turn 3, eats Alluring Voice. (Three turns, not two: since lead 4b the turn-1 baseline is taken BEFORE
 * the lead entry, so a turn-1 pivot would leave a 0 snapshot and the knob could not show the defect.)
 * Control (the rule's positive arm, so the fixture can SEE a confusion): Scizor stays in and clicks
 * Swords Dance on turn 3, ahead of the Clefable — both engines must confuse.
 * ================================================================================================= */
const L4 = {
  id: 'alluringvoice', knob: 'MEDI_BOOST_SNAP_SURVIVES_SWITCH', stamp: 'boostSnapSurvivesSwitchRestored',
  authority() {
    const s = src((dex.moves.get('alluringvoice').secondary || {}).onHit);
    console.log('    alluringvoice secondary    : ' + s.slice(0, 160));
    const ov = ['alluringvoice', 'burningjealousy'].filter(k => new RegExp('\\b' + k + '\\s*:').test(CH('moves.ts')));
    console.log('    champions overrides        : ' + (ov.join(',') || 'none'));
    return !ov.length && /statsRaisedThisTurn/.test(s) && /confusion/.test(s);
  },
  cases() {
    const a = stage([['incineroar', '', 'Intimidate', ['Protect']], ['clefable', '', 'Unaware', ['Alluring Voice', 'Protect']]].concat(FILL));
    const b = stage([['scizor', '', 'Technician', ['Swords Dance', 'Protect']], ['tinkaton', '', 'Own Tempo', ['Protect']],
                     ['corviknight', '', 'Pressure', ['Protect']], ['snorlax', '', 'Immunity', ['Protect']]]);
    const AV = { m: 'alluringvoice', t: 0 };
    const out = [];
    for (const pin of ['top-tie-first', 'middle']) {
      out.push({ id: 'returned@' + pin, kind: 'red', pin, a, b,
                 script: [{ p1: [P, P], p2: [P, P] },
                          { p1: [P, P], p2: [{ sw: 'corviknight' }, P] },
                          { p1: [P, AV], p2: [{ sw: 'scizor' }, P] }] });
      out.push({ id: 'ctl-raised@' + pin, red: 'returned@' + pin, kind: 'control', pin, a, b,
                 script: [{ p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] },
                          { p1: [P, AV], p2: [{ m: 'swordsdance' }, P] }] });
    }
    return out;
  },
  outcome: sd => ({ confused: sd.map(String).filter(l => /^\|-start\|p2a[^|]*\|confusion/.test(l)).length }),
};

/* LEAD 4b — THE SAME BASELINE'S OTHER DOOR: A RAISE AT LEAD ENTRY COUNTS ON TURN 1.
 *
 * Found while staging lead 4, not on a card. sim/battle.ts nextTurn: `this.turn++` (:1621), then the
 * clear `if (this.turn !== 1) { … pokemon.statsRaisedThisTurn = false; … }` (:1672) — so turn 1 keeps
 * whatever was raised while the leads entered. Staged: a Defiant Kingambit leads into an Intimidate
 * (-1 then +2), and a turn-1 Alluring Voice confuses it on the authority; this engine's turn-top
 * snapshot was taken AFTER the entry pass and saw no rise. Control: the same Kingambit on Pressure —
 * a drop, no raise, no confusion on either engine. */
const L4b = {
  id: 'turn1raise', knob: 'MEDI_TURN1_SNAP_AFTER_ENTRY', stamp: 'turn1SnapAfterEntryRestored',
  authority: () => L4.authority(),
  cases() {
    const a = stage([['incineroar', '', 'Intimidate', ['Protect']], ['clefable', '', 'Unaware', ['Alluring Voice', 'Protect']]].concat(FILL));
    const b = ab => stage([['kingambit', '', ab, ['Protect', 'Taunt']], ['tinkaton', '', 'Own Tempo', ['Protect']]].concat(FILL));
    const script = [{ p1: [P, { m: 'alluringvoice', t: 0 }], p2: [{ m: 'taunt', t: 0 }, P] }];
    const out = [];
    for (const pin of ['top-tie-first', 'middle']) {
      out.push({ id: 'defiant@' + pin, kind: 'red', pin, a, b: b('Defiant'), script });
      out.push({ id: 'ctl-pressure@' + pin, red: 'defiant@' + pin, kind: 'control', pin, a, b: b('Pressure'), script });
    }
    return out;
  },
  outcome: L4.outcome,
};

const LEADS = [L1, L2, L3, L4, L4b];

/* ---- LEGALITY, DERIVED ------------------------------------------------------------------------- */
let illegal = 0;
for (const L of LEADS) for (const c of L.cases()) for (const row of c.a.concat(c.b)) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' / ' + row.ability); illegal++; }
  for (const mv of row.moves) {
    if (!legal(dex.moves.get(mv))) { console.log('ILLEGAL FIXTURE  ' + mv); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + mv); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

function play(G, c) {
  G.resetScriptCounters(); G.resetChoiceCounters();
  const arm = G.ARM_BY_ID.get(c.pin);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.pin); process.exit(2); }
  const a = G.buildPair(c.a), b = G.buildPair(c.b);
  if (!a || !b) return { notStaged: true };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_move_effect_leads :: ' + c.id, {
    script: c.script, arm,
    onBoundary: (snap, t) => boards.push({ t, identical: !!snap.identical,
                                           diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) }),
  });
  const sd = G.sdStream(G.lastSdLog()).map(String);
  const me = (r.mediTrace || []).map(String);
  return { r, boards, sd, me, sc: G.scriptCounters(), cc: G.choiceCounters(), MF: globalThis.MEDFAILS || {} };
}
const boardEq = rows => rows.length > 0 && rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');

let bad = 0, ran = 0;
for (const L of LEADS) {
  if (ONLY && L.id !== ONLY) continue;
  console.log(NL + '################################################################');
  console.log('  LEAD ' + L.id + '   knob ' + L.knob);
  console.log('  THE AUTHORITY, RE-DERIVED THIS RUN:');
  if (!L.authority()) { console.log('  NOT RUN — the format no longer carries the rule this lead is about. A finding, not a pass.'); bad++; continue; }
  const sdOut = {};
  let knobBound = false;
  for (const c of L.cases()) {
    console.log(NL + '  ---- ' + c.id + '   [' + c.kind + ']');
    const clean = play(harness(null), c);
    if (clean.notStaged) { console.log('    NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
    if (clean.r.err) { console.log('    THREW — ' + clean.r.err); bad++; continue; }
    const brk = play(harness(L.knob), c);
    const restored = brk.MF[L.stamp] || 0;
    harness(null);
    if (brk.notStaged || brk.r.err) { console.log('    NOT-STAGED or THREW under the knob'); bad++; continue; }
    ran++;
    if (restored) knobBound = true;
    const o = L.outcome(clean.sd, clean);
    sdOut[c.id] = o;
    console.log('    authority outcome  ' + J(o) + '   medicham ' + J(L.outcome(clean.me, clean)) + '   |   knob ' + J(L.outcome(brk.me, brk)));
    console.log('    board              ' + boardStr(clean.boards) + '   |   knob ' + boardStr(brk.boards) + '   stamp ' + restored);
    if (process.argv.includes('--lines')) console.log('      authority lines ' + J(clean.sd.filter(l => /^\|(move|-start|-fail|-activate|-miss|-boost|-unboost|turn|switch)\|/.test(l))));
    for (const b of clean.boards) if (!b.identical) console.log('      clean b' + b.t + ' diffs ' + J(b.diffs));
    for (const b of brk.boards) if (!b.identical) console.log('      knob  b' + b.t + ' diffs ' + J(b.diffs));
    if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest || clean.sc.allyAimRefused || brk.sc.allyAimRefused) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request: ' + (clean.sc.firstMissing || brk.sc.firstMissing)); bad++; continue; }
    if (clean.cc.refused || brk.cc.refused) { console.log('    >> FIXTURE FAILED — the authority refused a choice.'); bad++; continue; }
    if (c.kind === 'control') {
      if (sdOut[c.red] && J(sdOut[c.red]) === J(o)) {
        console.log('    >> FIXTURE BLIND — the authority gives ' + c.red + ' and this control the SAME outcome.'); bad++;
      } else if (sdOut[c.red]) console.log('    >> the authority separates ' + c.red + ' from this control (' + J(sdOut[c.red]) + ' vs ' + J(o) + ').');
    }
    if (!boardEq(clean.boards)) { console.log('    >> DEFECT — the engines part on the board.'); bad++; }
    else console.log('    >> the two engines agree on the board.');
    const knobAgree = boardEq(brk.boards);
    if (c.kind === 'red') {
      if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
      else console.log('    >> and the knob parts them, which is what makes this a red arm.');
    } else if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob.'); bad++; }
  }
  if (!knobBound) {
    console.log(NL + '  KNOB ABSENT — `' + L.knob + '` set no `MEDFAILS.' + L.stamp + '` on any arm. The fix has not landed.');
    bad++;
  }
}
console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
