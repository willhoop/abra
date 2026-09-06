/* probe_fairy_aura.js — FAIRY AURA IS A PROPERTY OF THE FIELD AND THIS ENGINE CACHES IT ONCE A TURN,
 * SO IT SURVIVES THE HOLDER LEAVING AND ARRIVES A WHOLE TURN LATE. ROADMAP #542 (a). 2026-09-05.
 *
 *   SHOWDOWN_PATH=... node tests/probe_fairy_aura.js
 *   SHOWDOWN_PATH=... node tests/probe_fairy_aura.js --only aura-doors
 *
 * ================= WHAT THE AUTHORITY DOES, READ AND NOT RECALLED =================================
 *
 *     data/abilities.ts:1256-1268
 *       fairyaura: {
 *         onStart(pokemon) { if (this.suppressingAbility(pokemon)) return;
 *                            this.add('-ability', pokemon, 'Fairy Aura'); },
 *         onAnyBasePowerPriority: 20,
 *         onAnyBasePower(basePower, source, target, move) {
 *           if (target === source || move.category === 'Status' || move.type !== 'Fairy') return;
 *           if (!move.auraBooster?.hasAbility('Fairy Aura')) move.auraBooster = this.effectState.target;
 *           if (move.auraBooster !== this.effectState.target) return;
 *           return this.chainModify([move.hasAuraBreak ? 3072 : 5448, 4096]);
 *         },
 *         flags: {},
 *       }
 *
 * `onAnyBasePower` is a HANDLER REGISTERED ON A STANDING BODY. `Battle#findEventHandlers` collects it
 * by walking the bodies that are on the field AT THE MOMENT THE EVENT RUNS, so the ability's reach is
 * decided per-move and not per-turn: a holder that left is not walked, a holder that fainted is not
 * walked, and a holder that just arrived IS. Champions overrides neither the ability nor the walk —
 * checked at run time below, and refused loudly if that ever stops being true.
 *
 * ================= WHAT THIS ENGINE DOES =========================================================
 *
 * `engine/medicham2-browser.js` answers the aura out of a CACHE on the field:
 *
 *     field.aura = auraStateOf([...actA, ...actB]);      // battleTurn, top of every turn
 *     S.field.aura = auraStateOf([...S.actA, ...S.actB]); // megaEvolveNow, because a mega creates one
 *
 * and `auraFor(field, att, def)` returns `field.aura` whenever it is defined. Those are the ONLY two
 * writers. `recomputeWeatherSuppression` — the identical `onAny` shape, wired by WIRE 78 and ROADMAP
 * #352 — has FOUR: those two plus `runEntryPass` (a body arrives or leaves) and `_updateAll` (before
 * every action, which is the one that catches a FAINT). The aura got two of the four. So:
 *
 *     the holder switches OUT mid-turn   -> we keep boosting from a body that is not there
 *     the holder switches IN  mid-turn   -> we do not boost until the next turn starts
 *     the holder FAINTS       mid-turn   -> we keep boosting from a corpse
 *
 * ================= WHERE IT WAS FOUND ============================================================
 *
 * ROADMAP #542 bucket (a): four whole-game divergences on release `8ad06030e129`, all Moonblast, all
 * at a ratio near 5448/4096 = 1.33008, with the SIGN of the gap flipping with the door — two entries
 * where the authority boosts and we do not, one exit and one faint where we boost and it does not.
 * That row derives the attribution from the cards and says in its own words that the instrument it
 * owes "has not been built". This is that instrument. Nothing below is read off a card.
 *
 * ================= NOTHING BELOW IS TYPED ========================================================
 *
 * No arm declares a damage number. Every arm plays ONE board under the differential's `middle` pin and
 * the file asserts (a) that the two engines agree on every per-hit damage and on every board, (b) the
 * cross-arm claim read off SHOWDOWN ALONE — the aura must actually move the authority's number, a
 * departed aura must price exactly like no aura, and a returned aura must price exactly like a
 * standing one — and (c) that the knob-cleared control (the identical board with the mega never
 * clicked, so the only Fairy Aura body in the format never exists) moves nothing.
 *
 * THE CONTROL IS THE HALF THAT MATTERS. Floette-Eternal is on the board in BOTH arms, switching on
 * the same turns, taking the same actions. The single difference is `mega: true`, which is what turns
 * Flower Veil into Fairy Aura. An arm that swapped the body would be comparing two damage formulas.
 */
