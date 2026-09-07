/* probe_spread_target_die.js — WHEN THE PLAYER WAS NEVER ALLOWED TO NAME A TARGET, DO THE TWO
 * ENGINES NAME THE SAME BODY?
 *
 *   SHOWDOWN_PATH=... node tests/probe_spread_target_die.js
 *   SHOWDOWN_PATH=... node tests/probe_spread_target_die.js --red     (the restore arm, run for you)
 *
 * ================= WHAT THE AUTHORITY DOES ======================================================
 *
 * `Side#chooseMove` (sim/side.ts:657) refuses a target for any class outside `CHOOSABLE_TARGETS`
 * (`sim/battle-actions.ts:3` — normal, any, adjacentAlly, adjacentAllyOrSelf, adjacentFoe), so a
 * Hyper Voice, an Earthquake or a Spikes arrives at `runMove` with `targetLoc === 0`. Then, read in
 * full at sim/battle.ts:2434:
 *
 *     validTargetLoc(targetLoc, ...) { if (targetLoc === 0) return true; ... }        // :2396
 *     ...
 *     if (move.target !== 'randomNormal' && this.validTargetLoc(targetLoc, pokemon, move.target)) {
 *       const target = pokemon.getAtLoc(targetLoc);        // getAtLoc(0) -> side.active[-1] -> undefined
 *       ...
 *       if (target && !target.fainted) return target;      // NOT TAKEN
 *     }
 *     return this.getRandomTarget(pokemon, move);          // :2484
 *
 * `getAtLoc(0)` indexes `side.active[targetLoc - 1]` = `active[-1]` = `undefined` (sim/pokemon.ts:770),
 * so the "use the selected location" branch is entered and falls straight out of it. **Every
 * non-chooseable click resolves its named target through `getRandomTarget`**, and in a double that
 * ends at `side.randomFoe()` -> `battle.sample(this.foes())` -> `random(len)` — A DIE — for every
 * class the near-side list does not answer first:
 *
 *     if (['self','all','allySide','allyTeam','adjacentAllyOrSelf'].includes(move.target)) return pokemon;
 *     else if (move.target === 'adjacentAlly') { ... }
 *     ...
 *     return pokemon.side.randomFoe() || pokemon.side.foe.active[0];
 *
 * and then `useMoveInner` overrides two of them back to the user (sim/battle-actions.ts:418):
 *
 *     if (move.target === 'self' || move.target === 'allies') target = pokemon;
 *
 * That body is what `addMove('move', pokemon, movename, `${target}...`)` prints (:457) and what
 * `setActiveMove(move, pokemon, target)` (:428) makes `battle.activeTarget` — i.e. THE ANCHOR OF
 * EVERY `any`-CATEGORY ADDRESS IN THE ACTION under the middle arm, including the full-paralysis
 * check, which `runEvent('BeforeMove')` reaches at :253, twenty-five lines BELOW the commit.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * It kept the body the click named — `reaimToSlot(a.target, ...)` — for every class. A spread move's
 * `|move|` line therefore named a fixed slot where the authority rolled, and the whole action's dice
 * were addressed to a different body. Measured on the pinned pool it is the `pair-speedctrl
 * ...bo3-2662992072` board-material row: `|cant|p1a|par` against `|move|p1a|hypervoice`, parting
 * `p1.pp[0].hypervoice` 3 against 2.
 *
 * ================= WHAT THIS FILE MEASURES ======================================================
 *
 * The `|move|` line's TARGET field, out of BOTH protocol streams, with no typed expectation.
 * NOTHING BELOW IS TYPED:
 *
 *   the classes   every `move.target` word in the format, split by the AUTHORITY'S OWN
 *                 `BattleActions#targetTypeChoices` — called, not copied. The engine's
 *                 `targetClass.chooseable` is asserted against it rather than trusted.
 *   the moves     up to MOVES_PER_CLASS legal moves per class, in id order, that some legal
 *                 species in the regulation can learn.
 *   the carriers  derived from each move's learnset, filtered to the regulation.
 *   the knob      the ATTACKER SLOT (p1a / p1b) and the TURN — the two fields that actually move a
 *                 middle-arm address. Sweeping the FOE PAIR would not: neither foe is in the
 *                 address of the draw that chooses it, so every such cell draws the same value and
 *                 agreeing would prove nothing.
 *
 * REFUSALS, named and printed, because a cell that qualifies for one reason proves nothing:
 *
 *   - fewer than two LIVING foes at the move line: with one legal target there is no choice to get
 *     wrong. Counted per move line off both streams (`|switch|p2*` in, `|faint|p2*` out).
 *   - the AUTHORITY'S target field is EMPTY. `attrLastMove('[still]')` BLANKS field 4
 *     (sim/battle.ts:3120), so a move that failed carries no answer to compare. That is a different
 *     mechanic and is refused rather than scored.
 *
 * ================= THE TWO CONTROLS =============================================================
 *
 * CLAUSE D — the OVER-FIRE control: the same carriers clicking an ordinary `normal` move NAMED at
 * p2b. Both engines must honour the name on every cell, clean AND under the knob. A fix that moved
 * these would be rewriting an address that was already shared, which is the shape of every
 * over-matching tag this project has shipped.
 *
 * CLAUSE E — the NEAR-SIDE control: the non-chooseable classes the authority answers with the USER
 * (`self`, `all`, `allySide`, `allyTeam`, `allies`). Both engines must name the user, clean AND
 * under the knob. This is the half of the change that must NOT move, and it is the half that is
 * easiest to break by widening the predicate to "not chooseable" and stopping there.
 *
 * CLAUSE B is the one that makes a green result mean anything: the AUTHORITY'S OWN ANSWERS MUST
 * VARY across the sweep. If they do not, no die was ever read and agreement is an instrument that
 * changed nothing.
 *
 * `MEDI_NAMED_TGT_CLICKED=1` RESTORES THE DEFECT — the engine goes back to naming the clicked body
 * for every class. The authority is untouched by the knob, deliberately: unlike `MEDI_TGT_ADDR_LEGACY`
 * this is a GAME rule and not an instrument address, so only one side of it is ours to restore.
 *
 * ================= WHAT IT STRUCTURALLY CANNOT SEE ==============================================
 *
 * Whether the value a shared address yields is the value the REAL game would yield — the middle
 * arm's die is a hash and there is no ground truth for which foe, only the claim that both engines
 * read the same one. Whether the HIT SET is right: this file compares one ident per move line and a
 * spread move hits everybody regardless. And the `[spread]` attribute, which this engine does not
 * emit at all — a narration row that is named here and measured nowhere.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const NL = String.fromCharCode(10);
const RED_CHILD = process.argv.includes('--red');
const KNOB_ON = process.env.MEDI_NAMED_TGT_CLICKED === '1';
const MOVES_PER_CLASS = 3;
const TURNS = 2;

/* Every board here is staged, so the pool is pinned and the cache slot is left alone. `--state` is
 * pushed because `playGame` only fills the board comparison when the run asked for it — the exact
 * hole that made two probes report "identical" for boards that were never compared (2026-09-06). */
