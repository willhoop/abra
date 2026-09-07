/* probe_resist_berry_resolved_type.js — WHEN A MOVE'S TYPE IS REWRITTEN BEFORE IT LANDS, DOES THE
 * TYPE-RESIST BERRY STILL GET EATEN?
 *
 *   SHOWDOWN_PATH=... node tests/probe_resist_berry_resolved_type.js
 *   SHOWDOWN_PATH=... node tests/probe_resist_berry_resolved_type.js --red   (the restore arm, run for you)
 *
 * ================= WHAT THE AUTHORITY DOES ======================================================
 *
 * Every member of the family is one handler and the halve is INSIDE the spend
 * (data/items.ts, e.g. the `roseliberry` block, read in full):
 *
 *     onSourceModifyDamage(damage, source, target, move) {
 *       if (move.type === 'Fairy' && target.getMoveHitData(move).typeMod > 0) {
 *         const hitSub = target.volatiles['substitute'] && !move.flags['bypasssub'] && !(move.infiltrates && ...);
 *         if (hitSub) return;
 *         if (target.eatItem()) { this.add('-enditem', target, this.effect, '[weaken]'); return this.chainModify(0.5); }
 *       }
 *     }
 *
 * `move.type` there is the type of the ACTIVE MOVE — the copy `runMove` made and that
 * `runEvent('ModifyType')` has already rewritten. Pixilate, Refrigerate, Aerilate, Dragonize and
 * Liquid Voice all write `move.type` in `onModifyType` (data/abilities.ts), and Weather Ball writes
 * its own in `onModifyType` (data/moves.ts). `ModifyDamage` runs long after `ModifyType`, so the
 * berry sees the RESOLVED type and nothing else. There is no path on which it sees `move.baseMove`
 * or the dex row's static type.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * TWO IMPLEMENTATIONS OF ONE FACT, WHICH IS THE BREACH CLAUDE.MD HAS A RULE ABOUT.
 *
 *   the HALVE       `dmgRangeOneHit` resolves `let mvT = mv.t`, then rewrites it through the forme
 *                   table, `setsOwnTypeAlways`, `convertsMoveTypeTo` and `weatherScaled`, and asks
 *                   `_rb.onType === mvT`. CORRECT.
 *   the CONSUMPTION the battle loop's own site asked `_rbC.onType === mv.t` — the ENGINE-DATA row's
 *                   STATIC type, which no conversion ever touches. WRONG.
 *
 * So a Pixilate Hyper Voice into a Roseli Berry body was halved and the berry was never spent: the
 * HP agreed with the authority to the point and the ITEM did not. That is a board-material leaf and
 * it is the `omit-weather ...bo3-2659988022` row of the pinned pool — `p1.party.grimmsnarl.item`
 * reading `roseliberry` here against `''` there at turn 7, off a Mega Gardevoir's Hyper Voice.
 * The berry then goes on halving the NEXT super-effective hit, forever.
 *
 * THE FIX IS THE RULE, NOT A SECOND COPY OF IT: `dmgRange` now returns the type it actually priced
 * (`type`), and the consumption site reads that. One resolution, two readers.
 *
 * ================= WHAT THIS FILE MEASURES ======================================================
 *
 * Whether the DEFENDER STILL HOLDS THE BERRY after one click, out of BOTH engines' end state, and
 * the `-enditem` lines out of both protocol streams. NOTHING BELOW IS TYPED:
 *
 *   the berries    every item in `data/tags.json` carrying a `resistBerry` tag, with its own
 *                  `onType` and `requiresSuperEffective`.
 *   the converters every ability in `data/tags.json` carrying `convertsMoveType`, with its own
 *                  `into` type and its own `converts` clause, and every LEGAL species that has it.
 *   the weathers   `weatherball`'s own `weatherScaled.byWeather` table, paired with a legal ally
 *                  whose `setsWeather` tag names that sky — so the second family is derived from
 *                  the same artifact and not from a list of four skies typed here.
 *   the defenders  a legal species the RESOLVED type is super-effective against and the BASE type
 *                  is NOT — which is the whole point: a cell where both types are super-effective
 *                  cannot tell the two readings apart and is REFUSED, printed, not scored.
 *
 * ================= THE CONTROLS =================================================================
 *
 * CLAUSE C — THE NO-CONVERSION CONTROL. The same attacker, same move, same berry holder, with a
 * NON-converting ability off the same species' own ability list. The move stays Normal, the berry
 * is not its type, and NEITHER engine may spend it — clean or under the knob. A fix that moved this
 * would be eating berries that the authority keeps, which is the over-match this project ships when
 * a predicate is widened to "any type at all".
 *
 * CLAUSE D — THE BASE-TYPE CONTROL. A move whose STATIC type already equals the berry's, into the
 * same holder. Both engines must spend it in BOTH arms. This is what makes the knob a restore
 * rather than an off switch: `MEDI_RESIST_BERRY_BASE_TYPE=1` must break clause B and leave D alone.
 *
 * CLAUSE E — THE AUTHORITY MUST DISAGREE WITH ITSELF ACROSS THE SWEEP: at least one scored cell
 * where it spends and at least one control where it does not. Without that the whole file could be
 * measuring an engine that never eats a berry and one that always does, and both would look green.
 *
 * ================= WHAT IT STRUCTURALLY CANNOT SEE ==============================================
 *
 * Ripen's second halve (declared open at the consumption site and not touched here), the Substitute
 * clause of the authority's handler (this engine asks `subBlocks` at the same site and that is a
 * different probe), and whether the DAMAGE is right — this file asserts the two engines' HP agree
 * and says nothing about whether either matches the cartridge.
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
const KNOB_ON = process.env.MEDI_RESIST_BERRY_BASE_TYPE === '1';

/* Every board here is staged, so the pool is pinned and the cache slot is left alone. `--state` and
 * `--end-state` are pushed because `playGame` only fills the board comparison when the run asked for
 * it — the hole that made two probes report "identical" for boards that were never compared. */
