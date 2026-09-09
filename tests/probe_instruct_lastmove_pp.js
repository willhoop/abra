/* probe_instruct_lastmove_pp.js — INSTRUCT IS REFUSED WHEN THE MOVE IT WOULD REPEAT HAS NO PP LEFT,
 * AND THIS ENGINE GRANTED THE ACTION AND THEN FAILED IT. 2026-09-09, batch W.
 *
 *   SHOWDOWN_PATH=... node tests/probe_instruct_lastmove_pp.js
 *   SHOWDOWN_PATH=... node tests/probe_instruct_lastmove_pp.js --release <id> --only instruct-lastmove-at-zero-pp
 *
 * ================= THE CARD =====================================================================
 *
 * `data/game-differential.json`, release `f6ecf4222048`, 961 games on the pinned pool:
 *
 *     unrelated event mismatch :: |-fail|p2a <> |-singleturn|p1a|instruct
 *
 * and the game itself (`pair-speedctrl`, seed …bo3-2655613153, turn 11):
 *
 *     agreed    |move|p2a: Oranguru|instruct|p1a: Gengar
 *     showdown  |-fail|p2a: Oranguru
 *     medicham2 |-singleturn|p1a: Gengar|move: Instruct|[of] p2a: Oranguru
 *               |cant|p1a: Gengar|nopp|protect              <- OUR OWN LINE NAMES THE CAUSE
 *
 * Gengar's last move was the Protect it clicked on turn 10, and that slot was empty. THE ENGINE
 * ALREADY KNEW — it wrote `nopp` one line later — it simply asked at the wrong moment.
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * CHAMPIONS DOES NOT REWRITE INSTRUCT: `data/mods/champions/moves.ts` overrides 259 moves and
 * Instruct is not one of them; the only mention anywhere under `data/mods/champions/` is
 * `learnsets.ts` (`instruct: ["9M"]`). Both facts are re-derived on every run below. The handler is
 * mainline's, `data/moves.ts`, read WHOLE:
 *
 *     onHit(target, source) {
 *       if (!target.lastMove || target.volatiles['dynamax']) return false;
 *       const lastMove = target.lastMove;
 *       const moveSlot = target.getMoveData(lastMove.id);
 *       if (lastMove.flags['failinstruct'] || lastMove.isZ || lastMove.isMax ||
 *           lastMove.flags['charge'] || lastMove.flags['recharge'] ||
 *           target.volatiles['beakblast'] || target.volatiles['focuspunch'] ||
 *           target.volatiles['shelltrap'] || (moveSlot && moveSlot.pp <= 0)) return false;
 *       this.add('-singleturn', target, 'move: Instruct', `[of] ${source}`);
 *       this.queue.prioritizeAction(...);
 *     },
 *
 * `(moveSlot && moveSlot.pp <= 0)` is the clause. It is asked of the LAST MOVE'S OWN SLOT — not of
 * the body, and not of any other slot — and `return false` inside `onHit` makes the MOVE fail, so
 * the authority writes `|-fail|<the INSTRUCTOR>` and never the `-singleturn`.
 *
 * `moveSlot &&` is why the reader here is `ppLeft(...) === 0` and not `!ppLeft(...)`: `ppLeft`
 * answers `null` for a move this engine's PP artifact has no row for, which is the same "there is no
 * slot to ask" that a falsy `moveSlot` is, and a null must not refuse.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * The `instruct` branch checked the shield (ROADMAP #532), Good as Gold (#161), Instruct's own
 * `refuses` list, `_charging` and `_recharge`, and `!t._lastMove` — every clause of `onHit` EXCEPT
 * the PP one. So it spliced a second action in, and that second action then met the ordinary
 * selection gate and printed `|cant|…|nopp|…`: two lines the authority does not carry, out of a
 * refusal the engine was already capable of making one step earlier.
 *
 * WHAT IT IS AND IS NOT, STATED PLAINLY. It is a genuine wrong refusal at the wrong site, and on
 * the pool's own card its board consequence is NIL — the repeat is refused either way, so nothing
 * moves. The perish-counter difference batch V read off this card's `after` window is the WINDOW,
 * not the game: the dump keeps ten lines after the divergence point, our two extra lines push the
 * tail out of it, and `|-start|p2a: Oranguru|perish1` is line eleven. That correction is recorded
 * here rather than left standing, because a board claim that turns out to be an instrument bound is
 * exactly the thing this repository keeps paying for.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the same script under the differential's own
 * `middle` pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE
 * EXPECTATION. `MEDI_INSTRUCT_NO_PP_REFUSAL=1` is the revert knob and it restores exactly the
 * pre-2026-09-09 branch, so a RED arm is one that agrees clean and PARTS under the knob, and a
 * CONTROL is one that agrees under BOTH. The knob is proved to have reached the module the driver
 * played, by a load-time stamp in `MEDFAILS`, before any verdict is read.
 *
 * ================= THE FIXTURE DRAINS A REAL SLOT, IT DOES NOT DECLARE ONE EMPTY =================
 *
 * There is no way to hand `buildPair` a spent PP table, so the arms SPEND it: Protect is `maxpp` 8
 * in this format (derived and printed below, never the mainline 16), and the target clicks it on
 * eight consecutive turns. A Protect that fails its stall check still costs its PP on both engines
 * — measured, not assumed: the authority itself REJECTED a ninth Protect from a body in an earlier
 * draft of this fixture with "Can't move: Protect is disabled".
 *
 * THE TARGET IS SLOWER THAN THE INSTRUCTOR ON PURPOSE. Snorlax is base 30 and Oranguru base 60, so
 * on the Instruct turn the target has not yet acted and `lastMove` is still the Protect from the
 * turn before — which is the card's shape exactly, and which is the only way to ask the PP clause
 * without a shield standing in front of it (a Protect that is UP refuses Instruct at `TryHit`, three
 * steps above `onHit`; that is `tests/probe_instruct_shield.js`'s subject, not this file's).
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_instruct_lastmove_pp.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_INSTRUCT_NO_PP_REFUSAL';

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

/* ---- THE FIXTURE ------------------------------------------------------------------------------
 * THE PARTNERS CLICK A SELF-BOOST AND NOT PROTECT, and that is not tidiness: an earlier draft had
 * every slot spamming Protect and the AUTHORITY refused the whole turn — "Can't pass: Your Milotic
 * must make a move" — because the partner's own Protect had run out at the same moment. A fixture
 * that ends in a rejected choice is a fixture that staged nothing. Calm Mind and Swords Dance are
 * 20 PP here and cap out at +6, after which both engines simply write `-fail`. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const PROT = { m: 'protect' };
const SLAM = { m: 'bodyslam', t: 0 };
const INS = { m: 'instruct', t: 0 };
const CM = { m: 'calmmind' };
const SD = { m: 'swordsdance' };
const SIDE_A = [['snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']],
                ['clefable', '', 'Unaware', ['Calm Mind', 'Protect']],
                ['milotic', '', 'Marvel Scale', ['Protect']],
                ['corviknight', '', 'Pressure', ['Protect']]];
const SIDE_B = [['oranguru', '', 'Inner Focus', ['Instruct', 'Calm Mind']],
                ['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']],
                ['toxapex', '', 'Regenerator', ['Protect']],
                ['froslass', '', 'Snow Cloak', ['Protect']]];
/* `drain` Protects, then `tail` turns of Body Slam, then the Instruct turn. */
const script = (drain, tail) => {
  const s = [];
  for (let i = 0; i < drain; i++) s.push({ p1: [PROT, CM], p2: [CM, SD] });
  for (let i = 0; i < tail; i++) s.push({ p1: [SLAM, CM], p2: [CM, SD] });
  s.push({ p1: [SLAM, CM], p2: [INS, SD] });
  return s;
};

