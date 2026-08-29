/* probe_partingshot_conditional.js — ROADMAP #531. THE PIVOT IS CONDITIONAL ON THE DROP LANDING.
 *
 *   SHOWDOWN_PATH=... node tests/probe_partingshot_conditional.js
 *   SHOWDOWN_PATH=... node tests/probe_partingshot_conditional.js --only clearbody
 *
 * =============================================================================================
 * WHAT THE AUTHORITY DOES, READ WHOLE AND FROM THE MOD FIRST
 *
 * `data/mods/champions/moves.ts` does not mention `partingshot` at all (grep: 0 hits), and neither
 * `abilities.ts` nor `scripts.ts` in the mod touches `selfSwitch`, `onTryBoost` or `boost(`. So
 * mainline applies and `data/moves.ts:13168-13187` is the whole rule:
 *
 *     onHit(target, source, move) {
 *       const success = this.boost({ atk: -1, spa: -1 }, target, source);
 *       if (!success && !target.hasAbility('mirrorarmor')) { delete move.selfSwitch; }
 *     },
 *     selfSwitch: true,
 *
 * `Battle#boost` (sim/battle.ts:2017) decides `success`, and the crux of this defect is EXACTLY what
 * it counts as one. Read at the lines rather than recalled:
 *
 *   - `success` starts `null` and is set true the first time a stat's APPLIED DELTA is non-zero;
 *   - `getCappedBoost` runs BEFORE `TryBoost`, so a stat already at -6 arrives at every ability
 *     handler as `0` and no handler ever sees it as a drop;
 *   - a PARTIAL application is a SUCCESS. One stat refused and the other landed returns true, and
 *     the user pivots;
 *   - a REFLECTED drop is NOT a success on the target: Mirror Armor DELETES the entry, so the loop
 *     never runs and `success` stays `null`. That is the entire reason the move needs its
 *     `!target.hasAbility('mirrorarmor')` clause — without it, the one ability that guarantees the
 *     drop went somewhere would be the one that cancels the pivot.
 *
 * SO THERE ARE TWO DOORS TO A CANCELLED PIVOT AND THEY ARE STAGED SEPARATELY: an ABILITY that
 * refuses both stats, and a TARGET ALREADY AT THE FLOOR on both stats. And there is a third arm
 * that is neither and is red for the same reason — one stat refused by an ability while the other
 * sits at the floor.
 *
 * =============================================================================================
 * ENUMERATED FROM THE FORMAT, NOT INHERITED FROM THE CARD
 *
 * Printed on every run. The prior card named TWO abilities; the derivation is wider and narrower at
 * once, and both directions matter:
 *
 *   refuses BOTH atk and spa from a foe  -> Clear Body, White Smoke, Flower Veil (a Grass ALLY only)
 *                                           and Mirror Armor, which is the NAMED EXCEPTION
 *   refuses ONE of the two               -> Hyper Cutter (atk). The pivot SURVIVES this, and an arm
 *                                           says so, because a fix that cancels on "a stat was
 *                                           refused" breaks a board that is correct today
 *   Full Metal Body                       -> ZERO legal carriers in this regulation. Named by the
 *                                           handler read, absent from the format, and not staged
 *   the Intimidate-gated five             -> Inner Focus / Oblivious / Own Tempo / Scrappy / Guard
 *                                           Dog test `effect.name === 'Intimidate'` and are inert here
 *
 * And on the move axis: SEVEN legal moves carry `selfSwitch` and exactly ONE is conditional. `grep
 * -n "delete move.selfSwitch" data/moves.ts` returns one hit in the whole dex. Chilly Reception is
 * the other legal STATUS pivot and its switch is unconditional, so it is the over-fire control on
 * that axis; a bare voluntary switch is the control on the third.
 *
 * =============================================================================================
 * THE KNOB
 *
 * `MEDI_PIVOT_UNCONDITIONAL=1` restores the shipped engine: the pivot fires whatever the drop did.
 * Every red arm must part under it and every control must not move, which is what makes the change
 * attributable rather than merely present. The knob's load-time stamp
 * (`MEDFAILS.pivotUnconditionalRestored`) is asserted absent-clean / present-on-knob, so an arm
 * cannot pass because the environment variable never reached the module the driver played.
 *
 * IT WRITES NO ARTIFACT and runs one process, over a frozen release.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--state')) process.argv.push('--state');

const ARG = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = '\n';

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) REL_ID = ER.cut('tests/probe_partingshot_conditional.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_PIVOT_UNCONDITIONAL';

const BS = require(D('engine', 'board_state.js'));
const CS = require(D('engine', 'champions_sim.js'));

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- LEGALITY AND MEMBERSHIP, DERIVED AT RUN TIME AND PRINTED --------------------------------- */
const {Dex} = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat('gen9championsvgc2026regmb');
const legalM = m => m.exists && !m.isNonstandard;

