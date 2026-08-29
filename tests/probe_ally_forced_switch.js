/* probe_ally_forced_switch.js — A FORCED SWITCH IS ADDRESSED TO THE BODY THE AIM RESOLVED, AND THIS
 * ENGINE LOOKED THAT BODY UP IN THE MOVER'S FOE ARRAY ONLY.
 *
 *   SHOWDOWN_PATH=... node tests/probe_ally_forced_switch.js
 *   SHOWDOWN_PATH=... node tests/probe_ally_forced_switch.js --only roar-at-ally
 *   SHOWDOWN_PATH=... node tests/probe_ally_forced_switch.js --release <id>
 *
 * ================= THE CLASS THIS ARM BELONGS TO ================================================
 *
 * `docs/_reports/2026-08-29-armor-tail-ally.md` §3.2 filed twenty-two live sites in
 * `engine/medicham2-browser.js` that hard-code the mover's FAR side, and asked which of them answer a
 * SIDE question (correct) and which answer a TARGET question (a candidate defect). Two of them are
 * here, and they are ONE cause with ONE authority function behind them.
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * A `normal` move may legally name the user's own partner. `Battle#validTargetLoc` (sim/battle.ts)
 * asks ADJACENCY and nothing else for that class:
 *
 *     case 'randomNormal': case 'scripted': case 'normal': return isAdjacent;
 *
 * and `Pokemon#getMoveTargets`'s `default:` arm (sim/pokemon.ts:821-849) pushes whatever body came
 * back. The forced switch then runs over exactly those bodies:
 *
 *     forceSwitch(damage, targets, source)                       sim/battle-actions.ts:1353
 *       for (const [i, target] of targets.entries()) {
 *         if (!target || target.fainted) continue;
 *         const hitResult = this.battle.runEvent('DragOut', target, source, move);
 *         ... target.forceSwitchFlag = true;
 *
 * There is NO side test in it. One function serves both halves of `forcesSwitch` — the STATUS door
 * (Roar, Whirlwind) and the DAMAGING door (Dragon Tail, Circle Throw) — which is why the two sites in
 * this engine are one defect and not two. Champions overrides eight files and touches none of these:
 * `moves.ts` in `data/mods/champions/` has no `roar`, no `whirlwind`, no `dragontail` and no
 * `circlethrow` key, and `scripts.ts` has no `forceSwitch` — grepped, not recalled.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * `reaimToSlot` already answers BOTH axes and hands back an ally correctly. Both forced-switch doors
 * then computed the dragged body's party, bench and side-field as `it.side==='A'?...B:...A` — the
 * MOVER'S far side — so an ally-aimed phaze scored `_foes.indexOf(_t) === -1` and:
 *
 *   - the STATUS door failed the move outright;
 *   - the DAMAGING door dealt its damage and then `continue`d past the drag in silence.
 *
 * ================= THE FIXTURE IS CONSTRUCTED, AND THE ENCODER HAD TO GROW TO EXPRESS IT ==========
 *
 * `game_differential.js`'s scripted encoder could not aim a `normal` move at a partner — it wrote
 * `target = want.t + 1` for every one of them. `{ ally: true }` now writes the negative targetLoc the
 * authority has always accepted, and REFUSES (counted, `allyAimRefused`) an ally ask on a class that
 * cannot legally name one. Asserted at exact zero below: an ally ask that quietly became a foe aim
 * would be an arm that agrees while testing nothing.
 *
 * NEITHER DRIVER CAN REACH THIS FROM THE POOL, AND IT IS SAID RATHER THAN DISCOVERED LATER. Both
 * `chooseAction` and `empiricalPick` write `target = j + 1` over the FOES for `normal`/`any`/
 * `adjacentFoe`, so no pooled game has ever aimed one of these at a partner. This is lab-only work by
 * construction and the empirical board count cannot move on it.
 *
 * ================= NO EXPECTATION IS TYPED ======================================================
 *
 * Every arm plays the identical script on both engines under the differential's own `middle` pin.
 * Showdown's stream IS the answer; this file asserts only that the two agree on four counted facts,
 * that the knob puts the red arms back apart, and that the controls do NOT move under the knob.
 *
 * THE FACTS ARE COARSE ON PURPOSE. A drag draws a body out of the bench, and the two engines take
 * that draw from different streams — so the facts record the SLOT a `|drag|`/`|switch|` line names
 * and never the species that arrived. What the defect changes is whether a drag happens at all and on
 * which half of the field, which is exactly what a slot records.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER — `game_differential.js` CUTS a release at its own require time when
 * `--release` is absent, and a bare `node <file>` would write that cut into the real store. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_ally_forced_switch.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_TARGET_SIDE_FOE_ONLY';

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
 * Garchomp carries BOTH doors — Roar (status) and Dragon Tail (damaging) — so one body reaches the
 * two sites without changing the fixture between them. Its partner is Toxapex because the partner is
 * what gets dragged and it must not be immune to the damaging door: Dragon is neutral into
 * Poison/Water, where a Fairy partner would zero the damage, zero the target array and stage nothing.
 * Sand Veil and Merciless are slot-0 abilities and neither announces on entry or on being hit. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

const CHOMP = ['garchomp', '', 'Sand Veil', ['Roar', 'Dragon Tail', 'Protect']];
const PEX = ['toxapex', '', 'Merciless', ['Protect', 'Toxic']];
const LAX = ['snorlax', '', 'Immunity', ['Protect']];
const CLEF = ['clefable', '', 'Magic Guard', ['Protect']];

const PHAZER = () => stage([CHOMP, PEX]).concat(BENCH('snorlax', 'clefable'));
const IDLE = () => stage([LAX, CLEF]).concat(BENCH('toxapex', 'garchomp'));

const PR = { m: 'protect' };
const ROAR_ALLY = { m: 'roar', ally: true };
const ROAR_FOE = { m: 'roar', t: 0 };
const DT_ALLY = { m: 'dragontail', ally: true };
/* THE PARTNER MUST NOT SHIELD ON THE DAMAGING DOOR, AND THE FIRST FIXTURE DID. Protect blocks Dragon
 * Tail outright (it carries the `protect` flag), so the first run of `dragontail-at-ally` staged NO
 * damage and NO drag on EITHER engine and agreed while testing nothing — the authority's own empty
 * `dmg[]` is what said so.
 *
 * AND THE SECOND FILLER WAS WRONG TOO, IN THE OTHER DIRECTION. Recover is `self`, and on a self-target
 * HEAL this engine writes the user into the `|move|` line's target field where the authority writes
 * nothing — `recover->p1b` against `recover->none`, present with the knob ON as well, so it is neither
 * this batch's doing nor this batch's to fix. Routed out rather than glossed, the way the sibling probe
 * routed out the stall die: someone else's defect must not sit inside this one's evidence. FILED.
 *
 * Toxic is priority 0, names a FOE (so its `|move|` line agrees), and Snorlax's Immunity refuses it —
 * the partner is left standing, unshielded and unstatused. */