const CASES = [
  { id: 'instruct-lastmove-at-zero-pp', kind: 'red', script: script(8, 0), pp: 0, lastMove: 'protect',
    repClean: 0, repKnob: 1,
    what: 'THE CARD, REBUILT. Snorlax spends all eight PP of Protect and is then Instructed on the '
        + 'following turn, before it has acted — so `target.lastMove` is that Protect and its slot '
        + 'is empty. The authority refuses inside `onHit` and writes `|-fail|` on the INSTRUCTOR; '
        + 'this engine queued the repeat and then refused it one step later with `|cant|…|nopp|`.' },

  { id: 'instruct-lastmove-at-one-pp', kind: 'control', script: script(7, 0), pp: 1, lastMove: 'protect',
    repClean: 1, repKnob: 1,
    what: 'THE KNOB CLEARED EXPLICITLY — the identical board and the identical script with ONE FEWER '
        + 'Protect, so the same slot holds 1 PP instead of 0 at the same instant. The authority '
        + 'GRANTS the repeat and `instructRepeat` reads 1 where the red arm reads 0. Without it, '
        + '"the PP clause refuses" and "this engine has stopped granting Instruct" are the same red '
        + 'arm, and that mistake has been made in this repository more than once.' },

  { id: 'instruct-other-slot-empty', kind: 'control', script: script(8, 1), pp: 16, lastMove: 'bodyslam',
    also: 'and PROTECT, on the same body, is still at 0',
    repClean: 1, repKnob: 1,
    what: 'THE OVER-FIRE CONTROL, AND IT IS THE SHARPEST ONE HERE. Protect is STILL at zero on the '
        + 'same Snorlax — the same eight turns of draining — but one extra turn of Body Slam has '
        + 'made BODY SLAM the last move, and Body Slam has plenty of PP. The authority asks '
        + '`target.getMoveData(lastMove.id)` and nothing else, so it grants. A fix that read "this '
        + 'body has an empty slot", or "this body cannot select Protect", would refuse here and '
        + 'would pass the red arm. It must agree clean AND under the knob.' },
];