'use strict';
const path = require('path');
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
if (!REL_ID) REL_ID = ER.cut('tests/probe_fairy_aura.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
/* THE RESTORE KNOB. It does not exist until the fix lands, and this file says so OUT LOUD rather than
 * quietly reporting a pass: `knobBound` below is asserted, and a run where the knob cannot bind is a
 * run where the fix has not landed. Red-first is the point — before the fix the DOOR arms fail on
 * their own evidence and the knob clause fails beside them. */
const KNOB = 'MEDI_AURA_STALE';
const KNOB_STAMP = 'auraStaleRestored';

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

/* ---- THE BOARD ---------------------------------------------------------------------------------
 *
 * FLOETTE-ETERNAL + FLOETTITE IS THE WHOLE POPULATION. Derived below and refused if it ever stops
 * being true: `floettemega` is the ONLY legal species in this regulation carrying Fairy Aura, its
 * single ability slot IS Fairy Aura, and the only door to it is a mega evolution from Floette-Eternal.
 * That is why the arm has to mega — there is no way to put this ability on a board without one.
 *
 * THE AURA HOLDER IS NEVER THE ATTACKER AND NEVER THE TARGET. It stands in the far slot and does
 * nothing but switch. `onAnyBasePower` fires for every move on the field from either side, so this is
 * the half of the mechanic that is easiest to implement wrongly and flattering to leave out.
 *
 * THE ANVIL TAKES THE SAME MOONBLAST ON EVERY TURN OF EVERY ARM AND MUST NOT FAINT. Corviknight is
 * Flying/Steel, so the effectiveness is derived at 0.5 (asserted below, never typed), and it carries
 * the bulk to eat three boosted Moonblasts and still be standing. THE FIRST VERSION OF THIS FILE USED
 * SNORLAX AND IT WAS WRONG: neutral Fairy into 235 HP is 85 a hit under the aura, the third hit
 * KO'd it, and `|-damage|…|0 fnt` carries no `hp/maxhp` — so the reader saw TWO hits and the arm
 * reported a fixture failure instead of the entry door. A fixture that cannot survive its own script
 * measures nothing.
 *
 * ITS ABILITY IS UNNERVE, PICKED BECAUSE IT IS INERT ON THIS BOARD. Corviknight's other two are not:
 * Mirror Armor REFLECTS a stat drop, and Moonblast's 10% Sp. Atk secondary would then bounce back at
 * the Clefable and change the very number this file reads.
 *
 * NOBODY CLICKS PROTECT ON A TURN THAT MATTERS. Corviknight swings Body Press at the Clefable
 * (Fighting into Fairy, halved, and Clefable is Magic Guard so nothing rebounds), the Tinkaton in the
 * far slot Protects into an empty board where nothing is ever aimed at it, and Floette's only Protect
 * is on the mega turn. A consecutive-Protect failure therefore cannot change a single HP in this
 * file. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

const FLO = ['floetteeternal', 'floettite', 'Flower Veil', ['Protect', 'Calm Mind']];
const ANVIL = ['corviknight', '', 'Unnerve', ['Body Press', 'Protect']];
const CLEF = ['clefable', '', 'Magic Guard', ['Moonblast', 'Protect']];
/* THE EXECUTIONER, and it exists only for the FAINT door. Tinkaton's Gigaton Hammer is Steel into a
 * pure Fairy body, and it is faster than the Clefable — so on the faint turn the aura holder is a
 * corpse by the time the Moonblast is priced. Its ability is Own Tempo rather than its slot-0 Mold
 * Breaker: a breaker on the board would suppress the very `breakable` handlers this file must leave
 * alone (`fairyaura.flags` is `{}` and is NOT breakable, but Flower Veil on the control arm IS). */
const TINK = ['tinkaton', '', 'Own Tempo', ['Protect', 'Gigaton Hammer']];

const AURA_SIDE = stage([FLO, ANVIL]).concat(BENCH('garchomp', 'milotic'));
const FOE_SIDE = stage([CLEF, TINK]).concat(BENCH('sylveon', 'milotic'));

/* THE TWO SCRIPTS. Both open with the same turn — Floette Protects and MEGA EVOLVES — because that is
 * the only door onto this ability, and because turn 1's reading is each arm's own no-defect control:
 * the mega site was resynced on 2026-08-12 (`megaEvolveNow`, `fieldFactsResyncedOnMega`), so a
 * disagreement THERE would mean the fixture is measuring something other than the doors.
 *
 * THE DOORS SCRIPT — three turns, one Moonblast a turn at the same body:
 *   t1  Floette Protects and MEGA EVOLVES     -> the aura arrives
 *   t2  Floette SWITCHES OUT to Garchomp      -> THE EXIT DOOR
 *   t3  Floette SWITCHES BACK IN              -> THE ENTRY DOOR
 *
 * THE FAINT SCRIPT — two turns:
 *   t1  Floette Protects and MEGA EVOLVES     -> the aura arrives
 *   t2  Tinkaton KOs it with Gigaton Hammer BEFORE the slower Clefable clicks -> THE FAINT DOOR
 *
 * The faint door needs its own script because a body cannot both leave and die, and its own arm
 * because `_updateAll` — the site that catches a mid-turn faint for weather suppression — is a
 * DIFFERENT site from the entry pass that catches a switch. A fix that landed at one and not the
 * other would pass half this file. */
const MB = { m: 'moonblast', t: 1 }, BP = { m: 'bodypress', t: 0 }, P = { m: 'protect' };
const CM = { m: 'calmmind' }, GH = { m: 'gigatonhammer', t: 0 };
const opener = mega => ({ p1: [mega ? { m: 'protect', mega: true } : { m: 'protect' }, BP], p2: [MB, P] });
const DOORS = mega => ([
  opener(mega),
  { p1: [{ sw: 'garchomp' }, BP], p2: [MB, P] },
  { p1: [{ sw: 'floetteeternal' }, BP], p2: [MB, P] },
]);
const FAINT = mega => ([
  opener(mega),
  { p1: [CM, BP], p2: [MB, GH] },
]);
const DOORS_TURNS = ['aura ARRIVED at the mega', 'the holder LEFT (exit door)', 'the holder RETURNED (entry door)'];
const FAINT_TURNS = ['aura ARRIVED at the mega', 'the holder was KILLED first (faint door)'];

const CASES = [
  { id: 'aura-doors', kind: 'red', mega: true, script: DOORS, turns: DOORS_TURNS, control: 'aura-doors-control',
    what: 'THE ONLY LEGAL FAIRY AURA BODY IN THE FORMAT, megaing on turn 1 and then stepping off the '
        + 'field and back on. The same Moonblast is aimed at the same Corviknight on all three turns, '
        + 'so the only thing that moves is whether the aura is standing there. The authority decides '
        + 'that per move; this engine decided it once a turn.' },
  { id: 'aura-doors-control', kind: 'control', mega: false, script: DOORS, turns: DOORS_TURNS,
    what: 'THE KNOB CLEARED EXPLICITLY, ON THE SAME BODY AND THE SAME SCRIPT. Floette-Eternal is still '
        + 'there, still holding the Floettite, still switching out on turn 2 and back on turn 3 — the '
        + 'mega is simply never clicked, so its ability is Flower Veil and there is no Fairy Aura in '
        + 'the format on this board. This is what the cross-arm claim prices the doors against.' },
  { id: 'aura-faints', kind: 'red', mega: true, script: FAINT, turns: FAINT_TURNS, control: 'aura-faints-control',
    mustFaint: true,
    what: 'THE THIRD DOOR. The aura holder megas on turn 1 and is KILLED on turn 2 by a faster body, '
        + 'so the Moonblast that follows is priced with a corpse on the field. `auraStateOf` skips a '
        + 'fainted body — but `field.aura` is a snapshot taken before the turn began, and nothing '
        + 'retakes it when something dies.' },
  { id: 'aura-faints-control', kind: 'control', mega: false, script: FAINT, turns: FAINT_TURNS,
    mustFaint: true,
    what: 'THE SAME EXECUTION WITH NO AURA ON THE BOARD AT ALL. Floette-Eternal still eats the Gigaton '
        + 'Hammer and still dies on turn 2; the mega is simply never clicked.' },
];

/* ---- LEGALITY AND THE MECHANISM, DERIVED AND REFUSED ------------------------------------------- */
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
let illegal = 0;
for (const row of AURA_SIDE.concat(FOE_SIDE)) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  if (row.item && !legal(dex.items.get(row.item))) { console.log('ILLEGAL FIXTURE  item ' + row.item); illegal++; }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* THE POPULATION AND THE MULTIPLIER, ENUMERATED FROM THE FORMAT ON THIS RUN. If a second Fairy Aura
 * carrier becomes legal, or the mega door changes, or Champions starts overriding the ability, this
 * file says so and exits rather than reporting a pass about a rule that moved. */
const fs = require('fs');
const AURA_SPECIES = dex.species.all().filter(legal)
  .filter(s => Object.values(s.abilities || {}).some(a => dex.abilities.get(a).id === 'fairyaura'))
  .map(s => s.name);
const FA = dex.abilities.get('fairyaura');
const FA_SRC = String(FA.onAnyBasePower || '').replace(/\s+/g, ' ');
const STONE = dex.items.get('floettite');
const CHAMP_AB = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
const CHAMP_MV = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
console.log(NL + '  THE AUTHORITY, RE-DERIVED THIS RUN:');
console.log('    legal Fairy Aura carriers   : ' + (AURA_SPECIES.join(', ') || '(none)'));
console.log('    floettite megaStone         : ' + JSON.stringify(STONE.megaStone));
console.log('    fairyaura onAnyBasePower    : ' + FA_SRC.slice(0, 150));
/* THE CLICK IS READ OUT OF `Dex.forFormat`, WHICH HAS ALREADY APPLIED THE MOD — never out of
 * `data/moves.ts`. Champions DOES override `moonblast` (`data/mods/champions/moves.ts:652`) and the
 * override is `inherit: true` with the secondary chance moved to 10%; base power, type, category and
 * target are the mainline row. So the override is printed and NOT refused: what this fixture depends
 * on is that the click is a single-target Fairy special move, and that is asserted from the format
 * itself. Refusing on the mere EXISTENCE of an override would have made this file unrunnable over a
 * change to a secondary it does not read. */
const MOON = dex.moves.get('moonblast');
console.log('    moonblast, as the FORMAT has it : type ' + MOON.type + '  cat ' + MOON.category
  + '  bp ' + MOON.basePower + '  target ' + MOON.target + '  acc ' + MOON.accuracy
  + '  secondary ' + JSON.stringify(MOON.secondary));
const ANVIL_SP = dex.species.get(ANVIL[0]);
const EFF = dex.getEffectiveness(MOON.type, ANVIL_SP.types);
console.log('    the anvil                   : ' + ANVIL_SP.name + ' ' + ANVIL_SP.types.join('/')
  + '   Fairy effectiveness ' + EFF + ' (0 neutral, -1 resisted)  immune '
  + !dex.getImmunity(MOON.type, ANVIL_SP.types));
console.log('    champions overrides fairyaura : ' + /\bfairyaura\s*:/.test(CHAMP_AB)
  + '   moonblast: ' + /\bmoonblast\s*:/.test(CHAMP_MV) + ' (secondary chance only)');
if (AURA_SPECIES.length !== 1 || dex.species.get(AURA_SPECIES[0]).id !== 'floettemega'
    || !/chainModify\(\[\s*move\.hasAuraBreak \? 3072 : 5448, 4096\s*\]\)/.test(FA_SRC)
    || !/target === source/.test(FA_SRC)
    || !(STONE.megaStone && STONE.megaStone['Floette-Eternal'] === 'Floette-Mega')
    || MOON.type !== 'Fairy' || MOON.category !== 'Special' || !(MOON.basePower > 0)
    || MOON.target !== 'normal' || MOON.accuracy !== 100
    || !dex.getImmunity(MOON.type, ANVIL_SP.types) || EFF >= 0
    || /\bfairyaura\s*:/.test(CHAMP_AB)) {
  console.log(NL + 'NOT RUN — the format no longer carries the rule this file is about. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READERS -------------------------------------------------------------------------------- */
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const KEEP = /^\|(move|switch|cant|-damage|-heal|-fail|-crit|-supereffective|-resisted|-immune|faint|-activate|-singleturn|-boost|-ability|detailschange|-mega|-formechange)\|/;
function shape(lines) {
  const out = [];
  for (const raw of lines.map(String)) {
    if (!KEEP.test(raw)) continue;
    const p = raw.split('|');
    const tag = p[1], who = norm(String(p[2] || '').split(':').slice(-1)[0]);
    const rest = p.slice(3).filter(x => !/^p[12][ab]:/.test(x))
      .map(x => norm(String(x).replace(/^\s*(move|ability|item):\s*/i, ''))).filter(Boolean);
    out.push(tag + '|' + who + '|' + rest.join('|'));
  }
  return out;
}
/* THE PER-HIT DAMAGE THE ANVIL TOOK, in order, read off each stream's OWN `-damage` lines as the drop
 * from the previous remaining HP. Nothing is recomputed and nothing is attributed to a turn number:
 * the anvil is hit by exactly one move in this whole file, so the i-th entry IS turn i's Moonblast. */
function anvilHits(lines) {
  const out = []; let prev = null;
  for (const raw of lines.map(String)) {
    const m = /^\|-damage\|p[12][ab]: ?([^|]*)\|(\d+)\/(\d+)/.exec(raw);
    if (!m || norm(m[1]) !== norm(ANVIL[0])) continue;
    const rem = +m[2], max = +m[3];
    out.push((prev === null ? max : prev) - rem);
    prev = rem;
  }
  return out;
}
/* A KO PRINTS `|-damage|…|0 fnt` AND CARRIES NO `hp/maxhp`, so the reader above simply would not see
 * it. That is exactly how the first version of this fixture silently lost its third hit, so the faint
 * is looked for by name and reported as a FIXTURE failure rather than left to a short array. */
const anvilFainted = lines => lines.map(String).some(raw => {
  const m = /^\|(?:-damage|faint)\|p[12][ab]: ?([^|]*)(?:\|(.*))?$/.exec(raw);
  return !!m && norm(m[1]) === norm(ANVIL[0]) && (/^\|faint\|/.test(raw) || /\bfnt\b/.test(m[2] || ''));
});
/* AND THE OPPOSITE ASSERTION, FOR THE FAINT ARM: the aura holder MUST die, or that arm staged a body
 * standing quietly on the field and called it a corpse. Matched on the `|faint|` line rather than on
 * an HP number, and on the base name because the mega RENAMES the body (Floette-Eternal ->
 * Floette-Mega) — a match on the sheet's species would silently read false on the arm that megaed. */
const holderFainted = lines => lines.map(String).some(raw =>
  /^\|faint\|p[12][ab]: ?/.test(raw) && /floette/.test(norm(String(raw.split('|')[2] || ''))));

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters(); G.resetChoiceCounters();
  /* `resetScriptCounters` does not clear `scriptMegaRefused` (it is not in the reset list), so this
   * file reads it as a DELTA rather than as a level. A level would report the previous arm's refusal. */
  const megaRefused0 = G.scriptCounters().megaRefused;
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const a = G.buildPair(AURA_SIDE), b = G.buildPair(FOE_SIDE);
  if (!a || !b) return { notStaged: true };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_fairy_aura :: ' + c.id, {
    script: c.script(c.mega), arm,
    onBoundary: (snap, t) => boards.push({ t, identical: !!snap.identical,
                                           diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) }),
  });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  return { r, delta, boards, sd: shape(sdAll), me: shape(meAll),
           sdHits: anvilHits(sdAll), meHits: anvilHits(meAll),
           sdFaint: anvilFainted(sdAll), meFaint: anvilFainted(meAll),
           sdHolderDied: holderFainted(sdAll), meHolderDied: holderFainted(meAll),
           sc: Object.assign({}, G.scriptCounters(), { megaRefused: G.scriptCounters().megaRefused - megaRefused0 }),
           cc: G.choiceCounters(),
           restored: (globalThis.MEDFAILS || {})[KNOB_STAMP] || 0 };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