process.argv.push('--state', '--team-store', 'data/team-pool-frozen');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const ARM = G.ARM_BY_ID.get('middle');
const mon = (species, moves) => ({ species, item: '', ability: '', moves });
let bad = 0;

/* ---- THE AUTHORITY'S OWN CHOOSABILITY TEST, CALLED ------------------------------------------- */
const BA = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'battle-actions.js'));
const BAP = (BA.BattleActions || BA.default || BA).prototype;
if (typeof BAP.targetTypeChoices !== 'function') {
  console.log('NOT RUN — BattleActions#targetTypeChoices is absent; the authority moved and this'
    + ' file would be guessing which classes the player may aim.');
  process.exit(2);
}
const choosable = cls => !!BAP.targetTypeChoices.call({}, cls);

console.log(NL + '=== THE FIXTURE, DERIVED THIS RUN (knob MEDI_NAMED_TGT_CLICKED='
  + (KNOB_ON ? '1' : 'unset') + ') ===');

const CLASSES = {};
for (const m of dex.moves.all()) {
  if (!m.exists || m.isNonstandard) continue;
  (CLASSES[m.target] = CLASSES[m.target] || []).push(m);
}
for (const cls of Object.keys(CLASSES).sort()) {
  console.log('  ' + cls.padEnd(20) + String(CLASSES[cls].length).padStart(4)
    + ' legal move(s)   authority says the player may aim it: ' + choosable(cls));
}

