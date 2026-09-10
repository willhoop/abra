/* probe_premajor_above_refusals.js — CHILLY RECEPTION'S `-prepare … [premajor]` IS OWED AT
 * BeforeMove PRIORITY 100, SO IT IS WRITTEN ABOVE EVERY REFUSAL. THIS ENGINE WROTE IT AT THE `|move|`
 * LINE, WHICH A REFUSED BODY NEVER REACHES. 2026-09-09, batch X.
 *
 *   SHOWDOWN_PATH=... node tests/probe_premajor_above_refusals.js
 *   SHOWDOWN_PATH=... node tests/probe_premajor_above_refusals.js --release <id> --only <arm>
 *
 * ================= THE CARD =====================================================================
 *
 * `data/game-differential.json`, release `7489a6cc064d`, 961 games on the pinned pool:
 *
 *     event missing from medicham2 :: |-prepare|p2a|chillyreception|[premajor] <> |cant|p2a|par
 *
 * and the game itself (`omit-spread`, seed …bo3-2661369558, turn 9):
 *
 *     showdown  |-prepare|p2a: Slowking|Chilly Reception|[premajor]
 *               |cant|p2a: Slowking|par
 *     medicham2 |cant|p2a: Slowking|par
 *
 * ================= THE ENGINE ALREADY NAMED THIS, WHICH IS WHY IT IS A ONE-LINE MOVE ============
 *
 * The block that emits the line has carried this paragraph since 2026-08-24:
 *
 *     WHAT THIS DOES NOT DO, SAID RATHER THAN LEFT TO BE FOUND: the authority's line is owed at
 *     BeforeMove priority 100, which is ABOVE the flinch (8) and the Taunt (5) refusals -- so a
 *     Slowking that is flinched still prints |-prepare| in the authority and prints nothing here,
 *     because this site is the |move| line and a refused body never reaches it.
 *
 * The pinned pool found it through PARALYSIS (priority 1) rather than through the flinch, which is
 * the same clause one row down the same list.
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 *     chillyreception.priorityChargeCallback(source) { source.addVolatile('chillyreception'); }
 *     chillyreception.condition = {
 *       duration: 1,
 *       onBeforeMovePriority: 100,
 *       onBeforeMove(source, target, move) {
 *         if (move.id !== 'chillyreception') return;
 *         this.add('-prepare', source, 'Chilly Reception', '[premajor]');
 *       },
 *     }                                                                        data/moves.ts
 *
 * `runEvent('BeforeMove')` sorts by `comparePriority`, HIGH FIRST. Every `onBeforeMove` handler a
 * legal entity of this format can raise is enumerated below on every run and printed; today it reads
 *
 *     chillyreception 100 | mustrecharge 11 | slp 10 | frz 10 | truant 9 | flinch 8 | disable 7 |
 *     gravity 6 | throatchop 6 | taunt 5 | confusion 3 | attract 2 | par 1 | gorillatactics 0 |
 *     destinybond -1
 *
 * so 100 is the MAXIMUM and the line is owed above all fourteen others. The run stops if anything
 * ever outranks it.
 *
 * ================= THE FIX ======================================================================
 *
 * The emission moves from the `|move|`-line site to the HEAD of this engine's own BeforeMove block —
 * above the recharge (11), the sleep and freeze ticks (10), the flinch (8), confusion (3), Attract
 * (2) and the paralysis coin (1), which are already in the authority's priority order there. It is
 * emitted in ONE place, not two: leaving the old call standing would print the line twice on every
 * turn the move actually runs.
 *
 * NOTHING ELSE MOVES. The reader is the same `volatileAnnounce.byVolatile[*].beforeOwnMove` record
 * derived by `engine/tag_dex.js` from the handler's own shape — which already carries
 * `priority: 100` — and the guard is still the record's own `move === <this action's id>`.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the same script under the differential's own
 * `middle` pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE
 * EXPECTATION. `MEDI_PREMAJOR_AT_MOVE_LINE=1` is the revert knob and puts the emission back at the
 * `|move|` line, so a RED arm is one that agrees clean and PARTS under the knob, and a CONTROL is one
 * that agrees under BOTH.
 *
 * ================= THE FIXTURE USES A FLINCH, NOT THE CARD'S PARALYSIS, AND SAYS SO =============
 *
 * Full paralysis is `randomChance(1, 8)` in Champions — a coin this fixture cannot make land on
 * demand without pinning a die and thereby staging a different question. Fake Out is priority +3,
 * always flinches a body that has not yet acted, and its refusal (`flinch`, priority 8) sits at the
 * SAME place in the same sorted list as the card's `par` (priority 1): both are below 100 and both
 * `return false`. The arm therefore stages the mechanism the card is about and not the card's
 * particular refusal, and that is stated rather than implied. THE CARD'S OWN GAME IS CHECKED
 * SEPARATELY, in the whole-game differential.
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
  REL_ID = ER.cut('tests/probe_premajor_above_refusals.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_PREMAJOR_AT_MOVE_LINE';

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

/* ---- THE FIXTURE ------------------------------------------------------------------------------ */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const CM = { m: 'calmmind' };
const SD = { m: 'swordsdance' };
const FO = { m: 'fakeout', t: 0 };
const PROT = { m: 'protect' };
const CHILL = { m: 'chillyreception' };

