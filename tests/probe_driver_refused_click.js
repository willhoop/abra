/* probe_driver_refused_click.js — THE EMPIRICAL DRIVER MAY ONLY CLICK WHAT THE AUTHORITY WILL TAKE.
 *
 *   node tests/probe_driver_refused_click.js                 (SHOWDOWN_PATH must be set)
 *
 * On release 4c9b0cc4a4da four lattice games THREW (1 / 1 / 2 at --games 1200 / 1350 / 1950) because
 * `engine/game_differential.js`'s driver sent a click the authority refused. A thrown game stops at the
 * refusal and is counted board-never-diverged, so every turn after it went untested. Two mechanisms:
 *
 *   HIDDEN DISABLE — Imprison disables the foe's shared moves with `disableMove(id, true)`. The LAST
 *   active body's request shows such a move ENABLED (`getMoves(lockedMove, isLastActive)`,
 *   sim/pokemon.ts:1101 and :1031) and raises `maybeDisabled`; `side.chooseMove` validates against the
 *   unrestricted `getMoves()` and refuses it. Floette / Sinistcha / Mr. Rime.
 *
 *   THE LAST-RESORT FALLBACK — a body Encored into Helping Hand with its ally slot empty and nothing on
 *   the bench has one enabled move and no live body to aim it at. The driver dropped it for want of a
 *   target, found no candidate, and sent `move 1` — Protect, which the request had disabled. Altaria.
 *
 * WHAT IS ASSERTED IS THE OUTCOME: whether `battle.choose` accepts what `chooseAction` produced. Each
 * fixture is built so the pre-fix driver WOULD click the refused move: the axis prefers Protect, and the
 * coverage chooser ranks `prefer` first. Each mechanism has its own knob, run in its own child process,
 * and each knob must turn exactly its own case red and leave the other case and the controls green —
 * identical results across a varied knob would mean the knob is unwired.
 *
 *   MEDI_DRIVER_HIDDEN_DISABLE_UNREAD=1   the Imprison filter off
 *   MEDI_DRIVER_FALLBACK_FIRST_SLOT=1     the old `move 1` fallback back
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

const KNOBS = ['MEDI_DRIVER_HIDDEN_DISABLE_UNREAD', 'MEDI_DRIVER_FALLBACK_FIRST_SLOT'];

if (process.argv.includes('--child')) child();
else parent();

/* ------------------------------------------------------------------------------------------------ */
function child() {
  if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
  const ER = require(D('engine', 'engine_release.js'));
  if (!process.argv.includes('--release')) {
    process.argv.push('--release', ER.cut('tests/probe_driver_refused_click.js — freeze the tree under test').id);
  }
  const log = console.log;
  console.log = () => {};
  let G, CS;
  try { G = require(D('engine', 'game_differential.js')); CS = require(D('engine', 'champions_sim.js')); }
  finally { console.log = log; }
  const { Battle, Teams } = CS.sim();

  const mon = (species, ability, moves) => ({ species, ability, item: '', moves, evs: {}, level: 50 });
  const make = (A, B) => {
    const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
    b.setPlayer('p1', { name: 'A', team: Teams.pack(A) });
    b.setPlayer('p2', { name: 'B', team: Teams.pack(B) });
    if (b.requestState === 'teampreview') { b.choose('p1', 'team 12'); b.choose('p2', 'team 12'); }
    return b;
  };
  const choose = (b, sd, str) => { const ok = b.choose(sd, str); if (!ok) throw new Error('fixture choice refused: ' + sd + ' ' + str + ' — ' + b[sd].choice.error); };
  const moveSlot = (b, sd, i, id) => b[sd].active[i].moveSlots.findIndex(m => m.id === id) + 1;
  /* The driver's own translation to a choice string, restated for ONE slot — the same shape `str()` in
   * playGame builds: `move <slot>[ <target>]`, or `pass` for an empty slot. */
  const spell = a => (!a || a.pass) ? 'pass' : 'move ' + a.slot + (a.target != null ? ' ' + a.target : '');
  const PREFER_PROTECT = { prefer: new Set(['protect']) };

  const out = {};

  /* ---- A. HIDDEN DISABLE, and its control ------------------------------------------------------ */
  const imprisonCase = (imprison) => {
    const A = [mon('Garchomp', 'Rough Skin', ['Protect', 'Dragon Claw']),
               mon('Floette-Eternal', 'Flower Veil', ['Protect', 'Moonblast'])];
    const B = [mon('Farigiraf', 'Armor Tail', ['Imprison', 'Protect', 'Psychic']),
               mon('Whimsicott', 'Infiltrator', ['Protect', 'Moonblast'])];
    const b = make(A, B);
    choose(b, 'p1', 'move 1, move 1');
    choose(b, 'p2', (imprison ? 'move 1' : 'move 2') + ', move 1');
    const req = b.p1.activeRequest.active[1];
    const offered = req.moves.find(m => m.id === 'protect');
    const pick = G.chooseAction(b, b.p1, 1, req, PREFER_PROTECT, new Set());
    const c = 'move ' + moveSlot(b, 'p1', 0, 'dragonclaw') + ' 1, ' + spell(pick);
    const ok = b.choose('p1', c);
    return { request_offers_protect: !!offered && !offered.disabled, maybeDisabled: !!req.maybeDisabled,
             pick: pick && pick.move, sent: c, accepted: !!ok, error: ok ? null : b.p1.choice.error,
             imprison_started: b.log.some(l => /\|-start\|p2a: Farigiraf\|move: Imprison/.test(l)) };
  };
  out.imprison = imprisonCase(true);
  out.imprison_control = imprisonCase(false);

  /* ---- B. THE ONLY ENABLED MOVE HAS NO LIVE BODY TO AIM AT, and its control -------------------- */
  const encoreCase = (allyAlive) => {
    const A = [mon('Whimsicott', 'Prankster', ['Encore', 'Moonblast']),
               mon('Basculegion', 'Adaptability', ['Wave Crash', 'Protect'])];
    const B = [mon('Kingambit', 'Defiant', ['Protect', 'Iron Head']),
               mon('Altaria', 'Natural Cure', ['Protect', 'Helping Hand', 'Roost'])];
    const b = make(A, B);
    /* turn 1: Altaria uses Helping Hand; Kingambit is left at 1 HP so Wave Crash finishes it (unless
     * this is the control, where the ally is left standing). */
    if (!allyAlive) b.p2.active[0].sethp(1);
    choose(b, 'p1', 'move ' + moveSlot(b, 'p1', 0, 'moonblast') + ' 2, move ' + moveSlot(b, 'p1', 1, 'wavecrash') + ' 1');
    choose(b, 'p2', 'move ' + moveSlot(b, 'p2', 0, 'ironhead') + ' 2, move ' + moveSlot(b, 'p2', 1, 'helpinghand') + ' -1');
    /* turn 2: Prankster Encore on Altaria, which is locked into Helping Hand */
    const p1c = 'move ' + moveSlot(b, 'p1', 0, 'encore') + ' 2, move ' + moveSlot(b, 'p1', 1, 'protect');
    const p2c = (allyAlive ? 'move ' + moveSlot(b, 'p2', 0, 'protect') : 'pass') + ', move ' + moveSlot(b, 'p2', 1, 'roost');
    choose(b, 'p1', p1c); choose(b, 'p2', p2c);
    const req = b.p2.activeRequest.active[1];
    const pick = G.chooseAction(b, b.p2, 1, req, PREFER_PROTECT, new Set());
    const left = allyAlive ? 'move ' + moveSlot(b, 'p2', 0, 'ironhead') + ' 1' : 'pass';
    const c = left + ', ' + spell(pick);
    const ok = b.choose('p2', c);
    return { ally_fainted: !!b.p2.active[0].fainted, encored: !!b.p2.active[1].volatiles.encore,
             enabled: req.moves.filter(m => !m.disabled).map(m => m.id), pick: pick && pick.move,
             sent: c, accepted: !!ok, error: ok ? null : b.p2.choice.error };
  };
  out.encore = encoreCase(false);
  out.encore_control = encoreCase(true);
  out.counters = { hidden: G.hiddenDisableCount(), empty: G.onlyEmptySlotCount() };
  process.stdout.write('@@' + JSON.stringify(out) + '\n');
}