/* ---- LEGALITY, DERIVED. Nothing above is typed from memory. ------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const row of SIDE_A.concat(SIDE_B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
  }
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE PREMISES, DERIVED ON EVERY RUN -------------------------------------------------------- */
const TAGS = require(REL.path('data/tags.json'));
{
  const fs = require('fs'), SP = process.env.SHOWDOWN_PATH;
  const champ = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const overridden = /^\tinstruct: \{/m.test(champ);
  const ppOf = id => ((TAGS.moves[id] || {}).params || {}).pp;
  const protPP = ppOf('protect'), slamPP = ppOf('bodyslam');
  const users = dex.species.all().filter(legal)
    .filter(s => { const e = LS[s.id]; return e && e.learnset && e.learnset.instruct; }).map(s => s.name);
  console.log('DOES CHAMPIONS REWRITE INSTRUCT? ' + (overridden ? 'YES' : 'NO'));
  console.log('LEGAL INSTRUCT USERS IN ' + CS.FORMAT + ': ' + (users.join(', ') || '(NONE)'));
  console.log('PP in this format, off the release’s data/tags.json (never the mainline number): '
    + 'protect=' + JSON.stringify(protPP) + '  bodyslam=' + JSON.stringify(slamPP));
  console.log('protect.flags = ' + JSON.stringify(dex.moves.get('protect').flags)
    + '  -> failinstruct? ' + !!dex.moves.get('protect').flags['failinstruct']
    + '   (it must be FALSE, or the red arm would be refused for a different clause)');
  console.log('base speeds: snorlax ' + dex.species.get('snorlax').baseStats.spe
    + '  oranguru ' + dex.species.get('oranguru').baseStats.spe
    + '   (the target must be SLOWER, or it acts first and lastMove is not the drained slot)');
  const bad = [];
  if (overridden) bad.push('Champions overrides Instruct, so the handler read above is stale');
  if (!users.length) bad.push('nothing in this format learns Instruct');
  const maxpp = protPP && (protPP.max != null ? protPP.max : protPP.pp);
  if (maxpp !== 8) bad.push('Protect has ' + maxpp + ' PP here, not 8, so the eight-turn drain in '
    + 'this fixture no longer empties the slot');
  if (dex.moves.get('protect').flags['failinstruct']) bad.push('Protect now carries failinstruct, so '
    + 'the red arm would be refused for a clause this file is not about');
  if (dex.species.get('snorlax').baseStats.spe >= dex.species.get('oranguru').baseStats.spe) {
    bad.push('the target is no longer slower than the instructor');
  }
  if (bad.length) { console.log(NL + 'NOT RUN — ' + bad.join('; ') + '. This is not a pass.'); process.exit(2); }
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(SIDE_A)), b = G.buildPair(stage(SIDE_B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_instruct_lastmove_pp :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).instructNoPpRefusalRestored || 0 };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  /* THE CLEAN RUN ONLY — a RED arm's knob run is cut short at the parting by construction. */
  const short = clean.r.turns < c.script.length;
  const refused = clean.sc.moveNotOnRequest;
  const R = { c, clean, brk, short, refused,
    rep: clean.delta.instructRepeat || 0, repK: brk.delta.instructRepeat || 0,
    ref: clean.delta.instructRefusedByLastMovePP || 0,
    refK: brk.delta.instructRefusedByLastMovePP || 0 };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out on the clean load']; continue; }
  const fails = [];
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  /* THE BRANCH COUNTERS AT EXACT EQUALITY. `repClean` is what makes "the engines agree" unreadable
   * as "Instruct is dead in this engine", and the refusal must read 0 everywhere under the knob. */
  if (R.rep !== c.repClean) fails.push('instructRepeat clean is ' + R.rep + ', declared ' + c.repClean);
  if (R.repK !== c.repKnob) fails.push('instructRepeat knob is ' + R.repK + ', declared ' + c.repKnob);
  const wantRef = c.kind === 'red' ? 1 : 0;
  if (R.ref !== wantRef) fails.push('instructRefusedByLastMovePP clean is ' + R.ref + ', declared ' + wantRef);
  if (R.refK !== 0) fails.push('instructRefusedByLastMovePP under the knob is ' + R.refK + ', must be 0');
  /* AND THE PROTOCOL STREAMS. */
  if (clean.r.div) fails.push('the engines part on the CLEAN load');
  if (c.kind === 'red' && !brk.r.div) fails.push('the knob did not move the outcome — this arm proves nothing');
  if (c.kind === 'control' && brk.r.div) fails.push('OVER-FIRE — a control moved under the knob');
  if (fails.length) bad += 1;
  R.fails = fails;
}