/* every legal move carrying selfSwitch, and whether its own handler can take it away again */
const PIVOTS = [];
for (const m of DEX.moves.all()) {
  if (!legalM(m) || !m.selfSwitch) continue;
  const src = String(m.onHit || '') + String(m.onTryHit || '') + String(m.onAfterHit || '');
  PIVOTS.push({ id: m.id, selfSwitch: JSON.stringify(m.selfSwitch),
                conditional: /delete\s+move\.selfSwitch/.test(src.replace(/\s+/g, ' ')) });
}
/* every legal ability with a boost-refusing handler, with the stats it actually covers, so the
 * "refuses a stat drop" population is a derivation rather than the card's two names */
const REFUSERS = [];
/* MUST READ 0. A legality lookup that threw and was absorbed is a membership table that quietly
 * stopped being about this format. */
let carrierThrew = 0;
for (const a of DEX.abilities.all()) {
  if (!a.exists || a.isNonstandard) continue;
  const src = (String(a.onTryBoost || '') + String(a.onAllyTryBoost || '')).replace(/\s+/g, ' ');
  if (!src) continue;
  const intim = /effect\.name === ['"]Intimidate['"]/.test(src);
  const all = /for \(i in boost\)|for \(b in boost\)/.test(src);
  const stats = all ? 'all stats'
    : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']
      .filter(s => new RegExp('boost\\.' + s).test(src)).join('+');
  const touchesPS = !intim && (all || /atk|spa/.test(stats));
  /* THE CARRIER LOOKUP MAY NOT SWALLOW ITS REASON. `['THREW']` alone reads exactly like an ability
   * with one oddly-named carrier, which is the shape this whole file exists to avoid; the message
   * goes into the printed row AND onto stderr, and the count is asserted at zero below. */
  let carriers = [];
  try { carriers = CS.abilityCarriers(a.id); }
  catch (e) {
    carriers = ['THREW: ' + (e && e.message ? e.message : String(e))];
    carrierThrew++;
    console.error('abilityCarriers(' + a.id + ') threw: ' + (e && e.stack ? e.stack : e));
  }
  REFUSERS.push({ id: a.id, stats, intim, ally: !!a.onAllyTryBoost,
                  reflects: /this\.boost\([^)]*source/.test(src),
                  touchesPS, carriers });
}

/* ---- THE BODIES ------------------------------------------------------------------------------- */
const mon = (species, ability, moves) => ({ species, item: '', ability, moves });
const FILL = ['Protect', 'Iron Defense', 'Amnesia'];

/* Incineroar runs BLAZE and not Intimidate on purpose: an entry drop into the same refusing ability
 * would be a SECOND reason for every boost on the board and no arm could say which it had found. */
const SHOOTER = mon('incineroar', 'Blaze', ['Parting Shot'].concat(FILL));
const A_BENCH = [mon('milotic', 'Marvel Scale', FILL),
                 mon('clefable', 'Unaware', FILL),
                 mon('garchomp', 'Rough Skin', FILL)];
const TEAM_A = [SHOOTER].concat(A_BENCH);

/* p2 slot 0 is the knob. Its clicks are SELF boosts, invisible to every refusing ability by their
 * own `target === source` early return, and never Protect on a turn something is aimed at it. */
const foeTeam = (species, ability, partner) => [
  mon(species, ability, FILL),
  /* THE DEFAULT PARTNER IS NOT SNORLAX AND THAT IS NOT COSMETIC: the floor arms use a Snorlax as
   * the TARGET, and a fixture holding two of a species collides on `_switchKey` and on every
   * by-name read this file makes. Marvel Scale has no opinion about anything staged here. */
  partner || mon('milotic', 'Marvel Scale', FILL),
  mon('toxapex', 'Regenerator', FILL),
  mon('weavile', 'Pressure', FILL),
];

const PS = { m: 'partingshot', t: 0 }, P = { m: 'protect' }, ID = { m: 'irondefense' },
      AM = { m: 'amnesia' }, CH = { m: 'charm', t: 0 }, EI = { m: 'eerieimpulse', t: 0 };

/* THE ABILITY DOOR — two turns. Turn 2 is the negative: nobody clicks a pivot, so nobody may leave
 * and nothing may be refused. p1b's two clicks differ so no Protect is ever consecutive (the stall
 * counter is a DIE and a die in a fixture is a coin toss dressed as a result). */
const SCRIPT_A = [
  { p1: [PS, P], p2: [ID, ID] },
  { p1: [P, ID], p2: [AM, AM] },
];
/* THE MOVE-AXIS CONTROL — the format's other legal status pivot, whose selfSwitch nothing deletes. */
const SCRIPT_C = [
  { p1: [{ m: 'chillyreception' }, P], p2: [ID, ID] },
  { p1: [P, ID], p2: [AM, AM] },
];
/* THE SWITCH-AXIS CONTROL — a bare voluntary switch reaches the same block with no move attached. */
const SCRIPT_V = [
  { p1: [{ sw: 'clefable' }, P], p2: [ID, ID] },
  { p1: [P, ID], p2: [AM, AM] },
];

/* THE FLOOR DOOR — five turns, and the shooter is on the BENCH for the first three so it never has
 * to click a filler that could fail or draw. Charm is -2 atk and Eerie Impulse is -2 spa (read off
 * the dex, printed below), so three turns is exactly -6 on whichever stat the arm is driving. */
const TEAM_F = [
  mon('clefable', 'Unaware', ['Charm'].concat(FILL)),
  mon('jolteon', 'Volt Absorb', ['Eerie Impulse'].concat(FILL)),
  SHOOTER,
  mon('garchomp', 'Rough Skin', FILL),
];
const floorScript = (atk, spa) => {
  const a = atk ? CH : AM, b = spa ? EI : AM;
  return [
    { p1: [a, b], p2: [ID, ID] },
    { p1: [a, b], p2: [AM, AM] },
    { p1: [a, b], p2: [ID, ID] },
    { p1: [{ sw: 'incineroar' }, P], p2: [AM, AM] },
    { p1: [PS, ID], p2: [ID, ID] },
  ];
};

/* ---- THE ARMS ---------------------------------------------------------------------------------
 *
 * `red` — the authority refuses the pivot and the shipped engine takes it. `ctl` — the authority
 * takes the pivot and it must keep taking it, which is the half that stops a fix from stranding
 * bodies that are correct today. Every red arm is paired with a control on the SAME BODY, so no
 * verdict rests on a species difference. */
const ARMS = [
  /* ---- the ability door --------------------------------------------------------------------- */
  { id: 'clearbody', kind: 'red', team: TEAM_A, script: SCRIPT_A, foe: ['garganacl', 'Clear Body'],
    what: 'BOTH stats refused outright. The authority keeps Incineroar standing.' },
  { id: 'sturdy', kind: 'ctl', team: TEAM_A, script: SCRIPT_A, foe: ['garganacl', 'Sturdy'],
    what: 'THE KNOB CLEARED — the SAME Garganacl with an ability that has no opinion about drops.' },
  { id: 'whitesmoke', kind: 'red', team: TEAM_A, script: SCRIPT_A, foe: ['torkoal', 'White Smoke'],
    what: 'THE SECOND full refuser in the format, on a different body, to prove the rule is not '
        + 'Clear Body\'s.' },
  { id: 'shellarmor', kind: 'ctl', team: TEAM_A, script: SCRIPT_A, foe: ['torkoal', 'Shell Armor'],
    what: 'THE KNOB CLEARED for the arm above — the SAME Torkoal.' },
  { id: 'mirror', kind: 'ctl', kept: 1, team: TEAM_A, script: SCRIPT_A, foe: ['corviknight', 'Mirror Armor'],
    what: 'THE NAMED EXCEPTION. The drop lands on NOBODY and the user pivots anyway. This is the arm '
        + 'that proves the fix did not simply gate everything.' },
  { id: 'pressure', kind: 'ctl', team: TEAM_A, script: SCRIPT_A, foe: ['corviknight', 'Pressure'],
    what: 'THE KNOB CLEARED for the arm above — the SAME Corviknight.' },
  { id: 'hypercutter', kind: 'ctl', team: TEAM_A, script: SCRIPT_A, foe: ['gliscor', 'Hyper Cutter'],
    what: 'PARTIAL REFUSAL. Attack is refused, Special Attack lands, and `Battle#boost` calls that a '
        + 'SUCCESS — so the pivot happens. A fix keyed on "a stat was refused" breaks here.' },
  { id: 'sandveil', kind: 'ctl', team: TEAM_A, script: SCRIPT_A, foe: ['gliscor', 'Sand Veil'],
    what: 'THE KNOB CLEARED for the arm above — the SAME Gliscor, both stats land.' },
  { id: 'contrary', kind: 'ctl', team: TEAM_A, script: SCRIPT_A, foe: ['malamar', 'Contrary'],
    what: 'THE DROP INVERTS to +1/+1. Something landed, so the pivot stands — the other way a '
        + 'refusal-shaped fix could over-fire.' },
  { id: 'flowerveil', kind: 'red', team: TEAM_A, script: SCRIPT_A, foe: ['torterra', 'Shell Armor'],
    partner: ['florges', 'Flower Veil'],
    what: 'THE ALLY DOOR. The refusal is on the body BESIDE the target and covers Grass types only, '
        + 'so the target is a Grass Torterra and the holder is a Fairy Florges that does not cover '
        + 'itself.' },
  { id: 'symbiosis', kind: 'ctl', team: TEAM_A, script: SCRIPT_A, foe: ['torterra', 'Shell Armor'],
    partner: ['florges', 'Symbiosis'],
    what: 'THE KNOB CLEARED for the arm above — the SAME Florges beside the SAME Torterra.' },

  /* ---- the move axis and the switch axis ------------------------------------------------------ */
  { id: 'chilly', kind: 'ctl', shooter: 'slowking',
    team: [mon('slowking', 'Own Tempo', ['Chilly Reception'].concat(FILL))]
      .concat(A_BENCH), script: SCRIPT_C, foe: ['garganacl', 'Clear Body'],
    what: 'THE OVER-FIRE CONTROL ON THE MOVE AXIS. Chilly Reception is the format\'s other legal '
        + 'status pivot, its selfSwitch is unconditional, and it must still leave into the same '
        + 'Clear Body that refuses Parting Shot.' },
  { id: 'voluntary', kind: 'ctl', team: TEAM_A, script: SCRIPT_V, foe: ['garganacl', 'Clear Body'],
    what: 'THE OVER-FIRE CONTROL ON THE SWITCH AXIS. A bare switch reaches the same block with no '
        + 'move attached and nothing may gate it.' },

  /* ---- the floor door ------------------------------------------------------------------------- */
  { id: 'floorboth', kind: 'red', team: TEAM_F, script: floorScript(true, true),
    foe: ['snorlax', 'Thick Fat'],
    what: 'NO ABILITY ANYWHERE. Attack AND Special Attack are driven to -6 by Charm and Eerie '
        + 'Impulse, so both deltas clamp to zero and `success` stays null.' },
  { id: 'flooratk', kind: 'ctl', team: TEAM_F, script: floorScript(true, false),
    foe: ['snorlax', 'Thick Fat'],
    what: 'ONE STAT AT THE FLOOR. Attack cannot move, Special Attack can — a partial success, so the '
        + 'pivot stands.' },
  { id: 'floorspa', kind: 'ctl', team: TEAM_F, script: floorScript(false, true),
    foe: ['snorlax', 'Thick Fat'],
    what: 'THE SAME ARM ON THE OTHER STAT.' },
  { id: 'floornone', kind: 'ctl', team: TEAM_F, script: floorScript(false, false),
    foe: ['snorlax', 'Thick Fat'],
    what: 'THE FIVE-TURN FIXTURE WITH THE DRIVING TURNED OFF — both droppers click Amnesia instead. '
        + 'If this arm is not clean, nothing measured on the two above is about the floor.' },
  { id: 'floormix', kind: 'red', team: TEAM_F, script: floorScript(false, true),
    foe: ['gliscor', 'Hyper Cutter'],
    what: 'BOTH DOORS AT ONCE, AND NEITHER ALONE IS ENOUGH. Attack is refused by the ability and '
        + 'Special Attack is at the floor, so nothing lands and the pivot is cancelled — on a body '
        + 'whose ability by itself (arm `hypercutter`) does NOT cancel it.' },
  { id: 'floormixctl', kind: 'ctl', team: TEAM_F, script: floorScript(false, true),
    foe: ['gliscor', 'Sand Veil'],
    what: 'THE KNOB CLEARED for the arm above — the SAME Gliscor at the SAME -6 Special Attack, so '
        + 'Attack lands and the pivot stands. The outcome flips on the ability alone.' },
];

/* ---- PLAY ONE ARM ------------------------------------------------------------------------------ */
function play(G, arm) {
  G.resetScriptCounters();
  const A = G.buildPair(arm.team);
  const partner = arm.partner ? mon(arm.partner[0], arm.partner[1], FILL) : null;
  const B = G.buildPair(foeTeam(arm.foe[0], arm.foe[1], partner));
  if (!A || !B) return { notStaged: true };
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  const boards = [];
  const r = G.playGame(A, B, 'directed', 'psc :: ' + arm.id, {
    script: arm.script,
    onBoundary: (snap) => {
      boards.push({ compared: snap.leaves_compared,
                    diffs: snap.diffs.map(d => BS.locate(d, snap)),
                    sd: snap.sd, medi: snap.medi });
      /* the driver stops a state game at the first divergent board; neutralise the HOOK'S COPY only,
       * after the diffs are taken, so a red early turn cannot hide a later one. */
      snap.identical = true; snap.diffs = [];
    },
  });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const last = boards[boards.length - 1] || null;
  const side = (b, s) => {
    const S = b && b.sides && b.sides[s];
    const act = S && S.active && S.active[0];
    return act ? String(act.species) : '(empty)';
  };
  /* THE TARGET IS READ OFF THE SLOT IT IS STANDING IN, never looked up by species in the party. The
   * first version searched `party` by name and reported 0/0 for a body the same run had just driven
   * to -6/-6, because the fixture happened to hold TWO of that species. A reader that can be
   * confused by a duplicate is a reader that can report a clean board on a broken one. */
  const bo = (b, s) => {
    const act = b && b.sides && b.sides[s] && b.sides[s].active && b.sides[s].active[0];
    return act && act.boosts ? act.boosts.atk + '/' + act.boosts.spa : '?';
  };
  return { r, delta, boards,
    sdStanding: last ? side(last.sd, 'p1') : '(none)',
    meStanding: last ? side(last.medi, 'p1') : '(none)',
    sdFoeBoosts: last ? bo(last.sd, 'p2') : '?',
    meFoeBoosts: last ? bo(last.medi, 'p2') : '?',
    unexplained: boards.reduce((n, x) => n + x.diffs.length, 0),
    compared: boards.reduce((n, x) => n + x.compared, 0),
    rows: boards.map(x => x.diffs.slice(0, 4).map(d => (d.slot || d.side) + ' ' + d.field
      + ' me=' + JSON.stringify(d.us) + ' sd=' + JSON.stringify(d.sd))),
    sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).pivotUnconditionalRestored || 0,
  };
}