/* ---- WHICH CLASSES THE AUTHORITY ANSWERS WITH THE USER ----------------------------------------
 * Read off `getRandomTarget`'s own first clause plus `useMoveInner`'s override, cited above. It is a
 * LIST and it is the authority's list, so it is compared against the compiled source rather than
 * typed and trusted: if either line stops saying this, the probe stops rather than mis-scoring. */
const NEAR_SIDE = ['self', 'all', 'allySide', 'allyTeam', 'adjacentAllyOrSelf'];
const USEMOVE_SELF = ['self', 'allies'];
{
  const bsrc = require('fs').readFileSync(
    path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'battle.js'), 'utf8').replace(/\s+/g, ' ');
  const asrc = require('fs').readFileSync(
    path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'battle-actions.js'), 'utf8').replace(/\s+/g, ' ');
  const m1 = bsrc.match(/getRandomTarget\(pokemon, move\) \{[^[]*\[([^\]]+)\]\.includes\(move\.target\)/);
  const got1 = m1 ? m1[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')) : null;
  const ok2 = /move\.target === "self" \|\| move\.target === "allies"/.test(asrc);
  console.log(NL + '  getRandomTarget\'s near-side clause, read out of dist: '
    + (got1 ? got1.join(',') : 'NOT FOUND'));
  console.log('  useMoveInner\'s `self || allies` override, read out of dist: ' + ok2);
  if (!got1 || got1.sort().join(',') !== NEAR_SIDE.slice().sort().join(',') || !ok2) {
    console.log(NL + 'NOT RUN — the authority\'s target resolution no longer reads the way this file'
      + ' scores it. Re-read sim/battle.ts:2487 and sim/battle-actions.ts:418 before trusting'
      + ' anything below.');
    process.exit(2);
  }
}
const namesUser = cls => NEAR_SIDE.includes(cls) || USEMOVE_SELF.includes(cls);
/* The classes the authority resolves to a DRAWN FOE: non-chooseable, not answered by the near-side
 * clause, not `adjacentAlly` (which is chooseable and therefore never arrives here). */
const DRAWN = Object.keys(CLASSES).filter(c => !choosable(c) && !namesUser(c) && c !== 'adjacentAlly')
  .sort();
const USERCLS = Object.keys(CLASSES).filter(c => !choosable(c) && namesUser(c)).sort();
console.log(NL + '  classes whose named target is a DIE  : ' + DRAWN.join(', '));
console.log('  classes the authority answers with the USER: ' + USERCLS.join(', '));

/* ---- THE BODIES ------------------------------------------------------------------------------ */
const USED = new Set();
function padTeam(actives) {
  const out = actives.slice();
  for (const m of actives) USED.add(norm(m.species));
  for (const s of POOL) {
    if (out.length >= 4) break;
    if (USED.has(norm(s.name))) continue;
    USED.add(norm(s.name)); out.push(mon(s.name, ['Protect']));
  }
  return out;
}

/* ---- READING THE ANSWER OUT OF A STREAM ------------------------------------------------------- */
function walk(lines, mvId) {
  let turn = 0;
  const alive = new Set();
  const out = [];
  for (const raw of lines) {
    const l = Array.isArray(raw) ? '|' + raw.join('|') : String(raw);
    const p = l.split('|');
    const tok = p[1];
    if (tok === 'turn') { turn = Number(p[2]) || turn; continue; }
    if (tok === 'switch' || tok === 'drag' || tok === 'replace') {
      const slot = String(p[2] || '').slice(0, 3);
      if (/^p2[ab]$/.test(slot)) alive.add(slot);
      continue;
    }
    if (tok === 'faint') {
      const slot = String(p[2] || '').slice(0, 3);
      if (/^p2[ab]$/.test(slot)) alive.delete(slot);
      continue;
    }
    if (tok === 'move') {
      if (norm(p[3]) !== mvId) continue;
      out.push({ turn, src: String(p[2] || '').slice(0, 3), tgt: String(p[4] || '').slice(0, 3),
                 liveFoes: alive.size });
    }
  }
  return out;
}

/* ---- THE CONTROL MOVE, per carrier ------------------------------------------------------------ */
const NORMAL = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.target === 'normal'
                                           && (m.accuracy === true || m.accuracy === 100)
                                           && m.basePower > 0 && !m.smartTarget && !m.multihit)
  .sort((a, b) => a.id.localeCompare(b.id));