process.argv.push('--state', '--end-state', '--team-store', 'data/team-pool-frozen');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const ARM = G.ARM_BY_ID.get('middle');
const mon = (species, item, ability, moves) => ({ species, item, ability, moves });
let bad = 0;

/* ---- THE FIXTURE, DERIVED ---------------------------------------------------------------------- */
const BERRIES = [];
for (const k of Object.keys(TAGS.items || {}).sort()) {
  const e = TAGS.items[k];
  if (!e.tags || !e.tags.includes('resistBerry')) continue;
  const p = (e.params || {}).resistBerry || {};
  if (!p.onType) continue;
  BERRIES.push({ id: k, name: (dex.items.get(k).name || k), onType: p.onType,
                 needsSE: p.requiresSuperEffective !== false });
}
const CONVERTERS = [];
for (const k of Object.keys(TAGS.abilities || {}).sort()) {
  const e = TAGS.abilities[k];
  if (!e.tags || !e.tags.includes('convertsMoveType')) continue;
  const p = (e.params || {}).convertsMoveType || {};
  if (!p.into) continue;
  CONVERTERS.push({ id: k, into: p.into, converts: String(p.converts || '') });
}
const SETTERS = {};   /* sky word -> [species] */
for (const k of Object.keys(TAGS.abilities || {}).sort()) {
  const e = TAGS.abilities[k];
  const p = (e.params || {}).weatherSetter;
  if (!p || !p.weather) continue;
  SETTERS[p.weather] = SETTERS[p.weather] || { ability: k, carriers: [] };
}
for (const s of POOL) for (const a of Object.values(s.abilities || {})) {
  for (const w of Object.keys(SETTERS)) if (norm(SETTERS[w].ability) === norm(a)) SETTERS[w].carriers.push(s);
}
const WBALL = ((TAGS.moves || {}).weatherball || {}).params || {};
const WTABLE = (WBALL.weatherScaled || {}).byWeather || {};

console.log(NL + '=== THE FIXTURE, DERIVED THIS RUN (knob MEDI_RESIST_BERRY_BASE_TYPE='
  + (KNOB_ON ? '1' : 'unset') + ') ===');
console.log('  resistBerry items      : ' + BERRIES.length + ' — '
  + BERRIES.map(b => b.id + '/' + b.onType).join(' '));
console.log('  convertsMoveType abils : '
  + CONVERTERS.map(c => c.id + ' (' + c.converts + ' -> ' + c.into + ')').join(' | '));
console.log('  weatherball type table : '
  + Object.keys(WTABLE).map(w => w + '->' + WTABLE[w].type).join(' '));
