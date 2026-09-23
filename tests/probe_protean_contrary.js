/* probe_protean_contrary.js — FIVE ENGINE LEADS, EACH A HYPOTHESIS UNTIL THE AUTHORITY ANSWERS IT.
 * 2026-09-19, ENGINE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_protean_contrary.js [--release <id>] [--only <lead>] [--lines]
 *
 * Same three checks per lead as tests/probe_move_effect_leads.js, in this order:
 *   1. THE AUTHORITY SEPARATES each red arm from its control (else the fixture is blind: refused, not
 *      passed);
 *   2. BOTH ENGINES AGREE on every board of every arm, knob off;
 *   3. THE KNOB PARTS EVERY RED ARM AND NO CONTROL — so the probe could have seen the defect.
 * A `check` arm asserts only (2): it stages a neighbouring door of the same mechanism that was ALREADY
 * right, so a fix that breaks it is caught.
 *
 * A LEAD WHOSE AUTHORITY DERIVATION FINDS NOTHING TO STAGE IS A RESULT, NOT A FAILURE: lead `itemboost`
 * derives every legal item that raises a stat and prints the list. Under Reg M-B it is empty (FALSE);
 * under Reg M-C the terrain seeds are legal and the lead stages Contrary-seed arms (2026-09-23).
 * A lead with no knob stages `check` arms against controls: the knob clause does not apply to it.
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
if (!REL_ID) REL_ID = ER.cut('tests/probe_protean_contrary.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');

let _cur = null, _G = null;
function harness(knob) {
  const key = knob || '';
  if (_G && _cur === key) return _G;
  for (const L of LEADS) if (L.knob) delete process.env[L.knob];
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
/* THE VALIDATOR, not the raw learnset table: `dex.data.Learnsets` walks prevo entries the format's
 * TeamValidator refuses (Clefable and Blastoise read "learns Seismic Toss" there and are rejected by the
 * fixture check). One answer, the same one engine/champions_sim.js gives every other caller. */
const learns = (sp, mv) => CS.canLearn(sp, mv);
const CH = f => fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', f), 'utf8');
const SIM = f => fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, f), 'utf8');
const src = f => String(f || '').replace(/\s+/g, ' ');
const overridden = (file, ids) => ids.filter(k => new RegExp('\\n\\t' + k + ':\\s*\\{').test(CH(file)));
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const FILL = [['sylveon', '', 'Cute Charm', ['Protect']], ['snorlax', '', 'Immunity', ['Protect']]];
const J = o => JSON.stringify(o);
const P = { m: 'protect' };
const PINS = ['top-tie-first', 'middle'];

/* Count of protocol lines matching `re`, per the side-slot captured as group 1. */
const countBy = re => sd => {
  const o = {};
  for (const l of sd.map(String)) { const m = re.exec(l); if (m) o[m[1]] = (o[m[1]] || 0) + 1; }
  return o;
};
/* Net boost per `slot.stat`, off `-boost` / `-unboost` / `-clearboost` lines. A clear zeroes the slot. */
function netBoosts(sd) {
  const o = {};
  for (const raw of sd.map(String)) {
    const c = /^\|-clear(?:negative)?boost\|(p[12][ab])/.exec(raw);
    if (c) { for (const k of Object.keys(o)) if (k.startsWith(c[1] + '.')) o[k] = 0; continue; }
    if (/^\|-clearallboost/.test(raw)) { for (const k of Object.keys(o)) o[k] = 0; continue; }
    const m = /^\|-(un)?boost\|(p[12][ab])[^|]*\|(\w+)\|(\d+)/.exec(raw);
    if (m) o[m[2] + '.' + m[3]] = (o[m[2] + '.' + m[3]] || 0) + (m[1] ? -1 : 1) * (+m[4]);
  }
  return o;
}