for (const R of results) {
  const { c, clean, brk } = R;
  const verdict = R.short ? 'SHORT        ' : R.refused ? 'CLICK REFUSED'
    : (R.fails && R.fails.length) ? 'FAIL         '
    : c.kind === 'red' ? 'RED PROVEN   ' : 'CONTROL HELD ';
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    staged         the target\'s last move at the Instruct instant is `' + c.lastMove
    + '`, and THAT slot holds ' + c.pp + ' PP');
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE'));
  console.log('    counters       instructRepeat ' + R.rep + '/' + c.repClean + ' clean, '
    + R.repK + '/' + c.repKnob + ' knob   |   instructRefusedByLastMovePP ' + R.ref
    + ' clean, ' + R.refK + '/0 knob');
  console.log('    MEDFAILS stamp clean ' + clean.restored + '   knob ' + brk.restored);
  const d = clean.r.div || brk.r.div;
  if (d) {
    console.log('    ' + (clean.r.div ? 'CLEAN' : 'KNOB') + ' parted:');
    console.log('      showdown  ' + d.sdRaw);
    console.log('      medicham  ' + d.meRaw);
    console.log('      medicham next  ' + JSON.stringify(d.meAfterRaw.slice(0, 3)));
  }
  for (const f of (R.fails || [])) console.log('    >> FAIL: ' + f);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing   [release ' + REL_ID + ']');
console.log(bad ? 'FAIL' : ONLY ? 'PASS for the arm(s) named by --only. THIS IS NOT THE FILE’S VERDICT.'
  : 'PASS — Instruct is refused when the slot it would repeat is empty and granted when it is not, '
  + 'the knob puts the red arm apart again and moves neither control, and a body with a DIFFERENT '
  + 'empty slot still gets its repeat');
process.exit(bad ? 1 : 0);