const TOX = { m: 'toxic', t: 0 };
const DT_FOE = { m: 'dragontail', t: 0 };

const CASES = [
  /* ---- THE DEFECT ------------------------------------------------------------------------------- */
  { id: 'roar-at-ally', kind: 'red', own: 1,
    A: PHAZER(), B: IDLE(), script: [{ p1: [ROAR_ALLY, PR], p2: [PR, PR] }],
    what: 'THE STATUS DOOR. Garchomp Roars its OWN partner, which `validTargetLoc` allows for a '
        + '`normal` move and `forceSwitch` performs without asking whose side the body is on. This '
        + 'engine looked the partner up in the FOE array, scored -1, and failed the move.' },

  { id: 'roar-at-ally-mirror', kind: 'red', own: 1,
    A: IDLE(), B: PHAZER(), script: [{ p1: [PR, PR], p2: [ROAR_ALLY, PR] }],
    what: 'THE SAME DEFECT WITH THE SIDES EXCHANGED WHOLE. `sideBoxOf` reads the body rather than the '
        + 'mover\'s side letter; a fix that reached one side only would pass the arm above and fail here.' },

  { id: 'dragontail-at-ally', kind: 'red', own: 1,
    A: PHAZER(), B: IDLE(), script: [{ p1: [DT_ALLY, TOX], p2: [PR, PR] }],
    what: 'THE DAMAGING DOOR, WHICH IS A SEPARATE SITE AND THE SAME AUTHORITY FUNCTION. Dragon Tail '
        + 'into one\'s own partner damages it and then drags it. This engine dealt the damage — the '
        + 'attack branch resolves an ally aim correctly — and then walked past the drag in silence, '
        + 'because the row\'s body was not in the mover\'s foe array.' },

  /* ---- THE CONTROLS. Each clears one thing and must hold on BOTH loads --------------------------- */
  { id: 'roar-at-foe', kind: 'control', own: 0,
    A: PHAZER(), B: IDLE(), script: [{ p1: [ROAR_FOE, PR], p2: [PR, PR] }],
    what: 'THE KNOB CLEARED EXPLICITLY ON THE STATUS DOOR — the identical board and the identical '
        + 'click, aimed across the field the way every pooled game aims it. Nothing here may move '
        + 'under the knob, and `targetSideIsMoversOwn` must read 0.' },

  { id: 'dragontail-at-foe', kind: 'control', own: 0,
    A: PHAZER(), B: IDLE(), script: [{ p1: [DT_FOE, TOX], p2: [PR, PR] }],
    what: 'THE SAME CONTROL ON THE DAMAGING DOOR. This is the road every Dragon Tail in the pinned '
        + 'pool takes; a fix that changed it would move the empirical arm, which this batch predicted '
        + 'it would not.' },

  { id: 'no-phaze-protect', kind: 'control', own: 0,
    A: PHAZER(), B: IDLE(), script: [{ p1: [PR, PR], p2: [PR, PR] }],
    what: 'NO FORCED SWITCH ANYWHERE. The board, the bench and the turn structure with neither door '
        + 'touched — the arm that fails if `sideBoxOf` is called somewhere it was not wired.' },
];