const SIDE_A = [['raichu', '', 'Static', ['Fake Out', 'Protect']],
                ['clefable', '', 'Unaware', ['Calm Mind', 'Protect']],
                ['milotic', '', 'Marvel Scale', ['Protect', 'Rest']],
                ['corviknight', '', 'Pressure', ['Protect']]];
/* OBLIVIOUS, NOT REGENERATOR: Chilly Reception is `selfSwitch: true`, and a Regenerator body healing
 * as it pivots would put an HP difference on the `|switch|` line of the control arm — a second
 * question inside the one being asked. Oblivious touches nothing in this fixture. */
const SIDE_B = [['slowking', '', 'Oblivious', ['Chilly Reception', 'Calm Mind', 'Protect']],
                ['garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']],
                ['toxapex', '', 'Regenerator', ['Protect']],
                ['froslass', '', 'Snow Cloak', ['Protect']]];

const CASES = [
  { id: 'chillyreception-under-a-flinch', kind: 'red',
    script: [{ p1: [FO, CM], p2: [CHILL, SD] }],
    annClean: 1, annKnob: 0,
    what: 'THE CARD\'S MECHANISM, REBUILT ON A REFUSAL THAT DOES NOT NEED A COIN. Fake Out (+3) '
        + 'flinches the Slowking before it acts; the flinch refusal is `onBeforeMovePriority` 8 and '
        + 'the `-prepare` is owed at 100, so the authority writes the line and THEN the `|cant|`. '
        + 'This engine wrote the line at the `|move|` line, which a flinched body never reaches.' },

  { id: 'chillyreception-not-refused', kind: 'control',
    script: [{ p1: [PROT, CM], p2: [CHILL, SD] }],
    annClean: 1, annKnob: 1,
    what: 'THE KNOB CLEARED EXPLICITLY — the identical board and the identical Slowking click, with '
        + 'ONE field moved: Raichu Protects instead of using Fake Out, so nothing refuses the move '
        + 'and it runs. The line is owed exactly once on this turn, above the `|move|` line, on BOTH '
        + 'loads. This is what separates "the line moved above the refusals" from "the line is now '
        + 'written twice" and from "the line has stopped being written at all".' },

  { id: 'calmmind-under-the-same-flinch', kind: 'control',
    script: [{ p1: [FO, CM], p2: [CM, SD] }],
    annClean: 0, annKnob: 0,
    what: 'THE OVER-FIRE CONTROL. The identical Fake Out into the identical body on the identical '
        + 'turn, and a move that owns no BeforeMove announcement: nothing may be printed above the '
        + '`|cant|flinch`. The authority\'s handler opens `if (move.id !== \'chillyreception\') '
        + 'return;`, and a fix that hoisted the emission without carrying that guard passes the red '
        + 'arm and writes a `-prepare` on every flinched body in the game.' },
];

/* ---- LEGALITY, DERIVED. Nothing above is typed from memory. ------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* ROADMAP #565 — THE LEGALITY GATE ASKS THE VALIDATOR, NOT THE RAW ROWS. The prevo walk this line
 * replaced accepted any entry on the species or on a prevo whatever its SOURCE tag, so a move a prevo
 * learned by a gen-7 TM (`7M`, `7V`) read as legal here while `TeamValidator` refused it — which is how
 * illegal fixtures passed their own gates (tests/test-fixture-legality.js, batch 2).
 * `champions_sim.canLearn` IS `checkCanLearn`, cached per pair. */
