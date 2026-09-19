/* probe_unburden_leaf.js — IS UNBURDEN'S STATE COMPARED, AND DOES A WRONG ONE PART THE BOARD? 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_unburden_leaf.js                      live tree, scratch release
 *   SHOWDOWN_PATH=... node tests/probe_unburden_leaf.js --release <id>       a named release
 *   SHOWDOWN_PATH=... node tests/probe_unburden_leaf.js --only take
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * Will, 2026-09-19: *"we need unburden to fire its a common one. i know the chat/log wont announce it
 * but we need to track it and in open team sheets we know if a mon is unburden or not and if its held
 * item was consumed"*.
 *
 * `engine/board_state.js` declared `volatile:unburden` UNCOMPARABLE: medicham2 held no field for it
 * (`effSpeed` recomputed the doubling from `_hadItem && !m.item`), and the authority's condition has no
 * `onStart` line, so the protocol never announces it. A wrong Unburden state was invisible to every
 * gate. medicham2 now holds the volatile as state (`_ubVol`, granted at the three loss doors, ended by
 * the ability's End and by leaving the field) and the board compares it as
 * `vol.unburden` on both engines. This probe is the falsifier.
 *
 * ================= THE AUTHORITY, READ AT RUN TIME ==============================================
 *
 * data/abilities.ts `unburden` (no key in data/mods/champions/): `onAfterUseItem` and `onTakeItem` add
 * the volatile, `onEnd` removes it, the condition's `onModifySpe` doubles while `!pokemon.item`. The
 * probe re-reads those handlers from the format's dex and refuses to run if they change shape.
 *
 * ================= THE ARMS =====================================================================
 *
 * Every carrier is a DERIVED legal Unburden body (Sneasler, Liepard, Hawlucha), and every fixture is
 * refused unless the format's TeamValidator accepts every species / ability / item / move in it.
 *
 *   eat            Arbok's Glare paralyses Sneasler @ Lum Berry; the berry is EATEN   knob no-eat
 *   use            Sneasler @ White Herb clicks Close Combat; the herb is USED        knob no-use
 *   fling          Sneasler @ Focus Sash Flings it                                    knob no-fling
 *   take           Arbok Knock Offs Sneasler's Leftovers                              knob no-take
 *   trick          Liepard @ Leftovers Tricks for a foe's Sitrus Berry: the volatile  knob no-take
 *                  stands on a body that is HOLDING an item (no doubling)
 *   switch         knocked off, then switches out: the BENCHED body holds none        knob survives-switch
 *   regain         knocked off, then Thiefs a Leftovers: the volatile SURVIVES        knob ends-on-regain
 *                  regaining an item (the brief assumed it ended; the authority says
 *                  it does not, and this arm is where that is decided)
 *   ability-end    knocked off, then Worry Seeded: Unburden's End removes it          knob survives-ability-end
 *   acquired       walks in EMPTY-HANDED, Thiefs a Leftovers, is knocked off: the     knob legacy-read
 *                  volatile is granted at the loss. Observable: SPEED (speedRows),
 *                  because the retired read's error is in effSpeed, not the state
 *   baton          Hawlucha knocked off, then Baton Passes. `noCopy` is false, and    knob baton-carries
 *                  STILL the recipient holds nothing: the outgoing ability's End
 *                  (which removes it) runs at sim/battle-actions.ts:103, before
 *                  `copyVolatileFrom` at :114. This arm's first version expected a
 *                  carry and the AUTHORITY refused it — kept as the lesson.
 *
 * PER ARM: the CLEAN run must never part `vol.unburden`, and the AUTHORITY must actually hold the
 * volatile at some boundary (or, for `switch` / `ability-end`, must drop it) — otherwise the arm is a
 * claim about the FIXTURE. The KNOB run must part `vol.unburden`. A knob that parts nothing is the
 * unwired-knob signature and FAILS. The driver's own Speed comparison (`speedRows`, getActionSpeed
 * against effSpeed at every boundary) is printed per arm and a clean-run disagreement FAILS, because
 * the doubled Speed is the consequence that matters in play.
 *
 * EXIT 0 pass / 1 fail / 2 cannot answer.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);
/* THE BOARD IS THE MEASUREMENT: `--state` is what makes the driver read one at every boundary. */
if (!process.argv.includes('--state')) process.argv.push('--state');