/* =================================================================================================
 * LEAD 1 — PROTEAN CONVERTS ON A CLICK WHOSE `Try` FAILS, AND ON A CLICK THAT CALLS ANOTHER MOVE.
 *
 *   sim/battle-actions.ts:590-592 (trySpreadMoveHit) and :826-828 (tryMoveHit):
 *     singleEvent('Try', move) && singleEvent('PrepareHit', move) && runEvent('PrepareHit', pokemon)
 *   so a move whose own `onTry` fails never reaches Protean, which is hung on `onPrepareHit`.
 *   data/abilities.ts protean.onPrepareHit (no Champions override, checked below):
 *     if (move.hasBounced || move.flags['futuremove'] || move.sourceEffect === 'snatch' || move.callsMove) return;
 *
 * Arms (Greninja / Meowscarada, the format's Protean carriers, derived below):
 *   sleeptalk  — Sleep Talk on an AWAKE body: `onTry` false AND `callsMove`. Authority: no typechange.
 *   rest       — Rest at FULL HP: `onTry` returns null (`-fail|heal`). Authority: no typechange.
 *                Control: Scizor's Bullet Punch lands first, so Rest passes its Try and converts.
 *   copycat    — Copycat: `callsMove`. Authority: no typechange on the Copycat itself.
 *   Controls for sleeptalk / copycat: the same body clicks Protect, which passes and converts.
 *   check-sucker, check-counter — the ATTACK road's Try refusals, which sit above the attack-branch
 *                conversion already; staged so the fix cannot move them.
 * ================================================================================================= */