const controlFor = sp => { const ls = LS(sp); return NORMAL.find(m => ls[m.id]) || null; };

/* ---- THE SWEEP -------------------------------------------------------------------------------- */
const rows = [], ctrlRows = [], userRows = [];
const threw = [], notPlayed = [], noLine = [], refusedFewFoes = [], refusedBlank = [], noCarrier = [];

function cellsFor(cls) {
  const ms = CLASSES[cls].filter(m => m.id !== 'struggle').sort((a, b) => a.id.localeCompare(b.id));
  const out = [];
  for (const m of ms) {
    if (out.length >= MOVES_PER_CLASS) break;
    const carriers = POOL.filter(s => LS(s)[m.id]);
    if (carriers.length) out.push({ mv: m, carrier: carriers[0] });
  }
  if (!out.length) noCarrier.push(cls);
  return out;
}

function play(cls, mv, carrier, slot, scoreInto) {
  USED.clear();
  USED.add(norm(carrier.name));
  const spare = [];
  for (const s of POOL) {
    if (USED.has(norm(s.name))) continue;
    USED.add(norm(s.name)); spare.push(s);
    if (spare.length >= 3) break;
  }
  const [filler, foeA, foeB] = spare;
  if (!filler || !foeA || !foeB) { threw.push(mv.id + '/slot' + slot + ': ran out of species'); return; }
  const ctrl = controlFor(carrier);
  const attMoves = [mv.name].concat(ctrl ? [ctrl.name] : []).concat(['Protect']);
  const actives = slot === 0
    ? [mon(carrier.name, attMoves), mon(filler.name, ['Protect'])]
    : [mon(filler.name, ['Protect']), mon(carrier.name, attMoves)];
  const pa = G.buildPair(padTeam(actives));
  const pb = G.buildPair(padTeam([mon(foeA.name, ['Protect']), mon(foeB.name, ['Protect'])]));
  if (!pa || !pb) { threw.push(mv.id + '/slot' + slot + ': unbuildable'); return; }

  const step = { p1: [null, null], p2: [{ m: 'protect' }, { m: 'protect' }] };
  step.p1[slot] = { m: mv.id };
  step.p1[1 - slot] = { m: 'protect' };
  const script = Array.from({ length: TURNS }, () => JSON.parse(JSON.stringify(step)));
  let r;
  try {
    r = G.playGame(pa, pb, 'directed', 'probe_spread_target_die/' + mv.id + '/' + slot,
                   { script, arm: ARM });
  } catch (e) {
    threw.push(mv.id + '/slot' + slot + ': ' + String((e && e.message) || e).split(NL)[0]); return;
  }
  if (r.err || r.turns < 1) { notPlayed.push(mv.id + '/slot' + slot + ': ' + (r.err || ('turns ' + r.turns))); return; }
  const sd = walk(G.sdStream(G.lastSdLog()), mv.id);
  const me = walk(r.mediTrace || [], mv.id);
  if (!sd.length || !me.length) { noLine.push(mv.id + '/slot' + slot + ' [sd ' + sd.length + ' / me ' + me.length + ']'); return; }
  const n = Math.min(sd.length, me.length);
  for (let i = 0; i < n; i++) {
    if (sd[i].turn !== me[i].turn) break;
    if (!sd[i].tgt) {
      refusedBlank.push(mv.id + '/slot' + slot + '/t' + sd[i].turn + ' [authority field blank —'
        + ' the move failed and `[still]` blanked it]');
      continue;
    }
    if (sd[i].liveFoes < 2 || me[i].liveFoes < 2) {
      refusedFewFoes.push(mv.id + '/slot' + slot + '/t' + sd[i].turn
        + ' [sd ' + sd[i].liveFoes + ' / me ' + me[i].liveFoes + ']');
      continue;
    }
    scoreInto.push({ cls, mv: mv.id, slot, turn: sd[i].turn, src: sd[i].src,
                     live: sd[i].liveFoes + '/' + me[i].liveFoes,
                     sd: sd[i].tgt, me: me[i].tgt, agree: sd[i].tgt === me[i].tgt });
  }

  /* ---- THE OVER-FIRE CONTROL — an ordinary `normal` move NAMED at p2b ------------------------- */
  if (!ctrl) return;
  const cstep = { p1: [null, null], p2: [{ m: 'protect' }, { m: 'protect' }] };
  cstep.p1[slot] = { m: ctrl.id, t: 1 };
  cstep.p1[1 - slot] = { m: 'protect' };
  let cr;
  try {
    cr = G.playGame(pa, pb, 'directed', 'probe_spread_target_die/ctrl/' + ctrl.id + '/' + slot,
                    { script: [cstep], arm: ARM });
  } catch (e) { threw.push('ctrl ' + ctrl.id + '/slot' + slot + ': ' + String((e && e.message) || e).split(NL)[0]); return; }
  if (cr.err || cr.turns < 1) { notPlayed.push('ctrl ' + ctrl.id + '/slot' + slot); return; }
  const csd = walk(G.sdStream(G.lastSdLog()), ctrl.id);
  const cme = walk(cr.mediTrace || [], ctrl.id);
  if (!csd.length || !cme.length) { noLine.push('ctrl ' + ctrl.id + '/slot' + slot); return; }
  if (!csd[0].tgt) { refusedBlank.push('ctrl ' + ctrl.id + '/slot' + slot); return; }
  if (csd[0].liveFoes < 2 || cme[0].liveFoes < 2) { refusedFewFoes.push('ctrl ' + ctrl.id + '/slot' + slot); return; }
  ctrlRows.push({ mv: ctrl.id, slot, sd: csd[0].tgt, me: cme[0].tgt,
                  agree: csd[0].tgt === cme[0].tgt, named: 'p2b' });
}