const ER =require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_unburden_leaf.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_UNBURDEN_BREAK';
const BS = require(D('engine', 'board_state.js'));

let _cur = null, _G = null;
function harness(mode) {
  const key = mode || '';
  if (_G && _cur === key) return _G;
  if (mode) process.env[KNOB] = mode; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE AUTHORITY, READ, AND THE LEAF, ASKED OF THE COMPARATOR ------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const V = new TeamValidator(CS.FORMAT);
const DX = V.dex;
const UB = DX.abilities.get('unburden');
const src = f => String(f || '');
const read = {
  onTakeItem_adds: /addVolatile\(\s*["']unburden["']/.test(src(UB.onTakeItem)),
  onAfterUseItem_adds: /addVolatile\(\s*["']unburden["']/.test(src(UB.onAfterUseItem)),
  onEnd_removes: /removeVolatile\(\s*["']unburden["']/.test(src(UB.onEnd)),
  condition_needs_empty_hand: /!pokemon\.item/.test(src(UB.condition && UB.condition.onModifySpe)),
  noCopy: DX.conditions.getByID('unburden').noCopy,
};
console.log(NL + 'tests/probe_unburden_leaf.js   release ' + REL_ID);
console.log('  READ AT RUN TIME, NOT RECALLED (data/abilities.ts unburden, format ' + CS.FORMAT + '):');
for (const [k, v] of Object.entries(read)) console.log('    ' + k.padEnd(28) + JSON.stringify(v));
if (!read.onTakeItem_adds || !read.onAfterUseItem_adds || !read.onEnd_removes || !read.condition_needs_empty_hand) {
  console.log(NL + 'CANNOT ANSWER — the authority\'s Unburden no longer has the shape this probe stages.'); process.exit(2);
}
console.log('  in the comparator: ' + (BS.SD_VOLATILE_KEYS.includes('unburden') ? 'YES' : 'NO')
  + '      declared in NOT_COMPARED: ' + (BS.DECLARED_LEAVES.has('volatile:unburden') ? 'YES' : 'no'));

/* ---- LEGALITY, REFUSED RATHER THAN ASSUMED ---------------------------------------------------- */
function problems(m) {
  const sp = DX.species.get(m.species), out = [];
  if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') { out.push(m.species + ' is not legal'); return out; }
  if (m.ability && !Object.values(sp.abilities).map(a => DX.abilities.get(a).id).includes(DX.abilities.get(m.ability).id)) out.push(sp.name + ' cannot have ' + m.ability);
  if (m.item && DX.items.get(m.item).isNonstandard) out.push(m.item + ' is not legal');
  for (const mv of m.moves) {
    const mm = DX.moves.get(mv);
    if (!mm.exists || mm.isNonstandard) { out.push(mv + ' is not legal'); continue; }
    if (V.checkCanLearn(mm, sp, V.allSources(sp), { species: sp.name, moves: [mv] })) out.push(sp.name + ' cannot learn ' + mm.name);
  }
  return out;
}
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability, moves });
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };

/* THE FOES. Arbok carries both Glare (100% accuracy, no damage) and Knock Off; Corviknight is the bulky
 * target Close Combat and Fling are thrown at; Whimsicott carries Worry Seed. Every body is Protect-
 * capable so a slot with nothing to do spends its turn without touching the board. */
/* Shed Skin, not Intimidate: an Intimidate at entry spends a White Herb before turn 1, which would
 * stage the `use` road at the wrong moment. */
const ARBOK = (item) => mon('arbok', item || '', 'Shed Skin', ['Glare', 'Knock Off', 'Protect']);
const CORV = (item) => mon('corviknight', item || '', 'Pressure', ['Bulk Up', 'Protect']);
const WHIM = mon('whimsicott', '', 'Infiltrator', ['Worry Seed', 'Protect']);
const FILL = [mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('toxapex', '', 'Limber', ['Recover', 'Protect'])];
const SNEAS = (item, moves) => mon('sneasler', item, 'Unburden', moves);
const ALLY = mon('clefable', '', 'Magic Guard', ['Calm Mind', 'Protect']);

const CASES = [
  { id: 'eat', knob: 'no-eat', carrier: 'sneasler', want: 'held',
    p1: [SNEAS('Lum Berry', ['Swords Dance', 'Protect']), ALLY, ...FILL],
    p2: [ARBOK(''), CORV(''), ...FILL],
    script: [T([{ m: 'swordsdance' }, { m: 'calmmind' }], [{ m: 'glare', t: 0 }, { m: 'bulkup' }]),
             T([{ m: 'swordsdance' }, { m: 'calmmind' }], [PROT, { m: 'bulkup' }])] },
  { id: 'use', knob: 'no-use', carrier: 'sneasler', want: 'held',
    p1: [SNEAS('White Herb', ['Close Combat', 'Protect']), ALLY, ...FILL],
    p2: [CORV(''), ARBOK(''), ...FILL],
    script: [T([{ m: 'closecombat', t: 0 }, { m: 'calmmind' }], [{ m: 'bulkup' }, PROT]),
             T([PROT, { m: 'calmmind' }], [{ m: 'bulkup' }, PROT])] },
  { id: 'fling', knob: 'no-fling', carrier: 'sneasler', want: 'held',
    p1: [SNEAS('Focus Sash', ['Fling', 'Protect']), ALLY, ...FILL],
    p2: [CORV(''), ARBOK(''), ...FILL],
    script: [T([{ m: 'fling', t: 0 }, { m: 'calmmind' }], [{ m: 'bulkup' }, PROT]),
             T([PROT, { m: 'calmmind' }], [{ m: 'bulkup' }, PROT])] },
  { id: 'take', knob: 'no-take', carrier: 'sneasler', want: 'held',
    p1: [SNEAS('Leftovers', ['Swords Dance', 'Protect']), ALLY, ...FILL],
    p2: [ARBOK(''), CORV(''), ...FILL],
    script: [T([{ m: 'swordsdance' }, { m: 'calmmind' }], [{ m: 'knockoff', t: 0 }, { m: 'bulkup' }]),
             T([{ m: 'swordsdance' }, { m: 'calmmind' }], [PROT, { m: 'bulkup' }])] },
  { id: 'trick', knob: 'no-take', carrier: 'liepard', want: 'held',
    p1: [mon('liepard', 'Leftovers', 'Unburden', ['Trick', 'Protect']), ALLY, ...FILL],
    p2: [CORV('Sitrus Berry'), ARBOK(''), ...FILL],
    script: [T([{ m: 'trick', t: 0 }, { m: 'calmmind' }], [{ m: 'bulkup' }, PROT]),
             T([PROT, { m: 'calmmind' }], [{ m: 'bulkup' }, PROT])] },
  { id: 'switch', knob: 'survives-switch', carrier: 'sneasler', want: 'dropped',
    p1: [SNEAS('Leftovers', ['Swords Dance', 'Protect']), ALLY, ...FILL],
    p2: [ARBOK(''), CORV(''), ...FILL],
    script: [T([{ m: 'swordsdance' }, { m: 'calmmind' }], [{ m: 'knockoff', t: 0 }, { m: 'bulkup' }]),
             T([{ sw: 'milotic' }, { m: 'calmmind' }], [PROT, { m: 'bulkup' }]),
             T([{ m: 'recover' }, { m: 'calmmind' }], [PROT, { m: 'bulkup' }])] },
  { id: 'regain', knob: 'ends-on-regain', carrier: 'sneasler', want: 'held',
    p1: [SNEAS('Leftovers', ['Thief', 'Swords Dance', 'Protect']), ALLY, ...FILL],
    p2: [ARBOK(''), CORV('Leftovers'), ...FILL],
    script: [T([{ m: 'swordsdance' }, { m: 'calmmind' }], [{ m: 'knockoff', t: 0 }, { m: 'bulkup' }]),
             T([{ m: 'thief', t: 1 }, { m: 'calmmind' }], [PROT, { m: 'bulkup' }]),
             T([PROT, { m: 'calmmind' }], [PROT, { m: 'bulkup' }])] },
  { id: 'ability-end', knob: 'survives-ability-end', carrier: 'sneasler', want: 'dropped',
    p1: [SNEAS('Leftovers', ['Swords Dance', 'Protect']), ALLY, ...FILL],
    p2: [ARBOK(''), WHIM, ...FILL],
    script: [T([{ m: 'swordsdance' }, { m: 'calmmind' }], [{ m: 'knockoff', t: 0 }, PROT]),
             T([{ m: 'swordsdance' }, { m: 'calmmind' }], [PROT, { m: 'worryseed', t: 0 }]),
             T([{ m: 'swordsdance' }, { m: 'calmmind' }], [PROT, PROT])] },
  /* THE ONE ARM WHOSE OBSERVABLE IS SPEED, because the break it names is in the READ and not in the state:
   * `legacy-read` is effSpeed's retired `_hadItem && !m.item`, and `_hadItem` is stamped only at entry — so a
   * Sneasler that walks in empty-handed, steals a Leftovers and has it knocked off holds the volatile on both
   * engines and doubled on only one. The leaf agrees under the knob; `speedRows` must not. */
  { id: 'acquired', knob: 'legacy-read', observe: 'speed', carrier: 'sneasler', want: 'held',
    p1: [SNEAS('', ['Thief', 'Swords Dance', 'Protect']), ALLY, ...FILL],
    p2: [ARBOK(''), CORV('Leftovers'), ...FILL],
    script: [T([{ m: 'thief', t: 1 }, { m: 'calmmind' }], [PROT, { m: 'bulkup' }]),
             T([{ m: 'swordsdance' }, { m: 'calmmind' }], [{ m: 'knockoff', t: 0 }, { m: 'bulkup' }]),
             T([{ m: 'swordsdance' }, { m: 'calmmind' }], [PROT, { m: 'bulkup' }])] },
  { id: 'baton', knob: 'baton-carries', carrier: 'hawlucha', want: 'dropped',
    p1: [mon('hawlucha', 'Leftovers', 'Unburden', ['Swords Dance', 'Baton Pass', 'Protect']), ALLY, ...FILL],
    p2: [ARBOK(''), CORV(''), ...FILL],
    /* Knocked off on turn 1, Baton Pass on turn 2. The carrier read is Hawlucha; the RECIPIENT's leaf is
     * compared by the board like every other body's, which is where `baton-carries` parts. */
    script: [T([{ m: 'swordsdance' }, { m: 'calmmind' }], [{ m: 'knockoff', t: 0 }, { m: 'bulkup' }]),
             T([{ m: 'batonpass', to: 'milotic' }, { m: 'calmmind' }], [PROT, { m: 'bulkup' }]),
             T([{ m: 'recover' }, { m: 'calmmind' }], [PROT, { m: 'bulkup' }])] },
];

let illegal = 0;
for (const c of CASES) for (const m of c.p1.concat(c.p2)) for (const p of problems(m)) { console.log('  ILLEGAL FIXTURE  [' + c.id + '] ' + p); illegal++; }
if (illegal) { console.log(NL + 'CANNOT ANSWER — ' + illegal + ' illegal fixture entr(y/ies). This is not a pass.'); process.exit(2); }
console.log('  fixture legality (TeamValidator): every species, ability, item and move in ' + CASES.length + ' arms is legal');

/* ---- THE RUN ------------------------------------------------------------------------------------ */
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const LEAF = /\.vol\.unburden$/;
function play(G, c) {
  G.resetScriptCounters();
  const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
  if (!a || !b) return { notStaged: true, which: (!a ? 'A' : 'B') };
  const reads = [], leafDiffs = [], otherDiffs = [];
  /* `--arm <id>` plays the driver's named dice arm (e.g. `middle`, real seeded dice); absent, the driver's
   * staged default. An unknown id is refused rather than silently defaulted. */
  const armId = ARG('--arm');
  const arm = armId ? G.ARM_BY_ID.get(armId) : undefined;
  if (armId && !arm) { console.log('CANNOT ANSWER — the driver has no arm named ' + armId); process.exit(2); }
  const r = G.playGame(a, b, 'directed', 'probe_unburden_leaf :: ' + c.id + (_cur ? ' :: ' + _cur : ''), {
    script: c.script, arm,
    onBoundary: (snap, turnIdx, S, battle) => {
      const all = [...(S.actA || []), ...(S.benchA || [])].filter(Boolean);
      const m = all.find(x => norm(x.name) === c.carrier);
      const p = battle.p1.pokemon.find(x => norm(x.species.id) === c.carrier);
      reads.push({ t: turnIdx,
        med: m ? (m._ubVol ? 1 : 0) : '?', sd: p ? (p.volatiles.unburden ? 1 : 0) : '?',
        item_med: m ? norm(m.item || m._roomItem || '') : '?', item_sd: p ? norm(p.item) : '?',
        onField_sd: p ? !!p.isActive : '?' });
      for (const d of snap.diffs) (LEAF.test(d.path) ? leafDiffs : otherDiffs).push({ t: turnIdx, path: d.path, medicham: d.medicham, showdown: d.showdown });
      /* NEUTRALISED AFTER COPYING, so a parted turn does not end a multi-turn arm (staged_board.js's rule). */
      snap.identical = true; snap.diffs = [];
    } });
  return { r, reads, leafDiffs, otherDiffs, sc: G.scriptCounters(),
           speedRows: (r && r.speedRows) || [], stamp: ((globalThis.MEDFAILS || {}).unburdenBreakKnob) || 0 };
}
const fmtReads = rs => rs.map(x => 'b' + x.t + ' ' + x.med + '/' + x.sd + ' item ' + (x.item_med || '-') + '/' + (x.item_sd || '-')
  + (x.onField_sd === false ? ' (bench)' : '')).join('   ');

/* ---- `--pool <dir>`: THE PINNED POOL'S OWN TEAMS, NOT A STAGED FIXTURE -------------------------------
 *
 * Takes the frozen pool's bo3 games whose OPEN SHEET carries an Unburden body that was BROUGHT and whose
 * record shows that body's item ending (`ei` events, engine/durable-ingest.js:411), and plays each game's
 * two sheets — brought four first, leads first — through both engines with the driver's own chooser
 * (`baseline` config, primary dice arm). It is the TEAMS of a real game, not its clicks: the store records
 * effects, not choices, and a two-engine replay needs choices. Reported per game: boundaries where the
 * AUTHORITY held `unburden` on any body, `vol.unburden` diffs (must be 0), other board diffs (reported,
 * not this probe's claim), and the driver's Speed disagreements on Unburden bodies.
 * `--pool-max N` caps the games (default 12). */
const POOL = ARG('--pool');
if (POOL) {
  const fs = require('fs');
  const G = harness(null);
  const MAX = +(ARG('--pool-max') || 12);
  const file = path.join(POOL, 'games.bo3.jsonl');
  const picked = [];
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    if (picked.length >= MAX) break;
    if (!l.trim()) continue;
    let g; try { g = JSON.parse(l); } catch (e) { console.log('  unreadable pool line: ' + e.message); continue; }
    if (!g.sheets) continue;
    const ev = [].concat(...(g.turns || []).map(t => t.ev || []));
    const hit = ['p1', 'p2'].some(side => (g.sheets[side] || []).some(m => norm(m.ability) === 'unburden'
      && ((g.brought || {})[side] || []).map(norm).includes(norm(m.species))
      && ev.some(e => e.t === 'ei' && norm(e.mon) === norm(m.species) && String(e.s || '').slice(0, 2) === side)));
    if (hit) picked.push(g);
  }
  console.log(NL + '  POOL MODE — ' + file + '   ' + picked.length + ' game(s) with a brought Unburden body whose item ended');
  const order = (g, side) => {
    const sh = g.sheets[side] || [], br = ((g.brought || {})[side] || []).map(norm);
    const first = br.map(s => sh.find(m => norm(m.species) === s)).filter(Boolean);
    return first.concat(sh.filter(m => !first.includes(m)));
  };
  let pbad = 0, played = 0, granted = 0;
  for (const g of picked) {
    G.resetScriptCounters();
    const a = G.buildPair(order(g, 'p1')), b = G.buildPair(order(g, 'p2'));
    if (!a || !b) { console.log('  ' + g.id + '   NOT-STAGED — buildPair refused a side'); pbad++; continue; }
    let held = 0; const leaf = [], other = [];
    const r = G.playGame(a, b, 'baseline', 'probe_unburden_leaf :: pool :: ' + g.id, {
      onBoundary: (snap, turnIdx, S, battle) => {
        for (const side of [battle.p1, battle.p2]) for (const p of side.pokemon) if (p.volatiles && p.volatiles.unburden) held++;
        for (const d of snap.diffs) (LEAF.test(d.path) ? leaf : other).push('b' + turnIdx + ' ' + d.path + ' ' + JSON.stringify(d.medicham) + '/' + JSON.stringify(d.showdown));
        snap.identical = true; snap.diffs = [];
      } });
    if (r.err) { console.log('  ' + g.id + '   THREW — ' + r.err); pbad++; continue; }
    played++; if (held) granted++;
    const ubBodies = new Set([].concat(...['p1', 'p2'].map(s => (g.sheets[s] || []).filter(m => norm(m.ability) === 'unburden').map(m => norm(m.species)))));
    const sr = (r.speedRows || []).filter(x => ubBodies.has(norm(x.body)));
    console.log('  ' + g.id + '   turns ' + r.turns + '   authority-held unburden (body-boundaries) ' + held
      + '   vol.unburden diffs ' + leaf.length + '   other board diffs ' + other.length
      + '   speed rows on Unburden bodies ' + sr.length
      + (leaf.length ? '   FIRST LEAF DIFF ' + leaf[0] : '') + (other.length ? '   first other: ' + other[0] : ''));
    if (leaf.length) pbad++;
  }
  console.log(NL + '  pool: ' + played + ' played, ' + granted + ' where the authority granted `unburden` at some boundary, '
    + pbad + ' with a problem (a leaf diff, a throw or an unbuildable pair)');
  /* THE ENGINE'S OWN RECEIPTS FOR THE SAME RUN: how many grants it made, by road, and on how many effSpeed
   * reads the retired `_hadItem && !m.item` predicate would have answered differently (the fix moving Speed). */
  const SEEN = globalThis.MEDSEEN || {};
  console.log('  medicham2 receipts: ' + JSON.stringify(Object.fromEntries(Object.entries(SEEN).filter(([k]) => /^unburden/.test(k)))));
  console.log('release ' + REL_ID);
  process.exit(pbad ? 1 : (granted ? 0 : 2));
}

let bad = 0, ran = 0;
const knobParted = [], knobWanted = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   carrier ' + c.carrier + '   knob ' + (c.knob || '(none — agreement arm)'));
  const clean = play(harness(null), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused side ' + clean.which); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  ran++;
  console.log('    clean  [b: medicham _ubVol / showdown volatile, item]   ' + fmtReads(clean.reads));
  if (clean.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request: ' + clean.sc.firstMissing); bad++; continue; }
  if ((clean.r.turns || 0) < c.script.length) { console.log('    >> FIXTURE FAILED — the game ended at turn ' + clean.r.turns); bad++; continue; }
  /* THE FIXTURE IS JUDGED ON THE AUTHORITY: it must hold the volatile at some boundary, and for the two
   * `dropped` arms it must also have let it go by the last one. Otherwise the arm staged nothing. */
  const sdHeld = clean.reads.some(x => x.sd === 1);
  const sdLast = clean.reads[clean.reads.length - 1];
  if (!sdHeld) { console.log('    >> FIXTURE FAILED — the authority never held `unburden`, so agreement here proves nothing.'); bad++; continue; }
  if (c.want === 'dropped' && sdLast.sd !== 0) { console.log('    >> FIXTURE FAILED — the authority still holds `unburden` at the last boundary; the drop was not staged.'); bad++; continue; }
  console.log('    clean  vol.unburden diffs: ' + clean.leafDiffs.length + '   other board diffs: ' + clean.otherDiffs.length
    + (clean.otherDiffs.length ? '   first: ' + clean.otherDiffs.slice(0, 3).map(d => 'b' + d.t + ' ' + d.path + ' ' + JSON.stringify(d.medicham) + '/' + JSON.stringify(d.showdown)).join(', ') : ''));
  const sr = clean.speedRows.filter(x => norm(x.body) === c.carrier);
  console.log('    clean  speed disagreements on the carrier (getActionSpeed vs effSpeed): ' + sr.length
    + (sr.length ? '   first: turn ' + sr[0].when + ' sd ' + sr[0].showdown + ' / me ' + sr[0].medicham : ''));
  if (clean.leafDiffs.length) { console.log('    >> RED — the leaf parts with the engine as it stands: ' + JSON.stringify(clean.leafDiffs[0])); bad++; }
  if (sr.length) { console.log('    >> RED — the two engines disagree about the carrier\'s Speed.'); bad++; }
  if (!c.knob) { console.log('    ' + (clean.leafDiffs.length || sr.length ? 'FAIL' : 'OK (agreement arm)')); continue; }
  knobWanted.push(c.id);
  const brk = play(harness(c.knob), c);
  harness(null);
  if (brk.notStaged || brk.r.err) { console.log('    NOT-STAGED / THREW under the knob ' + ((brk.r && brk.r.err) || '')); bad++; continue; }
  console.log('    knob   [' + c.knob + ']   ' + fmtReads(brk.reads) + '   MEDFAILS.unburdenBreakKnob=' + brk.stamp);
  if (!brk.stamp) { console.log('    >> THE KNOB DID NOT LOAD — the release does not carry MEDI_UNBURDEN_BREAK, so this arm tested nothing.'); bad++; continue; }
  console.log('    knob   vol.unburden diffs: ' + brk.leafDiffs.length
    + (brk.leafDiffs.length ? '   first: b' + brk.leafDiffs[0].t + ' ' + brk.leafDiffs[0].path + ' medicham ' + brk.leafDiffs[0].medicham + ' showdown ' + brk.leafDiffs[0].showdown : ''));
  if (c.observe === 'speed') {
    const ks = brk.speedRows.filter(x => norm(x.body) === c.carrier);
    console.log('    knob   speed disagreements on the carrier: ' + ks.length
      + (ks.length ? '   first: turn ' + ks[0].when + ' sd ' + ks[0].showdown + ' / me ' + ks[0].medicham : ''));
    if (ks.length) { knobParted.push(c.id); console.log('    OK — the driver\'s Speed comparison parts under the knob and agrees without it'); }
    else { console.log('    >> RED — the knob moved no Speed reading: this arm cannot see the break it names.'); bad++; }
    continue;
  }
  if (brk.leafDiffs.length) { knobParted.push(c.id); console.log('    OK — the board parts on `vol.unburden` under the knob and agrees without it'); }
  else { console.log('    >> RED — the knob moved nothing on the leaf: the leaf cannot see this break.'); bad++; }
}
console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
console.log('knob parted: [' + knobParted.join(',') + ']   expected: [' + knobWanted.join(',') + ']');
console.log(bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