const boardEq = rows => rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');

let bad = 0, ran = 0;
const seen = new Map();
let knobBound = false;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   mega clicked: ' + c.mega);
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;
  if (brk.restored) knobBound = true;

  const NT = c.turns.length;
  for (let i = 0; i < Math.max(clean.sdHits.length, clean.meHits.length, NT); i++) {
    console.log('    turn ' + (i + 1) + '  ' + (c.turns[i] || '(unscripted)'));
    console.log('      ' + ANVIL_SP.name + ' lost   showdown ' + clean.sdHits[i]
      + '   medicham ' + clean.meHits[i] + '   |   knob medicham ' + brk.meHits[i]);
  }
  console.log('    board          ' + boardStr(clean.boards) + '   |   knob ' + boardStr(brk.boards));
  if (!boardEq(clean.boards)) for (const b of clean.boards) if (!b.identical) console.log('      b' + b.t + ' diffs ' + JSON.stringify(b.diffs));
  console.log('    counters  megaEvolved ' + (clean.delta.megaEvolved || 0)
    + '  fieldFactsResyncedOnMega ' + (clean.delta.fieldFactsResyncedOnMega || 0)
    + '  entryFieldSync ' + (clean.delta.entryFieldSync || 0));
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '  knob ' + brk.restored
    + '   |   clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : '')
    + '   |   mega refused ' + clean.sc.megaRefused
    + '   |   choices refused ' + clean.cc.refused);

  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.cc.refused || brk.cc.refused) {
    console.log('    >> FIXTURE FAILED — the authority refused a choice.'); bad++; continue; }
  if (c.mega && (clean.sc.megaRefused || (clean.delta.megaEvolved || 0) !== 1)) {
    console.log('    >> FIXTURE FAILED — the mega did not happen, so there is no Fairy Aura on this board.'); bad++; continue; }
  if (!c.mega && (clean.delta.megaEvolved || 0) !== 0) {
    console.log('    >> FIXTURE FAILED — the control megaed anyway, so it is not a control.'); bad++; continue; }
  if (clean.sdFaint || clean.meFaint || brk.sdFaint || brk.meFaint) {
    console.log('    >> FIXTURE FAILED — the anvil FAINTED, so a hit is missing from the reading '
      + '(a KO prints `0 fnt` and no hp/maxhp).'); bad++; continue; }
  if (clean.sdHits.length !== NT || clean.meHits.length !== NT || brk.meHits.length !== NT) {
    console.log('    >> FIXTURE FAILED — ' + NT + ' Moonblasts were not read on the anvil (showdown '
      + clean.sdHits.length + ', medicham ' + clean.meHits.length + ', knob ' + brk.meHits.length
      + '), so the per-turn reading means nothing.'); bad++; continue; }
  /* THE FAINT ARM'S OWN FIXTURE CLAIM, ASSERTED ON BOTH ENGINES AND ON THE KNOB LEG. An arm that
   * reports the faint door while the holder is still standing is measuring the exit door with extra
   * steps, and would go green off a board that never had a corpse on it. */
  if (c.mustFaint && !(clean.sdHolderDied && clean.meHolderDied && brk.meHolderDied)) {
    console.log('    >> FIXTURE FAILED — the aura holder did not faint (showdown '
      + clean.sdHolderDied + ', medicham ' + clean.meHolderDied + ', knob ' + brk.meHolderDied
      + '), so there is no faint door on this board.'); bad++; continue; }
  if (!c.mustFaint && (clean.sdHolderDied || clean.meHolderDied)) {
    console.log('    >> FIXTURE FAILED — the aura holder fainted on an arm that never asked it to.');
    bad++; continue; }

  seen.set(c.id, { sdHits: clean.sdHits, turns: c.turns });

  /* THE VERDICT IS BOARD-MATERIAL: the per-hit damage and the compared board. NARRATION IS REPORTED
   * BESIDE IT AND DOES NOT DECIDE THIS FILE — the standing bar Will set on 2026-08-22, *commentary may
   * differ; boards may not* — and it is said here rather than left to be inferred from a regex,
   * because a silently narrowed comparison is how a probe stops asking anything. Measured on this
   * fixture the one standing gap is `|-ability|…|Unnerve` on the anvil's switch-in, which this engine
   * does not print; it is on EVERY arm including both controls, so it cannot flatter a red one. */
  /* COUNTED AS A MULTISET, NOT BY INDEX. An index walk reports a single inserted line as a difference
   * on every line after it — this fixture read 33 that way, and the truth is one missing announcement
   * repeated. A count that inflates is a count nobody can act on. */
  {
    const bag = new Map();
    for (const k of clean.sd) bag.set(k, (bag.get(k) || 0) + 1);
    for (const k of clean.me) bag.set(k, (bag.get(k) || 0) - 1);
    const onlySd = [...bag].filter(([, v]) => v > 0), onlyMe = [...bag].filter(([, v]) => v < 0);
    if (onlySd.length || onlyMe.length) {
      console.log('    NARRATION (second gate, not this file\'s verdict) — only in showdown: '
        + (onlySd.map(([k, v]) => k + ' x' + v).join(', ') || 'none')
        + '   |   only in medicham: '
        + (onlyMe.map(([k, v]) => k + ' x' + (-v)).join(', ') || 'none'));
    }
  }

  const agree = boardEq(clean.boards) && eq(clean.sdHits, clean.meHits);
  if (!agree) {
    console.log('    >> DEFECT — the engines part on the damage sequence or on the board.');
    for (let i = 0; i < NT; i++) if (clean.sdHits[i] !== clean.meHits[i]) {
      console.log('       turn ' + (i + 1) + ' — ' + c.turns[i] + ': showdown ' + clean.sdHits[i]
        + ', medicham ' + clean.meHits[i]
        + (clean.sdHits[i] && clean.meHits[i]
           ? '   ratio ' + (clean.meHits[i] / clean.sdHits[i]).toFixed(4) + ' (medicham/showdown)' : ''));
    }
    bad++;
  } else console.log('    >> the two engines agree on every hit AND on every board.');

  const knobAgree = boardEq(brk.boards) && eq(clean.sdHits, brk.meHits);
  if (c.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this a red arm.');
  } else {
    if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob, so the change is not confined.'); bad++; }
  }
}