/* ---- LEGALITY, DERIVED AND REFUSED -------------------------------------------------------------- */
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
const seenRow = new Set();
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const key = row.species + '|' + row.item + '|' + row.ability + '|' + row.moves.join(',');
  if (seenRow.has(key)) continue;
  seenRow.add(key);
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE MEMBERSHIP, PRINTED BEFORE ANYTHING IS WIRED TO IT (docs/LESSONS §4) -------------------- */
const TAGS = require(D('data', 'tags.json'));
const pOf = (id, t) => ((TAGS.moves[id] || {}).params || {})[t];
const forced = Object.keys(TAGS.moves || {}).filter(k => { const p = pOf(k, 'forcesSwitch'); return p && p.forceSwitch; });
const byDoor = { status: [], damaging: [] };
for (const k of forced) {
  const cat = (dex.moves.get(k) || {}).category;
  (cat === 'Status' ? byDoor.status : byDoor.damaging).push(k + '(' + ((TAGS.moves[k] || {}).uses || 0) + ')');
}
console.log(NL + '  DERIVED — every legal move carrying `forcesSwitch {forceSwitch:true}`, split by the '
  + 'DOOR it takes in this engine: ' + forced.length + ' of ' + Object.keys(TAGS.moves).length);
console.log('    status door (a.kind===\'phaze\')     ' + (byDoor.status.join(', ') || 'NONE'));
console.log('    damaging door (after the hit)       ' + (byDoor.damaging.join(', ') || 'NONE'));
const aimable = forced.filter(k => { const tc = pOf(k, 'targetClass'); return tc && (tc.target === 'normal' || tc.target === 'any'); });
console.log('    of those, the ones a player may legally aim at a PARTNER (`normal`/`any`): '
  + (aimable.join(', ') || 'NONE'));