/* ------------------------------------------------------------------------------------------------ */
function parent() {
  let fails = 0;
  const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fails++; };
  const run = (knob) => {
    const env = Object.assign({}, process.env);
    for (const k of KNOBS) delete env[k];
    if (knob) env[knob] = '1';
    const r = spawnSync(process.execPath, [__filename, '--child', ...process.argv.slice(2)],
                        { env, encoding: 'utf8', maxBuffer: 64 << 20 });
    const line = String(r.stdout || '').split('\n').find(l => l.startsWith('@@'));
    if (!line) {
      console.log('  CHILD PRODUCED NO RESULT (knob ' + (knob || 'none') + ', exit ' + r.status + ')');
      console.log(String(r.stderr || '').slice(-2000));
      process.exit(1);
    }
    return JSON.parse(line.slice(2));
  };

  console.log('\n--- THE FIXTURES, ON THE FIXED DRIVER ---');
  const F = run(null);
  console.log(JSON.stringify(F, null, 1));
  ok(F.imprison.imprison_started, 'A: Imprison actually started (the fixture reached the case)');
  ok(F.imprison.request_offers_protect && F.imprison.maybeDisabled,
     'A: the gap is real — the last active body\'s REQUEST offers Protect and raises maybeDisabled');
  ok(F.imprison.accepted && F.imprison.pick !== 'protect',
     'A: the driver did not click the imprisoned Protect, and the authority ACCEPTED its choice');
  ok(F.imprison_control.accepted && F.imprison_control.pick === 'protect',
     'A control: with no Imprison the same preference DOES click Protect and it is accepted (the axis is wired)');
  ok(F.encore.ally_fainted && F.encore.encored && F.encore.enabled.length === 1 && F.encore.enabled[0] === 'helpinghand',
     'B: the fixture reached the case — ally fainted, Encored, Helping Hand the one enabled move');
  ok(F.encore.accepted && F.encore.pick === 'helpinghand',
     'B: the driver sent Helping Hand at the empty slot, and the authority ACCEPTED it');
  ok(F.encore_control.accepted, 'B control: with the ally alive the Encored click is accepted');
  ok(F.counters.hidden.filtered >= 1 && F.counters.empty.n >= 1, 'both counters fired (neither filter is silent)');

  console.log('\n--- MEDI_DRIVER_HIDDEN_DISABLE_UNREAD=1 — must turn A red and nothing else ---');
  const H = run('MEDI_DRIVER_HIDDEN_DISABLE_UNREAD');
  console.log('  A: pick ' + H.imprison.pick + ', accepted ' + H.imprison.accepted + ' — ' + H.imprison.error);
  ok(!H.imprison.accepted && H.imprison.pick === 'protect' && /disabled/.test(String(H.imprison.error)),
     'RED: the old read clicks the imprisoned Protect and the authority REFUSES it');
  ok(H.imprison_control.accepted && H.encore.accepted && H.encore_control.accepted,
     'the knob moves nothing else');

  console.log('\n--- MEDI_DRIVER_FALLBACK_FIRST_SLOT=1 — must turn B red and nothing else ---');
  const L = run('MEDI_DRIVER_FALLBACK_FIRST_SLOT');
  console.log('  B: pick ' + L.encore.pick + ', accepted ' + L.encore.accepted + ' — ' + L.encore.error);
  ok(!L.encore.accepted && /disabled/.test(String(L.encore.error)),
     'RED: the old fallback sends `move 1` (Protect, disabled by Encore) and the authority REFUSES it');
  ok(L.imprison.accepted && L.imprison_control.accepted && L.encore_control.accepted,
     'the knob moves nothing else');

  console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASS'));
  process.exit(fails ? 1 : 0);
}