/* ---- THE CROSS-ARM CLAIM, READ OFF SHOWDOWN ALONE ----------------------------------------------
 *
 * Three claims, none of them typed, all of them about the AUTHORITY's own numbers, and every one of
 * them a TURN-BY-TURN comparison of the two arms rather than a comparison of turns within one arm.
 * THAT IS NOT A STYLE CHOICE. The `middle` pin draws a REAL damage index per hit, so an arm's own
 * three turns are three different rolls and are not comparable to each other; the SAME turn of the
 * two arms is the same roll, which is a fact this run demonstrates rather than assumes — the exit
 * turn reads the identical integer on both arms, which it could not do under different rolls.
 *
 *   1. the aura MOVES the number         : red turn 1 >  control turn 1
 *   2. a DEPARTED aura prices like none  : red turn 2 == control turn 2
 *   3. a RETURNED aura is a live aura    : red turn 3 >  control turn 3
 */
const WANT = { 'aura-doors': ['up', 'eq', 'up'], 'aura-faints': ['up', 'eq'] };
for (const rid of Object.keys(WANT)) {
  const R = seen.get(rid), cid = (CASES.find(c => c.id === rid) || {}).control, C = cid && seen.get(cid);
  if (!R || !C) continue;
  console.log(NL + '  THE RULE, READ OFF SHOWDOWN ALONE — ' + rid + ' against ' + cid
    + '   (fairyaura chainModify = 5448/4096 = ' + (5448 / 4096).toFixed(5) + ')');
  WANT[rid].forEach((want, i) => {
    const a = R.sdHits[i], b = C.sdHits[i];
    console.log('    turn ' + (i + 1) + '  ' + String(R.turns[i]).padEnd(34) + ' aura arm ' + String(a).padStart(4)
      + '   control ' + String(b).padStart(4)
      + '   ratio ' + (b ? (a / b).toFixed(4) : 'n/a') + '   -> ' + (a === b ? 'EQUAL' : a > b ? 'HIGHER' : 'LOWER'));
    if (want === 'up' && !(a > b)) {
      console.log('      >> THE AURA DID NOTHING IN THE AUTHORITY HERE — nothing this arm reports is '
        + 'attributable to Fairy Aura.'); bad++; }
    if (want === 'eq' && a !== b) {
      console.log('      >> A GONE AURA DID NOT PRICE LIKE NO AURA IN THE AUTHORITY. That door is not '
        + 'what this fixture staged, and the two arms may not even share a damage roll.'); bad++; }
  });
}

if (!ONLY && !knobBound) {
  console.log(NL + '  KNOB ABSENT — `' + KNOB + '` set no `MEDFAILS.' + KNOB_STAMP + '` on any arm.');
  console.log('    The restore knob does not exist in this engine, so the fix has not landed. This is '
    + 'the red-first state, not a pass.');
  bad++;
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