if (!aimable.length) {
  console.log(NL + 'NOT RUN — no legal forced-switch move can name a partner in this format. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* THE AUTHORITY'S OWN CLASS WORDS, READ AT RUN TIME rather than quoted. If Champions ever narrows
 * Roar or Dragon Tail to a foe-only target class, this file must not report a pass. */
const CLS = { roar: dex.moves.get('roar').target, dragontail: dex.moves.get('dragontail').target };
console.log('  Read at run time from the format:  roar.target=' + CLS.roar
  + '   dragontail.target=' + CLS.dragontail + '   (both must be `normal` for a partner to be aimable)');
if (CLS.roar !== 'normal' || CLS.dragontail !== 'normal') {
  console.log(NL + 'NOT RUN — the format no longer lets these moves name a partner. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ------------------------------------------------------------------------------------ */
const posOf = s => { const m = /^(p[12][ab]?)/.exec(String(s || '').trim()); return m ? m[1] : 'none'; };
const SWITCH_LINE = /^\|(switch|drag)\|([^|]*)\|/i;
const DAMAGE_LINE = /^\|-damage\|([^|]*)\|/i;
const FAIL_LINE = /^\|-fail\|([^|]*)/i;
const MOVE_LINE = /^\|move\|([^|]*)\|([^|]*)\|([^|]*)/i;

/* FOUR COUNTED FACTS, taken the same way off both streams and compared TO EACH OTHER — never to a
 * number typed here. `entry` is the KIND of arrival and the SLOT it happened in, never the species,
 * because the replacement body is a die the two engines take from different streams. `damage` and
 * `fail` are slots only. `aim` is the move name and the SLOT the `|move|` line points at, which is
 * the whole question in this defect. */
function facts(lines) {
  const entry = [], dmg = [], fail = [], aims = [];
  for (const raw of (lines || []).map(String)) {
    let m = SWITCH_LINE.exec(raw);
    if (m) { entry.push(m[1].toLowerCase() + '/' + posOf(m[2])); continue; }
    m = DAMAGE_LINE.exec(raw);
    if (m) { dmg.push(posOf(m[1])); continue; }
    m = FAIL_LINE.exec(raw);
    if (m) { fail.push(posOf(m[1])); continue; }
    m = MOVE_LINE.exec(raw);
    if (m) { aims.push(m[2].toLowerCase().replace(/[^a-z0-9]/g, '') + '->' + posOf(m[3])); }
  }
  return { entry, dmg, fail, aims };
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const agree = (x, y) => same(x.entry, y.entry) && same(x.dmg, y.dmg)
                     && same(x.fail, y.fail) && same(x.aims, y.aims);
const show = f => 'entry[' + f.entry.join(' ') + ']  dmg[' + f.dmg.join(' ') + ']  fail['
  + f.fail.join(' ') + ']  aim[' + f.aims.join(' ') + ']';

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const a = G.buildPair(c.A), b = G.buildPair(c.B);
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_ally_forced_switch :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta,
    sd: facts(G.sdStream(G.lastSdLog())),
    me: facts(r.mediTrace),
    sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).targetSideFoeOnlyRestored || 0 };
}

let bad = 0, ran = 0;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']');
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  console.log('    showdown  ' + show(clean.sd));
  console.log('    medicham  ' + show(clean.me));
  console.log('    medicham  ' + show(brk.me) + '   [knob]');
  console.log('    target-on-mover\'s-own-side counted   clean ' + (clean.delta.targetSideIsMoversOwn || 0)
    + '   knob ' + ((brk.delta || {}).targetSideIsMoversOwn || 0)
    + '   (expected clean ' + c.own + ')   |   not-on-field ' + (clean.delta.targetSideNotOnField || 0));
  console.log('    MEDFAILS stamp            clean ' + clean.restored + '   knob ' + brk.restored
    + '   |   script clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : '')
    + '   |   ally asks refused ' + clean.sc.allyAimRefused
    + (clean.sc.allyAimFirst ? ' (' + clean.sc.allyAimFirst + ')' : ''));

  if (clean.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  /* AN ALLY ASK THAT QUIETLY BECAME A FOE AIM IS AN ARM THAT AGREES WHILE TESTING NOTHING. */
  if (clean.sc.allyAimRefused) { console.log('    >> FIXTURE FAILED — an `ally: true` ask was refused, so this arm did not aim where it claims.'); bad++; continue; }
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out (' + clean.r.turns + '/' + brk.r.turns
      + ' of ' + c.script.length + ').'); bad++; continue;
  }
  if (!(clean.restored === 0 && brk.restored > 0)) {
    console.log('    >> KNOB DID NOT BIND — the load-time stamp is not absent-clean/present-on-knob.');
    bad++; continue;
  }
  /* THE BRANCH RAN AS THE ARM CLAIMS. A control at 0 and a red arm at 1, so "it agreed" cannot be
   * read off a branch that never executed. */
  if ((clean.delta.targetSideIsMoversOwn || 0) !== c.own) {
    console.log('    >> THE BRANCH DID NOT RUN AS CLAIMED.'); bad++;
  }

  if (!agree(clean.sd, clean.me)) { console.log('    >> DEFECT — the two engines disagree.'); bad++; }
  else console.log('    >> the two engines agree, line for line, on all four facts.');

  if (c.kind === 'red') {
    if (agree(clean.sd, brk.me)) { console.log('    >> THE KNOB DID NOT MOVE ANYTHING — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this arm a red one.');
  } else {
    if (!agree(clean.sd, brk.me)) { console.log('    >> OVER-FIRE — the control moved under the knob, so the change is not confined.'); bad++; }
  }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