/* ---- RUN --------------------------------------------------------------------------------------- */
console.log(NL + 'PARTING SHOT — THE PIVOT IS CONDITIONAL ON THE DROP LANDING (ROADMAP #531)');
console.log('release ' + REL_ID);
console.log(NL + '  legal moves carrying selfSwitch (' + PIVOTS.length + '), and which is conditional:');
for (const p of PIVOTS) console.log('    ' + p.id.padEnd(18) + p.selfSwitch.padEnd(16)
  + (p.conditional ? 'CONDITIONAL — its own onHit deletes selfSwitch' : 'unconditional'));
console.log(NL + '  legal abilities with a boost-refusing handler (' + REFUSERS.length + '), and '
  + 'whether a foe\'s Parting Shot can be refused by one:');
for (const a of REFUSERS.sort((x, y) => (y.touchesPS - x.touchesPS) || x.id.localeCompare(y.id))) {
  console.log('    ' + a.id.padEnd(15) + (a.stats || '(none)').padEnd(11)
    + (a.intim ? 'Intimidate-only  ' : a.ally ? 'ALLY-only        ' : '                 ')
    + (a.touchesPS ? (a.reflects ? 'REFLECTS' : 'REFUSES ') : '--      ')
    + '  carriers: ' + (a.carriers.join(', ') || '(NONE LEGAL)'));
}
console.log(NL + '  legal Parting Shot carriers: ' + CS.moveCarriers('partingshot').join(', '));