for (const cls of DRAWN) for (const c of cellsFor(cls)) for (const slot of [0, 1])
  play(cls, c.mv, c.carrier, slot, rows);
for (const cls of USERCLS) for (const c of cellsFor(cls)) for (const slot of [0, 1])
  play(cls, c.mv, c.carrier, slot, userRows);

/* ---- WHAT LEFT THE SWEEP IS NAMED ------------------------------------------------------------- */
console.log(NL + '=== THE SWEEP — ' + rows.length + ' scored DIE cells, ' + userRows.length
  + ' scored NEAR-SIDE cells, ' + ctrlRows.length + ' control cells ===');
if (noCarrier.length) console.log('  NO CARRIER in the regulation (' + noCarrier.length + '): ' + noCarrier.join(' | '));
if (threw.length) console.log('  THREW (' + threw.length + '): ' + threw.join(' | '));
if (notPlayed.length) console.log('  NOT PLAYED (' + notPlayed.length + '): ' + notPlayed.join(' | '));
if (noLine.length) console.log('  NO MOVE LINE (' + noLine.length + '): ' + noLine.join(' | '));
if (refusedBlank.length) console.log('  REFUSED, authority target field blank (' + refusedBlank.length
  + '): ' + refusedBlank.join(' | '));
if (refusedFewFoes.length) console.log('  REFUSED, fewer than two living foes (' + refusedFewFoes.length
  + '): ' + refusedFewFoes.join(' | '));