for (const w of Object.keys(SETTERS).sort()) {
  console.log('  sky ' + w.padEnd(6) + ' set by ' + SETTERS[w].ability.padEnd(12)
    + ' carriers: ' + (SETTERS[w].carriers.map(s => s.name).slice(0, 4).join(', ') || 'NONE IN THE REGULATION'));
}
if (!BERRIES.length || !CONVERTERS.length) {
  console.log(NL + 'NOT RUN — the tag artifact carries no resistBerry or no convertsMoveType row, so'
    + ' this file would be asking nothing.');
  process.exit(2);
}

/* ---- WHICH MOVES CAN BE TRUSTED TO CONNECT ON TURN ONE -----------------------------------------
 * DERIVED off the move row, never a name list: a two-turn move (`flags.charge`), a recharge move and
 * anything carrying its own `onTry*` gate (Last Resort, Fake Out, First Impression) can FAIL on the
 * staged turn, and a cell that never connected proves nothing about a berry. Refused here rather
 * than discovered as a mystery zero downstream. */
const LANDS = m => !m.flags.charge && !m.flags.recharge && !m.onTry && !m.onTryMove && !m.onTryHit
                   && !m.onModifyMove && !m.selfdestruct && !m.recoil && !m.mindBlownRecoil;

/* ---- EFFECTIVENESS, OFF THE FORMAT ------------------------------------------------------------- */
function effOf(type, sp) {
  if (!dex.getImmunity(type, sp.types)) return 0;
  return Math.pow(2, dex.getEffectiveness(type, sp.types));
}
/* A DEFENDER THAT SEPARATES THE TWO READINGS: the resolved type must be super-effective and the
 * base type must NOT be, or the cell cannot tell `mv.t` from `mvT` apart at all. */
function defenderFor(resolved, baseType, berry) {
  return POOL.filter(s => effOf(resolved, s) > 1 && effOf(baseType, s) <= 1
                          && LS(s).rest && LS(s).protect)
    .sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd)
                  - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd))[0] || null;
}

/* ---- ONE STAGED CLICK -------------------------------------------------------------------------- */
const refused = [], threw = [], notPlayed = [];
function pad(list, used) {
  const out = list.slice();
  for (const m of list) used.add(norm(m.species));
  for (const s of POOL) {
    if (out.length >= 4) break;
    if (used.has(norm(s.name))) continue;
    /* No weather setter, no Intimidate, no entry ability may reach the pad — a pad body that sets a
     * sky would silently retype a Weather Ball cell that was staged for a different one. */
    if (Object.values(s.abilities || {}).some(a => Object.keys(SETTERS)
        .some(w => norm(SETTERS[w].ability) === norm(a)))) continue;
    used.add(norm(s.name)); out.push(mon(s.name, '', '', ['Protect']));
  }
  return out;
}
function play(label, att, attAb, mvName, def, item, ally) {
  const used = new Set();
  const p1 = [mon(att.name, '', attAb, [mvName, 'Protect'])];
  if (ally) p1.push(mon(ally.sp.name, '', ally.ability, ['Protect']));
  const pa = G.buildPair(pad(p1, used));
  const pb = G.buildPair(pad([mon(def.name, item, '', ['Rest', 'Protect'])], used));
  if (!pa || !pb) { threw.push(label + ': unbuildable pair'); return null; }
  const step = { p1: [{ m: norm(mvName), t: 0 }, { m: 'protect' }],
                 p2: [{ m: 'rest' }, { m: 'protect' }] };
  let r;
  try {
    r = G.playGame(pa, pb, 'directed', 'probe_resist_berry_resolved_type/' + label,
                   { script: [step], arm: ARM });
  } catch (e) { threw.push(label + ': ' + String((e && e.message) || e).split(NL)[0]); return null; }
  if (r.err || r.turns < 1) { notPlayed.push(label + ': ' + (r.err || ('turns ' + r.turns))); return null; }
  const sd = G.sdStream(G.lastSdLog()).map(x => Array.isArray(x) ? '|' + x.join('|') : String(x));
  const me = (r.mediTrace || []).map(x => Array.isArray(x) ? '|' + x.join('|') : String(x));
  const ate = lines => lines.some(l => /^\|-enditem\|p2a/.test(l) && norm(l).includes(norm(item))
                                       && /weaken/.test(l));
  const conn = lines => lines.some(l => /^\|-damage\|p2a/.test(l));
  /* The board leaf, not the narration: does the defender still hold it at the boundary? Read off
   * `stateDiv`, which is only filled because `--state` was pushed at the top of this file. */
  const div = r.stateDiv && Array.isArray(r.stateDiv.diffs) ? r.stateDiv.diffs : [];
  const itemDiv = div.filter(d => /\.item$/.test(d.path));
  return { label, sdAte: ate(sd), meAte: ate(me), connected: conn(sd) && conn(me),
           itemDiv, otherDiv: div.filter(d => !/\.item$/.test(d.path)) };
}