let bad = 0, ran = 0;
if (carrierThrew) {
  console.log('  >> LEGALITY LOOKUP THREW ' + carrierThrew + ' time(s) — the membership table above is '
    + 'not a claim about this format. This is not a pass.');
  bad++;
}
for (const arm of ARMS) {
  if (ONLY && arm.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + arm.id + '   [' + arm.kind + ']   ' + arm.foe[0] + ' / ' + arm.foe[1]
    + (arm.partner ? '   beside ' + arm.partner[0] + ' / ' + arm.partner[1] : ''));
  console.log('  ' + arm.what);

  const clean = play(harness(false), arm);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), arm);
  harness(false);
  ran++;

  console.log('    user slot after the last turn   showdown=' + clean.sdStanding
    + '   medicham=' + clean.meStanding + '   medicham[knob]=' + brk.meStanding);
  console.log('    target atk/spa                  showdown=' + clean.sdFoeBoosts
    + '   medicham=' + clean.meFoeBoosts);
  console.log('    boards  ' + clean.compared + ' leaves, ' + clean.unexplained + ' differ'
    + '   |   knob ' + brk.compared + ' leaves, ' + brk.unexplained + ' differ');
  console.log('    counters  cancelled=' + (clean.delta.pivotCancelledNothingLanded || 0)
    + ' kept-by-exception=' + (clean.delta.pivotKeptByExceptAbility || 0)
    + ' unreadable=' + (clean.delta.pivotConditionUnreadable || 0)
    + '   |   MEDFAILS stamp clean=' + clean.restored + ' knob=' + brk.restored
    + '   |   clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : ''));
  for (const rows of clean.rows) for (const l of rows) console.log('      ' + l);

  /* ---- THE FIXTURE MUST HAVE RUN. Every one of these looks exactly like agreement. ---------- */
  if (clean.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.r.turns !== arm.script.length || brk.r.turns !== arm.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out (' + clean.r.turns + '/'
      + brk.r.turns + ' of ' + arm.script.length + ').'); bad++; continue; }
  if (clean.boards.length !== arm.script.length + 1) {
    console.log('    >> FIXTURE FAILED — ' + clean.boards.length + ' boundaries, '
      + (arm.script.length + 1) + ' expected.'); bad++; continue; }
  if (clean.boards.some(b => !b.compared)) {
    console.log('    >> FIXTURE FAILED — a boundary compared ZERO leaves.'); bad++; continue; }
  /* THE ARM MUST BE SENSITIVE: the authority has to have PLAYED the mechanic, or "the engines
   * agree" is a turn on which nothing could have differed. On a red arm that means the authority
   * kept the shooter standing; on a control it means it did not. */
  const authorityKept = clean.sdStanding === (arm.shooter || 'incineroar');
  if (arm.kind === 'red' && !authorityKept) {
    console.log('    >> FIXTURE FAILED — the authority pivoted, so this arm is not staging a '
      + 'refusal at all.'); bad++; continue; }
  if (arm.kind === 'ctl' && authorityKept) {
    console.log('    >> FIXTURE FAILED — the authority did NOT pivot on a control arm.');
    bad++; continue; }
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED, on the arms that can see it. */
  if (clean.restored !== 0) {
    console.log('    >> THE KNOB LEAKED — the restore stamp is set on a clean run.'); bad++; continue; }

  const agree = clean.unexplained === 0 && clean.meStanding === clean.sdStanding;
  if (!agree) { console.log('    >> DEFECT — the engines part on the board or on who is standing.'); bad++; }
  else console.log('    >> the two engines hold the same board and the same body is standing.');

  const knobAgree = brk.unexplained === 0 && brk.meStanding === clean.sdStanding;
  if (arm.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this a red arm.');
    if (brk.restored !== 1) { console.log('    >> THE KNOB DID NOT BIND — the restore stamp is '
      + brk.restored + ' under MEDI_PIVOT_UNCONDITIONAL=1.'); bad++; }
    if ((clean.delta.pivotCancelledNothingLanded || 0) !== 1) {
      console.log('    >> THE BRANCH DID NOT RUN AS CLAIMED — the cancel counter is '
        + (clean.delta.pivotCancelledNothingLanded || 0) + ', expected exactly 1.'); bad++; }
  } else {
    if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob, so the change '
      + 'is not confined.'); bad++; }
    if ((clean.delta.pivotCancelledNothingLanded || 0) !== 0) {
      console.log('    >> OVER-FIRE — the cancel branch ran on a control arm ('
        + clean.delta.pivotCancelledNothingLanded + ').'); bad++; }
  }
  /* THE EXCEPTION IS ASSERTED AT AN EXACT COUNT, not merely allowed to happen. `mirror` agreed with
   * the authority BEFORE the fix as well -- an engine that pivots unconditionally agrees with an
   * exception because it agrees with everything -- so "the boards match" is not evidence that the
   * exception branch is the thing carrying it. The count is. */
  if ((clean.delta.pivotKeptByExceptAbility || 0) !== (arm.kept || 0)) {
    console.log('    >> THE EXCEPTION BRANCH RAN ' + (clean.delta.pivotKeptByExceptAbility || 0)
      + ' time(s), expected ' + (arm.kept || 0) + '.'); bad++; }
  if ((clean.delta.pivotConditionUnreadable || 0) !== 0) {
    console.log('    >> LOUD FALLBACK FIRED — the artifact could not say what cancels this pivot.');
    bad++; }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