const learns = (sp, mv) => CS.canLearn(sp, mv);
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
{
  const fs = require('fs'), SP = process.env.SHOWDOWN_PATH;
  const champ = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  /* EVERY onBeforeMove HANDLER A LEGAL ENTITY OF THIS FORMAT CAN RAISE, with its priority. */
  const ids = new Set(['brn', 'par', 'slp', 'frz', 'psn', 'tox', 'confusion', 'flinch', 'mustrecharge']);
  for (const m of dex.moves.all()) {
    if (!legal(m)) continue;
    if (m.condition) ids.add(m.id);
    if (m.volatileStatus) ids.add(m.volatileStatus);
    if (m.status) ids.add(m.status);
  }
  const rows = [];
  for (const id of ids) {
    const c = dex.conditions.get(id);
    if (c && c.exists && typeof c.onBeforeMove === 'function') {
      rows.push([id, c.onBeforeMovePriority === undefined ? 0 : c.onBeforeMovePriority]);
    }
  }
  for (const a of dex.abilities.all()) {
    if (!legal(a)) continue;
    if (typeof a.onBeforeMove === 'function') {
      rows.push(['ability:' + a.id, a.onBeforeMovePriority === undefined ? 0 : a.onBeforeMovePriority]);
    }
  }
  rows.sort((x, y) => y[1] - x[1]);
  console.log('EVERY onBeforeMove IN ' + CS.FORMAT + ', HIGH FIRST:');
  console.log('   ' + rows.map(r => r[0] + '=' + r[1]).join('  '));
  const TAGS = require(REL.path('data/tags.json'));
  const rec = (((TAGS.moves.chillyreception || {}).params || {}).volatileAnnounce || {}).byVolatile;
  const bm = rec && rec.chillyreception && rec.chillyreception.beforeOwnMove;
  console.log('the record this engine reads: ' + JSON.stringify(bm));
  /* CHAMPIONS DOES OVERRIDE FAKE OUT, AND THE OVERRIDE IS NOT ABOUT THIS FIXTURE: it replaces the
   * `onDisableMove` first-turn gate and inherits everything else. So the premise is asserted on the
   * RESOLVED move object — priority and the flinch chance, read out of `Dex.forFormat` so the mod is
   * already applied — rather than on "is there an override", which was this file's first check and
   * refused to run at all. */
  const fo = dex.moves.get('fakeout');
  const foFlinch = (fo.secondaries || []).find(s => s && s.volatileStatus === 'flinch');
  console.log('fakeout (mod-resolved) priority ' + fo.priority
    + '   flinch chance ' + (foFlinch ? foFlinch.chance : '(NONE)')
    + '   slowking base spe ' + dex.species.get('slowking').baseStats.spe
    + '   raichu base spe ' + dex.species.get('raichu').baseStats.spe
    + '   (the flincher must move first)');
  const bad = [];
  if (new RegExp('^\\tchillyreception: \\{', 'm').test(champ)) bad.push('Champions now overrides Chilly Reception');
  if (!foFlinch || foFlinch.chance !== 100) bad.push('Fake Out no longer flinches with certainty in '
    + 'this format, so the red arm would depend on a coin');
  if (!bm || bm.event !== '-prepare') bad.push('the release\'s data/tags.json no longer carries the '
    + 'beforeOwnMove record this engine reads, so nothing here can fire');
  if (!bm || bm.priority !== 100) bad.push('the record\'s priority is ' + (bm && bm.priority)
    + ', not 100 — the whole placement argument in this file is about that number');
  if (rows.length && rows[0][0] !== 'chillyreception') {
    bad.push('something now outranks chillyreception at BeforeMove (' + rows[0][0] + '='
      + rows[0][1] + '), so the head of the block is no longer the right slot');
  }
  if (dex.moves.get('fakeout').priority <= 0) bad.push('Fake Out is no longer a priority move');
  if (dex.species.get('raichu').baseStats.spe <= dex.species.get('slowking').baseStats.spe) {
    bad.push('the flincher is no longer faster than the body it flinches');
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
  const r = G.playGame(a, b, 'directed', 'probe_premajor_above_refusals :: ' + c.id,
    { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).premajorAtMoveLineRestored || 0 };
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

  const short = clean.r.turns < c.script.length;
  const refused = clean.sc.moveNotOnRequest;
  const R = { c, clean, brk, short, refused,
    ann: clean.delta.volatileAnnouncedBeforeMove || 0,
    annK: brk.delta.volatileAnnouncedBeforeMove || 0 };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out on the clean load']; continue; }
  const fails = [];
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  if (R.ann !== c.annClean) fails.push('volatileAnnouncedBeforeMove clean is ' + R.ann + ', declared ' + c.annClean);
  if (R.annK !== c.annKnob) fails.push('volatileAnnouncedBeforeMove knob is ' + R.annK + ', declared ' + c.annKnob);
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
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE'));
  console.log('    counters       volatileAnnouncedBeforeMove ' + R.ann + '/' + c.annClean + ' clean, '
    + R.annK + '/' + c.annKnob + ' knob');
  console.log('    MEDFAILS stamp clean ' + clean.restored + '   knob ' + brk.restored);
  const d = clean.r.div || brk.r.div;
  if (d) {
    console.log('    ' + (clean.r.div ? 'CLEAN' : 'KNOB') + ' parted:');
    console.log('      showdown  ' + d.sdRaw);
    console.log('      medicham  ' + d.meRaw);
  }
  for (const f of (R.fails || [])) console.log('    >> FAIL: ' + f);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing   [release ' + REL_ID + ']');
console.log(bad ? 'FAIL' : ONLY ? 'PASS for the arm(s) named by --only. THIS IS NOT THE FILE’S VERDICT.'
  : 'PASS — the `[premajor]` line is written above a refusal that would have swallowed it, exactly '
  + 'once when the move runs, and not at all for a move that owns no such record');
process.exit(bad ? 1 : 0);