/* ---- THE SWEEP --------------------------------------------------------------------------------- */
const scored = [], ctrlNoConv = [], ctrlBase = [];
function stage(family, resolvedType, baseMoveName, baseType, attSp, attAb, ally) {
  const berry = BERRIES.find(b => b.onType === resolvedType);
  if (!berry) { refused.push(family + ': no resistBerry for ' + resolvedType); return; }
  const def = defenderFor(resolvedType, baseType, berry);
  if (!def) {
    refused.push(family + ': no legal body that ' + resolvedType + ' is SE against and ' + baseType
      + ' is not (with Rest+Protect)');
    return;
  }
  const lab = family + '/' + attSp.name + '/' + attAb + '/' + norm(baseMoveName) + '/' + def.name;
  const row = play(lab, attSp, attAb, baseMoveName, def, berry.name, ally);
  if (!row) return;
  if (!row.connected) { refused.push(lab + ': the click never connected on one of the two engines'); return; }
  row.family = family; row.berry = berry.id; row.resolved = resolvedType; row.base = baseType;
  row.def = def.name;
  scored.push(row);

  /* CLAUSE C — the same cell with a NON-converting ability off the same species' own list. */
  if (family === 'ability') {
    const other = Object.values(attSp.abilities || {}).map(norm)
      .find(a => !CONVERTERS.some(c => c.id === a));
    if (!other) { refused.push(lab + ' [control C]: the species has no non-converting ability'); return; }
    const c = play('ctrlC/' + lab + '/' + other, attSp, other, baseMoveName, def, berry.name, null);
    if (c) { c.family = 'ctrlC'; c.berry = berry.id; c.def = def.name; ctrlNoConv.push(c); }
  } else if (ally) {
    /* the weather family's control is the SAME click with NO SKY — the ally is dropped. */
    const c = play('ctrlC/' + lab + '/nosky', attSp, attAb, baseMoveName, def, berry.name, null);
    if (c) { c.family = 'ctrlC'; c.berry = berry.id; c.def = def.name; ctrlNoConv.push(c); }
  }

  /* CLAUSE D — a move whose STATIC type is already the berry's, into the same holder. */
  const baseMv = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.type === resolvedType
      && m.basePower > 0 && !m.multihit && !m.secondaries && LANDS(m)
      && (m.accuracy === true || m.accuracy >= 100) && m.target === 'normal')
    .sort((a, b) => b.basePower - a.basePower)
    .find(m => LS(attSp)[m.id]);
  if (!baseMv) { refused.push(lab + ' [control D]: attacker learns no ' + resolvedType + ' move'); return; }
  const dctl = play('ctrlD/' + lab + '/' + baseMv.id, attSp, attAb, baseMv.name, def, berry.name, ally);
  if (dctl) { dctl.family = 'ctrlD'; dctl.berry = berry.id; dctl.def = def.name; ctrlBase.push(dctl); }
}

/* FAMILY 1 — the converting abilities. */
for (const c of CONVERTERS) {
  const carriers = POOL.filter(s => Object.values(s.abilities || {}).some(a => norm(a) === c.id));
  if (!carriers.length) { refused.push('ability/' + c.id + ': no legal non-mega carrier'); continue; }
  const wantsSound = /sound/i.test(c.converts);
  const src = carriers.find(s => LS(s).hypervoice) || carriers[0];
  const mv = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.basePower > 0
      && m.target !== 'self' && !m.multihit && !m.secondaries
      && (wantsSound ? m.flags.sound : m.type === 'Normal') && LANDS(m)
      && (m.accuracy === true || m.accuracy >= 100))
    .sort((a, b) => b.basePower - a.basePower)
    .find(m => LS(src)[m.id]);
  if (!mv) { refused.push('ability/' + c.id + ': ' + src.name + ' learns no move the ability converts'); continue; }
  stage('ability', c.into, mv.name, mv.type, src, c.id, null);
}