for (const r of rows) {
  console.log('  DIE     ' + r.cls.padEnd(17) + r.mv.padEnd(15) + 'att=' + r.src + ' t' + r.turn
    + ' liveFoes=' + r.live + '   showdown -> ' + r.sd + '   medicham -> ' + r.me
    + '   ' + (r.agree ? 'AGREE' : 'DIFFERS'));
}
for (const r of userRows) {
  console.log('  USER    ' + r.cls.padEnd(17) + r.mv.padEnd(15) + 'att=' + r.src + ' t' + r.turn
    + '                   showdown -> ' + r.sd + '   medicham -> ' + r.me
    + '   ' + (r.agree ? 'AGREE' : 'DIFFERS'));
}
for (const r of ctrlRows) {
  console.log('  CONTROL ' + r.mv.padEnd(15) + 'slot=' + r.slot + ' named=' + r.named
    + '   showdown -> ' + r.sd + '   medicham -> ' + r.me + '   ' + (r.agree ? 'AGREE' : 'DIFFERS'));
}

/* ---- CLAUSE A — THE FIXTURE REACHED A DIE AT ALL ---------------------------------------------- */
if (rows.length < 6) {
  console.log(NL + 'NOT-STAGED — only ' + rows.length + ' scored die cells. This file cannot'
    + ' distinguish a shared die from a coincidence on that few.');
  process.exit(1);
}

/* ---- CLAUSE B — THE AUTHORITY'S ANSWERS VARY -------------------------------------------------- */
const sdTargets = new Set(rows.map(r => r.sd));
console.log(NL + 'CLAUSE B — the authority answered ' + [...sdTargets].sort().join('/')
  + ' across ' + rows.length + ' die cells.');
if (sdTargets.size < 2) {
  console.log('  FAIL — the AUTHORITY named the same slot on every cell, so no die moved and a green'
    + ' agreement below would prove nothing about the address.');
  bad++;
}

/* ---- CLAUSE C — THE TWO ENGINES NAME THE SAME BODY -------------------------------------------- */
const cDiff = rows.filter(r => !r.agree);
console.log(NL + 'CLAUSE C — ' + (rows.length - cDiff.length) + ' of ' + rows.length
  + ' die cells AGREE.');
if (cDiff.length) {
  console.log('  FAIL — ' + cDiff.length + ' cell(s) name a different body: '
    + cDiff.map(r => r.mv + '/' + r.src + '/t' + r.turn + ' sd=' + r.sd + ' me=' + r.me).join(' | '));
  bad++;
}

/* ---- CLAUSE D — THE OVER-FIRE CONTROL --------------------------------------------------------- */
console.log(NL + 'CLAUSE D — ' + ctrlRows.length + ' named-target control cell(s).');
if (ctrlRows.length < 4) {
  console.log('  FAIL — fewer than four control cells; the over-fire question was not asked.');
  bad++;
}
const dDiff = ctrlRows.filter(r => !r.agree);
if (dDiff.length) {
  console.log('  FAIL — ' + dDiff.length + ' NAMED-target cell(s) part: '
    + dDiff.map(r => r.mv + '/slot' + r.slot + ' sd=' + r.sd + ' me=' + r.me).join(' | '));
  bad++;
} else console.log('  every named-target click is honoured by both engines.');