const L1 = {
  id: 'protean', knob: 'MEDI_PROTEAN_IGNORES_TRY', stamp: 'proteanIgnoresTryRestored',
  authority() {
    const a = dex.abilities.get('protean');
    const s = src(a.onPrepareHit);
    console.log('    protean.onPrepareHit       : ' + s.slice(0, 190));
    const ba = SIM('sim/battle-actions.ts');
    const order = /singleEvent\('Try', move[^;]*&&\s*this\.battle\.singleEvent\('PrepareHit'[^;]*&&\s*this\.battle\.runEvent\('PrepareHit'/.test(ba);
    console.log('    Try before PrepareHit      : ' + order + '   (sim/battle-actions.ts trySpreadMoveHit / tryMoveHit)');
    const ov = overridden('abilities.ts', ['protean', 'libero']).concat(overridden('moves.ts', ['sleeptalk', 'rest', 'copycat']));
    console.log('    champions overrides        : ' + (ov.join(',') || 'none'));
    const holders = dex.species.all().filter(legal).filter(sp => Object.values(sp.abilities).some(x => ['Protean', 'Libero'].includes(x))).map(x => x.name);
    console.log('    legal Protean/Libero bodies: ' + holders.join(', '));
    const cls = dex.moves.all().filter(legal).filter(m => m.category === 'Status' && (m.onTry || m.callsMove)).map(m => m.id + (m.callsMove ? '*' : ''));
    console.log('    CLASS — legal status moves with an onTry (* = callsMove): ' + cls.join(' '));
    const own = cls.map(x => x.replace('*', '')).filter(m => holders.some(h => learns(h, m)));
    console.log('    ...of which a Protean body learns: ' + own.join(' '));
    return !ov.length && order && /move\.callsMove\) return/.test(s);
  },
  cases() {
    const GREN = mv => ['greninja', '', 'Protean', mv];
    const MEOW = mv => ['meowscarada', '', 'Protean', mv];
    const SCIZ = ['scizor', '', 'Technician', ['Bullet Punch', 'Protect']];
    const TIN = ['tinkaton', '', 'Own Tempo', ['Protect']];
    const foes = stage([SCIZ, TIN].concat(FILL));
    const out = [];
    for (const pin of PINS) {
      const g = stage([GREN(['Sleep Talk', 'Rest', 'Counter', 'Protect']), TIN].concat(FILL));
      out.push({ id: 'sleeptalk@' + pin, kind: 'red', pin, a: g, b: foes, script: [{ p1: [{ m: 'sleeptalk' }, P], p2: [P, P] }] });
      out.push({ id: 'ctl-protect@' + pin, red: 'sleeptalk@' + pin, kind: 'control', pin, a: g, b: foes, script: [{ p1: [P, P], p2: [P, P] }] });
      out.push({ id: 'rest@' + pin, kind: 'red', pin, a: g, b: foes, script: [{ p1: [{ m: 'rest' }, P], p2: [P, P] }] });
      out.push({ id: 'ctl-rest-hurt@' + pin, red: 'rest@' + pin, kind: 'control', pin, a: g, b: foes,
                 script: [{ p1: [{ m: 'rest' }, P], p2: [{ m: 'bulletpunch', t: 0 }, P] }] });
      const mw = stage([MEOW(['Copycat', 'Sucker Punch', 'Protect']), TIN].concat(FILL));
      out.push({ id: 'copycat@' + pin, kind: 'red', pin, a: mw, b: foes, script: [{ p1: [{ m: 'copycat' }, P], p2: [P, P] }] });
      out.push({ id: 'ctl-meow-protect@' + pin, red: 'copycat@' + pin, kind: 'control', pin, a: mw, b: foes, script: [{ p1: [P, P], p2: [P, P] }] });
      out.push({ id: 'check-sucker@' + pin, kind: 'check', pin, a: mw, b: foes, script: [{ p1: [{ m: 'suckerpunch', t: 0 }, P], p2: [P, P] }] });
      out.push({ id: 'check-counter@' + pin, kind: 'check', pin, a: g, b: foes, script: [{ p1: [{ m: 'counter', t: 0 }, P], p2: [P, P] }] });
    }
    return out;
  },
  outcome: countBy(/^\|-start\|(p[12][ab])[^|]*\|typechange/),
};

/* =================================================================================================
 * LEAD 2 — CLEAR SMOG CLEARS THE TARGET'S STAT STAGES.
 *
 *   data/moves.ts clearsmog.onHit(target) { target.clearBoosts(); this.add('-clearboost', target); }
 *   `onHit` is `runMoveEffects` (data/mods/champions/scripts.ts:375), after the damage and BEFORE the
 *   secondaries and the `DamagingHit` event. A hit absorbed by a substitute runs no `onHit`.
 *
 * Red: Snorlax Curses on turn 1 (+1 atk/def, -1 spe), Gengar Clear Smogs it on turn 2 while it Endures.
 * Control: the same, Gengar Sludge Bombs instead — the stages must stay.
 * check-sub: Snorlax sets a Substitute first; the Clear Smog meets the doll.
 * ================================================================================================= */
const L2 = {
  /* `-clearboost` is not in the compared stream (game_differential's sdStream drops it), so the
   * authority's outcome is read off its RAW log; the board is the comparison either way. */
  rawAuthority: true,
  id: 'clearsmog', knob: 'MEDI_CLEAR_SMOG_KEEPS_BOOSTS', stamp: 'clearSmogKeepsBoostsRestored',
  authority() {
    const m = dex.moves.get('clearsmog');
    const s = src(m.onHit);
    console.log('    clearsmog.onHit            : ' + s);
    const ov = overridden('moves.ts', ['clearsmog']);
    console.log('    champions overrides        : ' + (ov.join(',') || 'none') + '   secondaries ' + J(m.secondaries || null));
    const cls = dex.moves.all().filter(legal).filter(x => /clearBoosts\(\)/.test(src(x.onHit) + src(x.onHitField)))
      .map(x => x.id + '(' + x.category + ')');
    console.log('    CLASS — legal moves that clearBoosts: ' + cls.join(' '));
    return !ov.length && /target\.clearBoosts\(\)/.test(s);
  },
  cases() {
    const snor = mv => stage([['snorlax', '', 'Immunity', mv], ['tinkaton', '', 'Own Tempo', ['Protect']]].concat(FILL));
    const gen = stage([['gengar', '', 'Cursed Body', ['Clear Smog', 'Sludge Bomb', 'Protect']], ['tinkaton', '', 'Own Tempo', ['Protect']]].concat(FILL));
    const out = [];
    for (const pin of PINS) {
      const b = snor(['Curse', 'Endure', 'Substitute', 'Protect']);
      out.push({ id: 'smog@' + pin, kind: 'red', pin, a: gen, b,
                 script: [{ p1: [P, P], p2: [{ m: 'curse' }, P] }, { p1: [{ m: 'clearsmog', t: 0 }, P], p2: [{ m: 'endure' }, P] }] });
      out.push({ id: 'ctl-sludge@' + pin, red: 'smog@' + pin, kind: 'control', pin, a: gen, b,
                 script: [{ p1: [P, P], p2: [{ m: 'curse' }, P] }, { p1: [{ m: 'sludgebomb', t: 0 }, P], p2: [{ m: 'endure' }, P] }] });
      out.push({ id: 'check-sub@' + pin, kind: 'check', pin, a: gen, b,
                 script: [{ p1: [P, P], p2: [{ m: 'substitute' }, P] }, { p1: [P, P], p2: [{ m: 'curse' }, P] },
                          { p1: [{ m: 'clearsmog', t: 0 }, P], p2: [{ m: 'endure' }, P] }] });
    }
    return out;
  },
  outcome: netBoosts,
};

/* =================================================================================================
 * LEAD 3 — STAT-RAISING ITEMS AND CONTRARY. AUTHORITY-ONLY: derive every legal item whose handler or
 * `boosts` field raises a stat. If the list is empty there is nothing a Contrary holder could be
 * handed, and the lead is FALSE for this regulation. No arm is staged.
 * ================================================================================================= */
const L3 = {
  id: 'itemboost', knob: null, stamp: null,
  authority() {
    const L = dex.items.all().filter(legal);
    const hit = [];
    for (const it of L) {
      let s = '';
      for (const k of Object.getOwnPropertyNames(it)) if (typeof it[k] === 'function') s += ' ' + src(it[k]);
      if (it.boosts || /\bboost\(/.test(s)) hit.push(it.id + (it.boosts ? J(it.boosts) : ''));
    }
    console.log('    legal items: ' + L.length + '   of which raise a stat via boost()/boosts: ' + (hit.join(' ') || 'NONE'));
    const past = ['weaknesspolicy', 'electricseed', 'liechiberry', 'throatspray', 'adrenalineorb', 'roomservice']
      .map(id => id + '=' + dex.items.get(id).isNonstandard).join(' ');
    console.log('    for the record, the usual suspects: ' + past);
    const ov = overridden('items.ts', hit.map(h => h.replace(/\{.*$/, ''))).concat(overridden('abilities.ts', ['contrary']));
    console.log('    champions overrides        : ' + (ov.join(',') || 'none'));
    this.cleared = !hit.length;
    return !ov.length;
  },
  /* 2026-09-23. Reg M-B carries no stat-raising item, so the lead is FALSE there and stages nothing.
   * Reg M-C makes the four terrain seeds legal (derived above), so the lead is LIVE there and was
   * reported `NOT STAGED` from the 0.62.0 engine on. A seed's `boosts` go through `boost()` with the
   * item as the effect, so Contrary's onChangeBoost inverts them: a Contrary holder's +1 is a -1.
   * Two roads, each a `check` (the engines must agree) against the same Malamar on Suction Cups:
   *   terrain — Pincurchin (Electric Surge) leads beside Malamar @ Electric Seed: `onTerrainChange`.
   *   switchin — Indeedee (Psychic Surge) leads; Malamar @ Psychic Seed switches in turn 1: `onStart`.
   * Staged only for a seed the regulation carries, so Reg M-B keeps its FALSE verdict. */
  cases() {
    const out = [];
    const OPP = ['corviknight', '', 'Pressure', ['Protect']];
    for (const pin of PINS) {
      if (legal(dex.items.get('electricseed'))) {
        for (const [red, ab] of [[true, 'Contrary'], [false, 'Suction Cups']]) {
          const id = 'eseed-terrain@' + pin;
          out.push({ id: (red ? '' : 'ctl-') + id, red: red ? undefined : id, kind: red ? 'check' : 'control', pin,
                     a: stage([['malamar', 'Electric Seed', ab, ['Protect']], ['tinkaton', '', 'Own Tempo', ['Protect']]].concat(FILL)),
                     b: stage([['pincurchin', '', 'Electric Surge', ['Protect']], OPP].concat(FILL)),
                     script: [{ p1: [P, P], p2: [P, P] }] });
        }
      }
      if (legal(dex.items.get('psychicseed'))) {
        for (const [red, ab] of [[true, 'Contrary'], [false, 'Suction Cups']]) {
          const id = 'pseed-switchin@' + pin;
          out.push({ id: (red ? '' : 'ctl-') + id, red: red ? undefined : id, kind: red ? 'check' : 'control', pin,
                     a: stage([['tinkaton', '', 'Own Tempo', ['Protect']], ['sylveon', '', 'Cute Charm', ['Protect']],
                               ['malamar', 'Psychic Seed', ab, ['Protect']], ['snorlax', '', 'Immunity', ['Protect']]]),
                     b: stage([['indeedee', '', 'Psychic Surge', ['Protect']], OPP].concat(FILL)),
                     script: [{ p1: [{ sw: 'malamar' }, P], p2: [P, P] }] });
        }
      }
    }
    return out;
  },
  outcome: sd => { const o = netBoosts(sd); const r = {}; for (const k in o) if (k.startsWith('p1')) r[k] = o[k]; return r; },
};

/* =================================================================================================
 * LEAD 4 — A MOLD BREAKER SOURCE SUPPRESSES THE TARGET'S CONTRARY ON THE BOOST ROAD.
 *
 *   data/abilities.ts contrary: `flags: { breakable: 1 }`, onChangeBoost inverts the table.
 *   sim/battle.ts runEvent skips a `breakable` ability handler when `suppressingAbility(holder)` —
 *   the active move carries `ignoreAbility` (Mold Breaker's onModifyMove) and the holder is not the
 *   mover. So a Mold Breaker's drop lands AS A DROP on a Contrary target.
 *
 * Roads staged, each red against the same species on its non-breaker ability:
 *   secondary — Excadrill (Mold Breaker | Sand Rush) Bulldoze into Malamar (Contrary): spe.
 *   affect    — Tinkaton (Mold Breaker | Own Tempo) Fake Tears into Malamar: spd.
 *   pivot     — Pangoro (Mold Breaker | Iron Fist) Parting Shot into Malamar: atk/spa.
 * ================================================================================================= */
const L4 = {
  id: 'moldcontrary', knob: 'MEDI_CONTRARY_UNBROKEN', stamp: 'contraryUnbrokenRestored',
  authority() {
    const c = dex.abilities.get('contrary');
    console.log('    contrary.flags             : ' + J(c.flags) + '   onChangeBoost ' + src(c.onChangeBoost).slice(0, 90));
    console.log('    moldbreaker.onModifyMove   : ' + src(dex.abilities.get('moldbreaker').onModifyMove));
    const ov = overridden('abilities.ts', ['contrary', 'moldbreaker']);
    console.log('    champions overrides        : ' + (ov.join(',') || 'none'));
    const b = SIM('sim/battle.ts');
    const gate = /flags\['breakable'\][^\n]*suppressingAbility/.test(b) || /breakable[\s\S]{0,120}suppressingAbility/.test(b);
    console.log('    runEvent breakable gate    : ' + gate);
    return !ov.length && c.flags.breakable && gate;
  },
  cases() {
    const MAL = stage([['malamar', '', 'Contrary', ['Endure', 'Protect']], ['tinkaton', '', 'Own Tempo', ['Protect']]].concat(FILL));
    const TIN2 = ['corviknight', '', 'Pressure', ['Protect']];
    const out = [];
    for (const pin of PINS) {
      /* Bulldoze, not Rock Tomb: 100% accurate, so the top accuracy corner cannot miss it away (Rock Tomb
       * read {} on both engines at top-tie-first). The partner is Corviknight, immune to the spread. */
      for (const [red, ab] of [[true, 'Mold Breaker'], [false, 'Sand Rush']]) {
        out.push({ id: (red ? '' : 'ctl-') + 'bulldoze@' + pin, red: red ? undefined : 'bulldoze@' + pin, kind: red ? 'red' : 'control', pin,
                   a: stage([['excadrill', '', ab, ['Bulldoze', 'Protect']], TIN2].concat(FILL)), b: MAL,
                   script: [{ p1: [{ m: 'bulldoze' }, P], p2: [{ m: 'endure' }, P] }] });
      }
      for (const [red, ab] of [[true, 'Mold Breaker'], [false, 'Own Tempo']]) {
        out.push({ id: (red ? '' : 'ctl-') + 'faketears@' + pin, red: red ? undefined : 'faketears@' + pin, kind: red ? 'red' : 'control', pin,
                   a: stage([['tinkaton', '', ab, ['Fake Tears', 'Protect']], TIN2].concat(FILL)), b: MAL,
                   script: [{ p1: [{ m: 'faketears', t: 0 }, P], p2: [{ m: 'endure' }, P] }] });
      }
      /* THE PIVOT ROAD: Parting Shot's -1/-1 runs through its own branch, not `affect`. Pangoro
       * (Mold Breaker | Iron Fist); the bench body is what the pivot brings in. */
      for (const [red, ab] of [[true, 'Mold Breaker'], [false, 'Iron Fist']]) {
        out.push({ id: (red ? '' : 'ctl-') + 'partingshot@' + pin, red: red ? undefined : 'partingshot@' + pin, kind: red ? 'red' : 'control', pin,
                   a: stage([['pangoro', '', ab, ['Parting Shot', 'Protect']], TIN2].concat(FILL)), b: MAL,
                   script: [{ p1: [{ m: 'partingshot', t: 0 }, P], p2: [{ m: 'endure' }, P] }] });
      }
    }
    return out;
  },
  outcome: sd => { const o = netBoosts(sd); const r = {}; for (const k in o) if (k.startsWith('p2a.')) r[k] = o[k]; return r; },
};

/* =================================================================================================
 * LEAD 5 — CUD CHEW'S PENDING BERRY DOES NOT SURVIVE A SWITCH.
 *
 *   data/abilities.ts cudchew: `onEatItem` writes `this.effectState.berry` + `counter`, `onResidual`
 *   spends it. `effectState` here is the ABILITY's state, which `switchIn` rebuilds
 *   (sim/battle-actions.ts:142, `pokemon.abilityState = this.battle.initEffectState(...)`). So a body
 *   that leaves before its second helping comes back with nothing pending.
 *
 * Turn 1: three Seismic Tosses (two foes and the partner) put Farigiraf (Cud Chew, Sitrus) under half;
 * it eats. Red: turn 2 it switches out, turn 3 back in. Control: it stays in on turn 2 and re-eats at
 * that turn's end on both engines.
 * ================================================================================================= */
const L5 = {
  id: 'cudchew', knob: 'MEDI_CUD_SURVIVES_SWITCH', stamp: 'cudSurvivesSwitchRestored',
  authority() {
    const a = dex.abilities.get('cudchew');
    console.log('    cudchew.onEatItem          : ' + src(a.onEatItem).slice(0, 170));
    const ba = SIM('sim/battle-actions.ts');
    const reset = /pokemon\.abilityState = this\.battle\.initEffectState\(\{ id: pokemon\.ability/.test(ba);
    console.log('    switchIn rebuilds abilityState: ' + reset);
    const ov = overridden('abilities.ts', ['cudchew']);
    console.log('    champions overrides        : ' + (ov.join(',') || 'none'));
    return !ov.length && reset && /this\.effectState\.berry = item/.test(src(a.onEatItem));
  },
  cases() {
    const a = stage([['farigiraf', 'Sitrus Berry', 'Cud Chew', ['Calm Mind', 'Protect']], ['machamp', '', 'Guts', ['Seismic Toss', 'Protect']],
                     ['corviknight', '', 'Pressure', ['Protect']], ['snorlax', '', 'Immunity', ['Protect']]]);
    const b = stage([['pangoro', '', 'Iron Fist', ['Seismic Toss', 'Protect']], ['passimian', '', 'Receiver', ['Seismic Toss', 'Protect']]].concat(FILL));
    const T = { m: 'seismictoss', t: 0 };
    const t1 = { p1: [{ m: 'calmmind' }, { m: 'seismictoss', ally: true }], p2: [T, T] };
    const out = [];
    for (const pin of PINS) {
      out.push({ id: 'benched@' + pin, kind: 'red', pin, a, b,
                 script: [t1, { p1: [{ sw: 'corviknight' }, P], p2: [P, P] }, { p1: [{ sw: 'farigiraf' }, P], p2: [P, P] }] });
      out.push({ id: 'ctl-stays@' + pin, red: 'benched@' + pin, kind: 'control', pin, a, b,
                 script: [t1, { p1: [{ m: 'calmmind' }, P], p2: [P, P] }, { p1: [{ m: 'calmmind' }, P], p2: [P, P] }] });
    }
    return out;
  },
  outcome: countBy(/^\|-activate\|(p[12][ab])[^|]*\|ability: Cud Chew/),
};

/* =================================================================================================
 * LEAD 6 (FOUND STAGING LEAD 1) — COPYCAT REFUSES A `failcopycat` LAST MOVE.
 *
 *   data/moves.ts copycat.onHit: `let move = this.lastMove; if (!move) return; ...
 *     if (move.flags['failcopycat'] || move.isZ || move.isMax) return false; this.actions.useMove(move.id, pokemon);`
 *   Protect carries `failcopycat`. No Champions override of copycat (checked below).
 *
 * The engine asked a tag named `noCopycat` that no derivation writes, so the copy went through. Red: the
 * foe's Protect (+4) is the last move when Meowscarada (Overgrow, so Protean plays no part) Copycats, and
 * Snorlax's slower Body Slam then lands on it — on the authority. A copied Protect would block it.
 * Control: Meowscarada clicks Protect itself, which does block the Body Slam on both engines.
 * ================================================================================================= */
const L6 = {
  id: 'copycat', knob: 'MEDI_COPYCAT_IGNORES_FAILCOPYCAT', stamp: 'copycatRefusalIgnoredRestored',
  authority() {
    const s = src(dex.moves.get('copycat').onHit);
    console.log('    copycat.onHit              : ' + s.slice(0, 200));
    const ov = overridden('moves.ts', ['copycat']);
    console.log('    champions overrides        : ' + (ov.join(',') || 'none') + '   protect.flags ' + J(dex.moves.get('protect').flags));
    const fc = dex.moves.all().filter(legal).filter(m => m.flags.failcopycat).map(m => m.id);
    console.log('    legal failcopycat moves (' + fc.length + '): ' + fc.join(' '));
    return !ov.length && /flags\["failcopycat"\]/.test(s) && dex.moves.get('protect').flags.failcopycat;
  },
  cases() {
    const a = stage([['meowscarada', '', 'Overgrow', ['Copycat', 'Protect']], ['tinkaton', '', 'Own Tempo', ['Protect']]].concat(FILL));
    const b = stage([['scizor', '', 'Technician', ['Protect']], ['snorlax', '', 'Immunity', ['Body Slam', 'Protect']]].concat(FILL));
    const slam = { m: 'bodyslam', t: 0 };
    const out = [];
    for (const pin of PINS) {
      out.push({ id: 'copy-protect@' + pin, kind: 'red', pin, a, b, script: [{ p1: [{ m: 'copycat' }, P], p2: [P, slam] }] });
      out.push({ id: 'ctl-own-protect@' + pin, red: 'copy-protect@' + pin, kind: 'control', pin, a, b, script: [{ p1: [P, P], p2: [P, slam] }] });
    }
    return out;
  },
  outcome: countBy(/^\|-damage\|(p1a)[^|]*\|/),
};

const LEADS = [L1, L2, L3, L4, L5, L6];

/* ---- LEGALITY, DERIVED ------------------------------------------------------------------------- */
let illegal = 0;
for (const L of LEADS) for (const c of L.cases()) for (const row of c.a.concat(c.b)) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' / ' + row.ability); illegal++; }
  if (row.item && !legal(dex.items.get(row.item))) { console.log('ILLEGAL FIXTURE  item ' + row.item); illegal++; }
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
  const r = G.playGame(a, b, 'directed', 'probe_protean_contrary :: ' + c.id, {
    script: c.script, arm,
    onBoundary: (snap, t) => boards.push({ t, identical: !!snap.identical,
                                           diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) }),
  });
  const raw = G.lastSdLog().map(String);
  const sd = G.sdStream(raw).map(String);
  const me = (r.mediTrace || []).map(String);
  return { r, boards, sd, raw, me, sc: G.scriptCounters(), cc: G.choiceCounters(), MF: globalThis.MEDFAILS || {} };
}
const boardEq = rows => rows.length > 0 && rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');

let bad = 0, ran = 0;
const verdict = {};
for (const L of LEADS) {
  if (ONLY && L.id !== ONLY) continue;
  console.log(NL + '################################################################');
  console.log('  LEAD ' + L.id + '   knob ' + (L.knob || '(none — authority-only)'));
  console.log('  THE AUTHORITY, RE-DERIVED THIS RUN:');
  if (!L.authority()) { console.log('  NOT RUN — the format no longer carries the rule this lead is about. A finding, not a pass.'); bad++; continue; }
  const cases = L.cases();
  if (!cases.length) {
    verdict[L.id] = L.cleared ? 'FALSE — nothing in the regulation can reach it' : 'NOT STAGED';
    if (!L.cleared) bad++;
    console.log('  >> ' + verdict[L.id]);
    continue;
  }
  const sdOut = {};
  let knobBound = false;
  for (const c of cases) {
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
    const o = L.outcome(L.rawAuthority ? clean.raw : clean.sd, clean);
    sdOut[c.id] = o;
    console.log('    authority outcome  ' + J(o) + '   medicham ' + J(L.outcome(clean.me, clean)) + '   |   knob ' + J(L.outcome(brk.me, brk)));
    console.log('    board              ' + boardStr(clean.boards) + '   |   knob ' + boardStr(brk.boards) + '   stamp ' + restored);
    if (process.argv.includes('--lines')) console.log('      authority lines ' + J(clean.sd.filter(l => /^\|(move|-start|-fail|-activate|-miss|-boost|-unboost|-clearboost|-enditem|-heal|-damage|turn|switch)\|/.test(l))));
    if (process.argv.includes('--lines')) console.log('      medicham lines  ' + J(clean.me.filter(l => /^\|(move|-start|-fail|-activate|-miss|-boost|-unboost|-clearboost|-enditem|-heal|turn|switch)\|/.test(l))));
    for (const b of clean.boards) if (!b.identical) console.log('      clean b' + b.t + ' diffs ' + J(b.diffs));
    for (const b of brk.boards) if (!b.identical && c.kind !== 'check') console.log('      knob  b' + b.t + ' diffs ' + J(b.diffs));
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
    } else if (c.kind === 'control' && !knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob.'); bad++; }
  }
  if (!knobBound && L.knob) {
    console.log(NL + '  KNOB ABSENT — `' + L.knob + '` set no `MEDFAILS.' + L.stamp + '` on any arm. The fix has not landed.');
    bad++;
  }
}
console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
for (const k in verdict) console.log('lead ' + k + ': ' + verdict[k]);
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