/* FAMILY 2 — Weather Ball under each sky the artifact names. */
for (const w of Object.keys(WTABLE).sort()) {
  const into = WTABLE[w].type;
  const set = SETTERS[w];
  if (!set || !set.carriers.length) { refused.push('weather/' + w + ': no legal carrier of ' + (set && set.ability)); continue; }
  const ally = { sp: set.carriers[0], ability: set.ability };
  /* THE ATTACKER MAY NOT SET A SKY OF ITS OWN. The first version of this file picked Abomasnow —
   * Snow Warning — to click Weather Ball under a Drought ally, and the two entry abilities RACED:
   * the `sun` cell resolved to Ice and the authority ate nothing, which showed up as clause A
   * failing rather than as a staging error. The ally is the ONLY setter on the board. */
  const setsSky = s => Object.values(s.abilities || {}).some(a => Object.keys(SETTERS)
    .some(k => norm(SETTERS[k].ability) === norm(a)));
  const att = POOL.find(s => LS(s).weatherball && !setsSky(s) && norm(s.name) !== norm(ally.sp.name));
  if (!att) { refused.push('weather/' + w + ': nothing legal that does not set its own sky learns Weather Ball'); continue; }
  const attAb = norm(Object.values(att.abilities || {})[0] || '');
  stage('weather:' + w, into, 'Weather Ball', dex.moves.get('weatherball').type, att, attAb, ally);
}

/* ---- WHAT LEFT THE SWEEP IS NAMED -------------------------------------------------------------- */
console.log(NL + '=== THE SWEEP — ' + scored.length + ' scored cell(s), ' + ctrlNoConv.length
  + ' no-conversion control(s), ' + ctrlBase.length + ' base-type control(s) ===');
if (refused.length) console.log('  REFUSED (' + refused.length + '): ' + refused.join(' | '));
if (threw.length) console.log('  THREW (' + threw.length + '): ' + threw.join(' | '));
if (notPlayed.length) console.log('  NOT PLAYED (' + notPlayed.length + '): ' + notPlayed.join(' | '));
const show = r => '  ' + r.family.padEnd(14) + (r.berry || '').padEnd(13)
  + ('->' + (r.def || '')).padEnd(16)
  + ' showdown ate=' + (r.sdAte ? 'YES' : 'no ') + '  medicham ate=' + (r.meAte ? 'YES' : 'no ')
  + '  item leaf parted=' + (r.itemDiv.length ? JSON.stringify(r.itemDiv[0]) : 'no')
  + (r.otherDiv.length ? '  OTHER LEAVES PARTED: ' + JSON.stringify(r.otherDiv) : '');
for (const r of scored) console.log(show(r));
for (const r of ctrlNoConv) console.log(show(r));
for (const r of ctrlBase) console.log(show(r));

/* ---- CLAUSE A — THE FIXTURE REACHED THE RULE --------------------------------------------------- */
if (scored.length < 2) {
  console.log(NL + 'NOT-STAGED — only ' + scored.length + ' scored cell(s). A COULD-NOT-STAGE is a'
    + ' claim about this fixture and about nothing else.');
  process.exit(1);
}
const sdAteScored = scored.filter(r => r.sdAte).length;
console.log(NL + 'CLAUSE A — the AUTHORITY spent the berry on ' + sdAteScored + ' of ' + scored.length
  + ' scored cell(s).');
if (sdAteScored !== scored.length) {
  console.log('  FAIL — the authority did NOT spend on every scored cell, so at least one cell is'
    + ' staged wrong and this file would be scoring the wrong question.');
  bad++;
}

/* ---- CLAUSE B — THIS ENGINE SPENDS IT TOO ------------------------------------------------------ */
const bMiss = scored.filter(r => r.sdAte !== r.meAte || r.itemDiv.length);
console.log(NL + 'CLAUSE B — ' + (scored.length - bMiss.length) + ' of ' + scored.length
  + ' scored cell(s) agree on the item leaf.');
if (bMiss.length) {
  console.log('  FAIL — ' + bMiss.length + ' cell(s) part: '
    + bMiss.map(r => r.label + ' sd=' + r.sdAte + ' me=' + r.meAte
      + (r.itemDiv.length ? ' ' + JSON.stringify(r.itemDiv[0]) : '')).join(' | '));
  bad++;
}