/* ---- CLAUSE E — THE NEAR-SIDE CONTROL --------------------------------------------------------- */
console.log(NL + 'CLAUSE E — ' + userRows.length + ' near-side cell(s) across '
  + [...new Set(userRows.map(r => r.cls))].sort().join('/') + '.');
if (userRows.length < 4) {
  console.log('  FAIL — fewer than four near-side cells; the half that must NOT move was not measured.');
  bad++;
}
const eDiff = userRows.filter(r => !r.agree);
if (eDiff.length) {
  console.log('  FAIL — ' + eDiff.length + ' near-side cell(s) part: '
    + eDiff.map(r => r.cls + '/' + r.mv + '/' + r.src + ' sd=' + r.sd + ' me=' + r.me).join(' | '));
  bad++;
} else console.log('  every near-side click names the user on both engines.');

/* ---- THE RESTORE ARM -------------------------------------------------------------------------- */
if (!RED_CHILD && !KNOB_ON) {
  console.log(NL + '=== THE RESTORE ARM — MEDI_NAMED_TGT_CLICKED=1, in a child (the knob is read at'
    + ' module load, so it cannot be flipped in-process) ===');
  const cp = require('child_process');
  /* The child is EXPECTED to exit non-zero — that is the whole point of a restore arm — so
   * `execFileSync`'s throw is caught and its captured stdout is what gets read. A bare call here
   * would abort this file with a stack trace and report the red arm as an infrastructure failure. */
  let out = '';
  try {
    out = cp.execFileSync(process.execPath, [__filename, '--red'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
        env: Object.assign({}, process.env, { MEDI_NAMED_TGT_CLICKED: '1' }) });
  } catch (e) {
    out = String((e && e.stdout) || '');
    if (!out) {
      console.log('  FAIL — the restore arm produced no output at all: '
        + String((e && e.message) || e).split(NL)[0]);
      bad++;
    }
  }
  const cLine = (out.match(/^CLAUSE C — .*$/m) || [''])[0];
  const dLine = (out.match(/^CLAUSE D — .*$/m) || [''])[0];
  const eLine = (out.match(/^CLAUSE E — .*$/m) || [''])[0];
  const redDiff = (out.match(/^ {2}FAIL — (\d+) cell\(s\) name a different body/m) || [])[1];
  console.log('  child ' + cLine);
  console.log('  child ' + dLine);
  console.log('  child ' + eLine);
  console.log('  child die-cell disagreements: ' + (redDiff === undefined ? '0' : redDiff));
  if (redDiff === undefined || Number(redDiff) === 0) {
    console.log('  FAIL — THE KNOB CHANGED NOTHING. Either it is not bound or this fixture never'
      + ' reaches the rule, and a green run above is therefore evidence of nothing.');
    bad++;
  } else {
    console.log('  the knob moves ' + redDiff + ' die cell(s) — the fixture reaches the rule.');
  }
  if (/^ {2}FAIL — \d+ NAMED-target cell\(s\) part/m.test(out)) {
    console.log('  FAIL — the restore arm ALSO moved the named-target control. The knob is wider'
      + ' than the rule it restores.');
    bad++;
  }
  if (/^ {2}FAIL — \d+ near-side cell\(s\) part/m.test(out)) {
    console.log('  FAIL — the restore arm ALSO moved the near-side control. The knob is wider than'
      + ' the rule it restores.');
    bad++;
  }
}

console.log(NL + (bad ? 'PROBE RED — ' + bad + ' clause(s) failed.' : 'PROBE GREEN — all clauses passed.'));
process.exit(bad ? 1 : 0);