/* ---- CLAUSE C — THE NO-CONVERSION CONTROL ------------------------------------------------------ */
console.log(NL + 'CLAUSE C — ' + ctrlNoConv.length + ' no-conversion control cell(s).');
if (ctrlNoConv.length < 2) {
  console.log('  FAIL — fewer than two no-conversion controls; the over-fire question was not asked.');
  bad++;
}
const cBad = ctrlNoConv.filter(r => r.sdAte || r.meAte || r.itemDiv.length);
if (cBad.length) {
  console.log('  FAIL — ' + cBad.length + ' control cell(s) spent a berry that the resolved type does'
    + ' not match: ' + cBad.map(r => r.label + ' sd=' + r.sdAte + ' me=' + r.meAte).join(' | '));
  bad++;
} else console.log('  neither engine spends a berry when nothing rewrote the type.');

/* ---- CLAUSE D — THE BASE-TYPE CONTROL ---------------------------------------------------------- */
console.log(NL + 'CLAUSE D — ' + ctrlBase.length + ' base-type control cell(s).');
if (ctrlBase.length < 2) {
  console.log('  FAIL — fewer than two base-type controls; the half that must NOT move was not measured.');
  bad++;
}
const dBad = ctrlBase.filter(r => !r.sdAte || !r.meAte || r.itemDiv.length);
if (dBad.length) {
  console.log('  FAIL — ' + dBad.length + ' base-type control cell(s) part: '
    + dBad.map(r => r.label + ' sd=' + r.sdAte + ' me=' + r.meAte).join(' | '));
  bad++;
} else console.log('  both engines spend the berry when the move\'s own type already matches.');

/* ---- CLAUSE E — THE AUTHORITY DISAGREES WITH ITSELF -------------------------------------------- */
const allRows = scored.concat(ctrlNoConv, ctrlBase);
const sdYes = allRows.filter(r => r.sdAte).length, sdNo = allRows.length - sdYes;
console.log(NL + 'CLAUSE E — across ' + allRows.length + ' cell(s) the authority spent on ' + sdYes
  + ' and kept on ' + sdNo + '.');
if (!sdYes || !sdNo) {
  console.log('  FAIL — the authority answered the same way everywhere, so agreement above would be'
    + ' evidence of nothing.');
  bad++;
}

/* ---- THE RESTORE ARM --------------------------------------------------------------------------- */
if (!RED_CHILD && !KNOB_ON) {
  console.log(NL + '=== THE RESTORE ARM — MEDI_RESIST_BERRY_BASE_TYPE=1, in a child (the knob is read'
    + ' at module load, so it cannot be flipped in-process) ===');
  const cp = require('child_process');
  let out = '';
  try {
    out = cp.execFileSync(process.execPath, [__filename, '--red'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
        env: Object.assign({}, process.env, { MEDI_RESIST_BERRY_BASE_TYPE: '1' }) });
  } catch (e) {
    out = String((e && e.stdout) || '');
    if (!out) {
      console.log('  FAIL — the restore arm produced no output at all: '
        + String((e && e.message) || e).split(NL)[0]);
      bad++;
    }
  }
  const bLine = (out.match(/^CLAUSE B — .*$/m) || [''])[0];
  const cLine = (out.match(/^CLAUSE C — .*$/m) || [''])[0];
  const dLine = (out.match(/^CLAUSE D — .*$/m) || [''])[0];
  const redB = (out.match(/^ {2}FAIL — (\d+) cell\(s\) part:/m) || [])[1];
  console.log('  child ' + bLine);
  console.log('  child ' + cLine);
  console.log('  child ' + dLine);
  console.log('  child scored-cell disagreements: ' + (redB === undefined ? '0' : redB));
  if (redB === undefined || Number(redB) === 0) {
    console.log('  FAIL — THE KNOB CHANGED NOTHING. Either it is not bound or this fixture never'
      + ' reaches the rule, and a green run above is therefore evidence of nothing.');
    bad++;
  } else {
    console.log('  the knob moves ' + redB + ' scored cell(s) — the fixture reaches the rule.');
  }
  if (/^ {2}FAIL — \d+ base-type control cell\(s\) part/m.test(out)) {
    console.log('  FAIL — the restore arm ALSO moved the base-type control. The knob is wider than'
      + ' the rule it restores, so it is not a restore.');
    bad++;
  }
  if (/^ {2}FAIL — \d+ control cell\(s\) spent a berry/m.test(out)) {
    console.log('  FAIL — the restore arm ALSO moved the no-conversion control.');
    bad++;
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' clause(s) failed.' : 'GREEN — every clause held.'));
process.exit(bad ? 1 : 0);
