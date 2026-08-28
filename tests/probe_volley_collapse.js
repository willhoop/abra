/* probe_volley_collapse.js — A VOLLEY WHOSE TOTAL IS REWRITTEN BY A SURVIVE-AT-1 OR ABSORB HANDLER
 * COLLAPSES INTO ONE PACKET, AND THE ARRIVALS AFTER THE FIRST STOP EXISTING.
 *
 *   SHOWDOWN_PATH=... node tests/probe_volley_collapse.js
 *
 * ROADMAP #511. It WAS a diagnostic written to fail; since 2026-08-28 it is a GATE on the half
 * that has been repaired and a DECLARED-OPEN arm on the half that has not.
 *
 *   DISGUISE (mechanism 2)  FIXED 2026-08-28 -- the absorb answers arrival ONE, the bust lands at
 *                           the between-arrival Update seam, and arrivals 2..N hit the busted body.
 *                           Every row of this route gates. `MEDI_FORMEONHIT_CLICK_WIDE=1` puts the
 *                           defect back and reproduces the ORIGINAL red exactly: 6 comparisons,
 *                           `-damage` 6 vs 2, `-hitcount` 5 vs 1, HP 58 vs 114.
 *   ENDURE   (mechanism 1)  OPEN, and DECLARED below rather than left to make this file red. It is
 *                           HP-NEUTRAL (1/198 on both sides) and costs narration plus two state
 *                           reads; it is patch A in docs/_reports/2026-08-28-volley-collapse.md and
 *                           a DIFFERENT ROOT -- the survive-at-1 clamp rewrites the total, which
 *                           nulls the packet vector. Exactly three rows may part on it and the
 *                           other four still gate; a declared row that goes GREEN also fails, so
 *                           the declaration cannot outlive the defect it describes.
 *
 * WHERE IT COMES FROM. The row said only *"a multi-hit into a Focus Sash, Endure or Disguise drops
 * the `-hitcount` line"*. The line is the smallest part of it. `engine/medicham2-browser.js:29121`:
 *
 *     const _packets=(R.pk&&R.pk.length>1&&dmg===R.dmg)?R.pk:null;
 *     if(!_packets&&R.pk&&R.pk.length>1)MEDSEEN.multiHitPacketsCollapsed++;
 *
 * `R.dmg` is the price step's total (`:28713`). `dmg` is the apply step's local, and FOUR handlers
 * above this line rewrite it — Endure (`:29034`), the Focus Sash / Focus Band / Sturdy family
 * (`:29077`), the Disguise / Ice Face absorb (`:28966`) and the pierce quarter. Any rewrite makes
 * `dmg !== R.dmg`, so the packet vector is discarded and the whole click is applied as ONE
 * subtraction. Everything the packet loop owns is then skipped:
 *
 *     TR.eff / TR.crit per arrival   (:29139)   — and the price step already suppressed its own copy
 *                                                 at :28589 under `if(TR&&!_multiPk)`, so the volley
 *                                                 emits ZERO effectiveness lines, not one.
 *     TR.dmg per arrival             (:29140)
 *     _updateEvent between arrivals  (:29181)   — the pinch-berry pass
 *     R.hitLanded / `-hitcount`      (:29191)
 *     _timesAttacked += arrivals     (:29260)   — Rage Fist's whole power
 *
 * THE AUTHORITY, READ WHOLE THIS SESSION, NOT RECALLED.
 *   data/mods/champions/scripts.ts:428-570  `hitStepMoveHitLoop`, the Champions override. It calls
 *     `spreadMoveHit` once per hit (:517), raises `eachEvent('Update')` inside the loop (:538) and
 *     writes `-hitcount` as `hit - 1` (:547-549). Every `onDamage` handler therefore runs PER HIT.
 *   data/moves.ts `endure.condition.onDamage` — `if (effect?.effectType === 'Move' && damage >=
 *     target.hp) { this.add('-activate', target, 'move: Endure'); return target.hp - 1; }`
 *   data/items.ts `focussash.onDamage` — gated on `target.hp === target.maxhp`.
 *   data/items.ts `focusband.onDamage` — `randomChance(1,10) && damage >= target.hp`, NO full-HP gate.
 *   data/abilities.ts `disguise.onDamage` — returns 0 and sets `busted`; `onUpdate` does the forme
 *     change and the `baseMaxhp / 8` chip. Champions overrides none of these four (grepped).
 *
 * THE FIXTURE IS CONSTRUCTED AND SELECTED ON THE SHOWDOWN STREAM ALONE. medicham2's stream is never
 * consulted while choosing.
 *
 * A CELL THAT QUALIFIES FOR TWO REASONS PROVES NOTHING. The survive-at-1 family is DERIVED from
 * data/tags.json (`survivesAnyHit` on moves, `survivesFromFull` on items and abilities) plus the
 * absorb tag `formeOnHit`; every candidate body is scored for how many of them it carries and any
 * body carrying more than one is REFUSED and named.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

require(D('tests', '_live_release.js'));
process.argv.push('--state', '--team-store', 'data/team-pool-frozen');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));

/* ---- THE CLAMP FAMILY, DERIVED ------------------------------------------------------------------ */
const CLAMP = { moves: [], items: [], abilities: [] };
for (const [id, e] of Object.entries(TAGS.moves)) if ((e.tags || []).includes('survivesAnyHit')) CLAMP.moves.push(id);
for (const [id, e] of Object.entries(TAGS.items)) if ((e.tags || []).includes('survivesFromFull')) CLAMP.items.push(id);
for (const [id, e] of Object.entries(TAGS.abilities)) {
  const t = e.tags || [];
  if (t.includes('survivesFromFull') || t.includes('formeOnHit')) CLAMP.abilities.push(id);
}
console.log('\n  === EVERY HANDLER IN THIS FORMAT THAT REWRITES A VOLLEY\'S TOTAL, DERIVED ===');
for (const k of ['moves', 'items', 'abilities'])
  for (const id of CLAMP[k]) {
    const e = TAGS[k][id];
    const p = e.params.survivesAnyHit || e.params.survivesFromFull || e.params.formeOnHit;
    const ent = k === 'moves' ? dex.moves.get(id) : k === 'items' ? dex.items.get(id) : dex.abilities.get(id);
    console.log('      ' + k.slice(0, -1).padEnd(8) + id.padEnd(14) + (e.uses | 0).toString().padStart(6)
      + ' sheets   legal=' + (ent.exists && !ent.isNonstandard) + '   ' + JSON.stringify(p));
  }
/* how many clamp reasons a built body carries. > 1 and the cell is refused. */
const reasons = (sp, item, ability, moves) => {
  const r = [];
  for (const m of moves) if (CLAMP.moves.includes(norm(m))) r.push('move:' + norm(m));
  if (CLAMP.items.includes(norm(item))) r.push('item:' + norm(item));
  if (CLAMP.abilities.includes(norm(ability))) r.push('ability:' + norm(ability));
  void sp; return r;
};

/* ---- THE MOVE ------------------------------------------------------------------------------------ */
const MULTI = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.multihit);
const maxHits = m => (Array.isArray(m.multihit) ? m.multihit[1] : m.multihit);
console.log('\n  === EVERY LEGAL MULTI-HIT MOVE ===');
for (const m of MULTI) {
  const why = [];
  if (!(m.accuracy === true || m.accuracy === 100)) why.push('acc ' + m.accuracy + ' — misses on this arm');
  if (m.smartTarget) why.push('smartTarget — the hits split across bodies');
  console.log('      ' + m.id.padEnd(16) + 'multihit=' + JSON.stringify(m.multihit) + ' bp=' + m.basePower
    + ' acc=' + m.accuracy + ' type=' + m.type + (why.length ? '   NOT USABLE: ' + why.join('; ') : '   usable'));
}
const USABLE = MULTI.filter(m => (m.accuracy === true || m.accuracy === 100) && !m.smartTarget)
  .sort((a, b) => maxHits(b) - maxHits(a) || b.basePower - a.basePower || a.id.localeCompare(b.id));
if (!USABLE.length) { console.log('  NO USABLE MULTI-HIT MOVE — a claim about the format.'); process.exit(2); }

const mon = (sp, mvs, item, ab) => ({ species: sp, item: item || '', ability: ab || '', moves: mvs });
const ARM = G.ARM_BY_ID.get('top-tie-first');
if (!ARM) { console.log('  NO SUCH ARM — a claim about the driver.'); process.exit(2); }

const abTags = s => { const t = TAGS.abilities[norm(Object.values(s.abilities)[0])]; return (t && t.tags) || []; };
const NO_FIELD_AB = s => !abTags(s).some(t => /weather|terrain/i.test(t));
const FILL = POOL.filter(s => LEARNS(s, 'protect') && NO_FIELD_AB(s));
/* A HOLD MOVE THAT IS NOT A SHIELD. The first draft handed the target `Protect` and every board in
 * routes 2-4 read `dmgLines=0` — the volley was blocked, not collapsed. A cell that blocks the move
 * cannot show anything about the move's arrivals. Derived, never named. */
const SELF_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.flags.charge && !m.stallingMove && !m.selfSwitch
  && !CLAMP.moves.includes(m.id)
  && !(TAGS.moves[m.id] && (TAGS.moves[m.id].tags || []).includes('userFaints'))).map(m => m.id);
const HOLD_FOR = s => SELF_MOVES.find(m => LEARNS(s, m));

/* ---- READ ONE SLOT OUT OF ONE STREAM, SYMMETRICALLY --------------------------------------------- */
function read(lines, slot) {
  const re = new RegExp('^\\|(-damage|-heal|-enditem|-activate|-ability|-crit|-supereffective|-resisted'
    + '|-hitcount|faint|detailschange)\\|' + slot);
  const ev = lines.filter(l => re.test(l));
  const hp = l => { const m = /\|(\d+)\/(\d+)/.exec(l); return m ? +m[1] : null; };
  const dmg = ev.filter(l => l.startsWith('|-damage|'));
  const hc = ev.find(l => l.startsWith('|-hitcount|'));
  return {
    events: ev,
    dmgLines: dmg.length,
    effLines: ev.filter(l => /^\|(-supereffective|-resisted)\|/.test(l)).length,
    critLines: ev.filter(l => l.startsWith('|-crit|')).length,
    activates: ev.filter(l => l.startsWith('|-activate|')).length,
    hitcount: hc ? +hc.split('|')[3] : null,
    fainted: ev.some(l => l.startsWith('|faint|')),
    final: (() => { for (let i = ev.length - 1; i >= 0; i--) { const v = hp(ev[i]); if (v != null) return v; } return null; })(),
  };
}

const SKIPPED = { twoReasons: 0, noFiller: 0, buildThrew: 0, buildNull: 0, gameThrew: 0 };
const SKIP_WHY = [];
function playOne(tag, MV, AT, T, item, hb, tgtMoves, wantReasons) {
  const ab = Object.values(T.abilities)[0];
  const rs = reasons(T, item, ab, tgtMoves);
  const WANT = wantReasons == null ? 1 : wantReasons;
  if (rs.length !== WANT) {
    SKIPPED.twoReasons++;
    if (SKIP_WHY.length < 40) SKIP_WHY.push(T.name + ' [' + rs.join(',') + '] — ' + rs.length + ' clamp reasons, wanted ' + WANT + ' - refused');
    return null;
  }
  const f = FILL.filter(s => s.name !== AT.name && s.name !== T.name).slice(0, 6);
  if (f.length < 6) { SKIPPED.noFiller++; return null; }
  const A = [mon(AT.name, [MV.name, 'Protect'], '', Object.values(AT.abilities)[0]),
    mon(f[0].name, ['Protect']), mon(f[1].name, ['Protect']), mon(f[2].name, ['Protect'])];
  const B = [mon(T.name, tgtMoves.concat(['Protect']), item, ab),
    mon(f[3].name, ['Protect']), mon(f[4].name, ['Protect']), mon(f[5].name, ['Protect'])];
  const script = [{ p1: [{ m: norm(MV.id), t: 0 }, { m: 'protect' }],
    p2: [{ m: norm(tgtMoves[0]) }, { m: 'protect' }] }];
  let a, b;
  try { a = G.buildPair(A); b = G.buildPair(B, { hpBoost: hb }); }
  catch (e) { SKIPPED.buildThrew++; if (SKIP_WHY.length < 40) SKIP_WHY.push(T.name + ' x' + hb + ': buildPair threw — ' + String((e && e.message) || e)); return null; }
  if (!a || !b) { SKIPPED.buildNull++; return null; }
  G.resetScriptCounters();
  const g = G.playGame(a, b, 'directed', tag + '/' + norm(AT.name) + '/' + norm(T.name) + '/' + hb,
    { arm: ARM, script });
  if (g.err) { SKIPPED.gameThrew++; if (SKIP_WHY.length < 40) SKIP_WHY.push(T.name + ' x' + hb + ': the game threw — ' + g.err); return null; }
  return { MV, AT, T, item, hb, ab, reasons: rs, sc: G.scriptCounters(),
    sd: read(G.sdStream(G.lastSdLog()), 'p2a:'), me: read(g.mediTrace || [], 'p2a:') };
}

/* ================================ THE ROUTES ===================================================== */
const ROUTES = [];
let bad = 0, ctlBad = 0, declBad = 0;

/* ---- CONTROL A: THE SAME VOLLEY INTO A BODY CARRYING NO CLAMP AT ALL ---------------------------
 * Without this the file only says "the engines differ on a board with Endure on it", which does not
 * say the CLAMP is what broke the volley. If the packet road were simply unwired, this arm would part
 * too, and every RED below would be measuring something else. */
{
  const MV = USABLE[0];
  const NO_CLAMP_AB = s => !CLAMP.abilities.includes(norm(Object.values(s.abilities)[0]));
  const ATTS = POOL.filter(s => LEARNS(s, MV.id) && NO_FIELD_AB(s))
    .sort((a, b) => (MV.category === 'Physical' ? b.baseStats.atk - a.baseStats.atk
      : b.baseStats.spa - a.baseStats.spa) || a.name.localeCompare(b.name));
  const TGTS = POOL.filter(s => NO_FIELD_AB(s) && NO_CLAMP_AB(s) && HOLD_FOR(s)
    && dex.getEffectiveness(MV.type, s) > 0 && dex.getImmunity(MV.type, s))
    .sort((a, b) => (b.baseStats.hp + b.baseStats.def) - (a.baseStats.hp + a.baseStats.def));
  console.log('\n  === CONTROL A: the identical volley into a body with ZERO clamp reasons ===');
  let F = null; const tried = [];
  outerCA:
  for (const AT of ATTS.slice(0, 3)) for (const T of TGTS.slice(0, 20)) for (const hb of [2, 3]) {
    const H = HOLD_FOR(T); if (!H) continue;
    const r = playOne('control', MV, AT, T, '', hb, [H, 'Protect'], 0);
    if (!r) continue;
    tried.push(AT.name + ' -> ' + T.name + ' x' + hb + '  sd dmgLines=' + r.sd.dmgLines
      + ' eff=' + r.sd.effLines + ' hitcount=' + r.sd.hitcount + ' final=' + r.sd.final
      + ' fainted=' + r.sd.fainted);
    if (r.sd.dmgLines >= 3 && !r.sd.fainted && r.sd.hitcount != null) { F = r; break outerCA; }
  }
  console.log('      candidate boards played: ' + tried.length);
  for (const t of tried.slice(-4)) console.log('        ' + t);
  if (F) ROUTES.push({ name: 'CONTROL A (no clamp - MUST be green)', F, control: true });
  else console.log('      CONTROL A DID NOT STAGE. Every verdict below is then unanchored.');
}

/* ---- CONTROL B: A SINGLE-HIT MOVE INTO THE SAME DISGUISE BODY ----------------------------------
 * Disguise on a one-arrival click is asserted correct elsewhere in this repo. Re-asserting it HERE is
 * what separates "Disguise is broken" from "the volley is broken", which are two different repairs. */
{
  const ONE = dex.moves.all().filter(m => m.exists && !m.isNonstandard && !m.multihit
    && m.category !== 'Status' && (m.accuracy === true || m.accuracy === 100) && m.basePower >= 60
    && !m.flags.charge && !m.selfSwitch && !(m.secondaries && m.secondaries.length) && !m.recoil)
    .sort((a, b) => b.basePower - a.basePower);
  const fhOf = s => { const t = TAGS.abilities[norm(Object.values(s.abilities)[0])];
    return t && (t.tags || []).includes('formeOnHit') ? t.params.formeOnHit : null; };
  const DISG = POOL.filter(s => { const p = fhOf(s); return p && norm(p.from) === norm(s.name); });
  console.log('\n  === CONTROL B: a SINGLE-hit move into the same Disguise body ===');
  let F = null; const tried = [];
  outerCB:
  for (const T of DISG) { const H = HOLD_FOR(T); if (!H) continue;
    for (const MV of ONE.slice(0, 14)) {
      if (!dex.getImmunity(MV.type, T)) continue;
      const ATTS = POOL.filter(s => LEARNS(s, MV.id) && NO_FIELD_AB(s))
        .sort((a, b) => (MV.category === 'Physical' ? b.baseStats.atk - a.baseStats.atk
          : b.baseStats.spa - a.baseStats.spa) || a.name.localeCompare(b.name));
      for (const AT of ATTS.slice(0, 2)) {
        const r = playOne('disg1', MV, AT, T, '', 1, [H, 'Protect']);
        if (!r) continue;
        tried.push(AT.name + ' -> ' + T.name + ' ' + MV.name + '  sd dmgLines=' + r.sd.dmgLines
          + ' act=' + r.sd.activates + ' final=' + r.sd.final);
        if (r.sd.activates > 0 && r.sd.dmgLines >= 2 && !r.sd.fainted) { F = r; break outerCB; }
      }
    }
  }
  console.log('      candidate boards played: ' + tried.length);
  for (const t of tried.slice(-4)) console.log('        ' + t);
  if (F) ROUTES.push({ name: 'CONTROL B (Disguise, one arrival - MUST be green)', F, control: true });
  else console.log('      CONTROL B DID NOT STAGE.');
}

/* ---- ROUTE 1: ENDURE ---------------------------------------------------------------------------- */
{
  const MV = USABLE[0];
  const NO_CLAMP_AB = s => !CLAMP.abilities.includes(norm(Object.values(s.abilities)[0]));
  const ATTS = POOL.filter(s => LEARNS(s, MV.id) && NO_FIELD_AB(s))
    .sort((a, b) => (MV.category === 'Physical' ? b.baseStats.atk - a.baseStats.atk
      : b.baseStats.spa - a.baseStats.spa) || a.name.localeCompare(b.name));
  const TGTS = POOL.filter(s => LEARNS(s, 'endure') && NO_FIELD_AB(s) && NO_CLAMP_AB(s)
    && dex.getEffectiveness(MV.type, s) > 0 && dex.getImmunity(MV.type, s))
    .sort((a, b) => a.name.localeCompare(b.name));
  console.log('\n  === ROUTE 1: ENDURE — move ' + MV.name + ' (' + MV.type + ') ===');
  console.log('      attackers that learn it: ' + ATTS.length + '   SE targets that learn Endure and carry no other clamp: ' + TGTS.length);
  let F = null; const tried = [];
  outer1:
  for (const AT of ATTS.slice(0, 3)) for (const T of TGTS) for (const hb of [1, 2, 3, 4]) {
    const r = playOne('endure', MV, AT, T, '', hb, ['Endure']);
    if (!r) continue;
    tried.push(AT.name + ' -> ' + T.name + ' x' + hb + '  sd dmgLines=' + r.sd.dmgLines
      + ' eff=' + r.sd.effLines + ' hitcount=' + r.sd.hitcount + ' act=' + r.sd.activates
      + ' final=' + r.sd.final + ' fainted=' + r.sd.fainted);
    /* selection on the AUTHORITY alone: it endured, mid-volley, over >= 3 arrivals, and lived. */
    if (r.sd.activates > 0 && !r.sd.fainted && r.sd.dmgLines >= 3 && r.sd.final === 1) { F = r; break outer1; }
  }
  console.log('      candidate boards played: ' + tried.length);
  for (const t of tried.slice(-8)) console.log('        ' + t);
  if (F) ROUTES.push({ name: 'ENDURE', F });
  else console.log('      NO BOARD STAGED THIS ROUTE — a claim about the fixture, not the engine.');
}

/* ---- ROUTE 2: DISGUISE -------------------------------------------------------------------------- */
{
  const fhOf = s => { const t = TAGS.abilities[norm(Object.values(s.abilities)[0])];
    return t && (t.tags || []).includes('formeOnHit') ? t.params.formeOnHit : null; };
  /* ONLY THE BODY THE TAG NAMES AS `from`. Mimikyu-Busted carries the same ability and the authority's
   * own `onDamage` is gated on `target.species.id === 'mimikyu'`, so a busted body is not this route. */
  const DISG = POOL.filter(s => { const p = fhOf(s); return p && norm(p.from) === norm(s.name); });
  console.log('\n  === ROUTE 2: DISGUISE / ICE FACE (the absorb clamp) ===');
  console.log('      legal bodies whose slot-0 ability carries formeOnHit: '
    + (DISG.map(s => s.name + '/' + Object.values(s.abilities)[0]).join(', ') || 'NONE'));
  let F = null; const tried = [];
  outer2:
  for (const T of DISG) {
    for (const MV of USABLE.slice(0, 4)) {
      if (!dex.getImmunity(MV.type, T)) continue;
      const ATTS = POOL.filter(s => LEARNS(s, MV.id) && NO_FIELD_AB(s))
        .sort((a, b) => (MV.category === 'Physical' ? b.baseStats.atk - a.baseStats.atk
          : b.baseStats.spa - a.baseStats.spa) || a.name.localeCompare(b.name));
      const H = HOLD_FOR(T); if (!H) continue;
      for (const AT of ATTS.slice(0, 3)) for (const hb of [1, 2]) {
        const r = playOne('disguise', MV, AT, T, '', hb, [H, 'Protect']);
        if (!r) continue;
        tried.push(AT.name + ' -> ' + T.name + ' ' + MV.name + ' x' + hb + '  sd dmgLines=' + r.sd.dmgLines
          + ' hitcount=' + r.sd.hitcount + ' act=' + r.sd.activates + ' final=' + r.sd.final
          + ' fainted=' + r.sd.fainted);
        if (r.sd.activates > 0 && r.sd.dmgLines >= 3 && !r.sd.fainted) { F = r; break outer2; }
      }
    }
  }
  console.log('      candidate boards played: ' + tried.length);
  for (const t of tried.slice(-8)) console.log('        ' + t);
  if (F) ROUTES.push({ name: 'DISGUISE', F });
  else console.log('      NO BOARD STAGED THIS ROUTE — a claim about the fixture, not the engine.');
}

/* ---- ROUTE 3: FOCUS BAND (no full-HP gate, so a LATER arrival can clamp) ------------------------- */
{
  const MV = USABLE[0];
  const NO_CLAMP_AB = s => !CLAMP.abilities.includes(norm(Object.values(s.abilities)[0]));
  const ATTS = POOL.filter(s => LEARNS(s, MV.id) && NO_FIELD_AB(s))
    .sort((a, b) => (MV.category === 'Physical' ? b.baseStats.atk - a.baseStats.atk
      : b.baseStats.spa - a.baseStats.spa) || a.name.localeCompare(b.name));
  const TGTS = POOL.filter(s => NO_FIELD_AB(s) && NO_CLAMP_AB(s) && HOLD_FOR(s)
    && dex.getEffectiveness(MV.type, s) > 0 && dex.getImmunity(MV.type, s))
    .sort((a, b) => a.name.localeCompare(b.name));
  console.log('\n  === ROUTE 3: FOCUS BAND — the 10% clamp with NO full-HP gate ===');
  console.log('      SE targets carrying no other clamp: ' + TGTS.length);
  let F = null; const tried = [];
  const STRIDE = Math.max(1, Math.floor(TGTS.length / 25));
  outer3:
  for (const AT of ATTS.slice(0, 2)) for (let i = 0; i < TGTS.length; i += STRIDE) for (const hb of [1, 2, 3]) {
    const H = HOLD_FOR(TGTS[i]); if (!H) continue;
    const r = playOne('band', MV, AT, TGTS[i], 'Focus Band', hb, [H, 'Protect']);
    if (!r) continue;
    tried.push(AT.name + ' -> ' + TGTS[i].name + ' x' + hb + '  sd dmgLines=' + r.sd.dmgLines
      + ' hitcount=' + r.sd.hitcount + ' act=' + r.sd.activates + ' final=' + r.sd.final);
    if (r.sd.activates > 0 && r.sd.dmgLines >= 2 && !r.sd.fainted) { F = r; break outer3; }
  }
  console.log('      candidate boards played: ' + tried.length);
  for (const t of tried.slice(-8)) console.log('        ' + t);
  if (F) ROUTES.push({ name: 'FOCUS BAND', F });
  else console.log('      NO BOARD STAGED THIS ROUTE ON THE AUTHORITY (the 10% roll never landed on a '
    + 'lethal arrival here) — a claim about the fixture, not the engine.');
}

/* ---- ROUTE 4: FOCUS SASH reachability ------------------------------------------------------------ */
{
  const MV = USABLE[0];
  const NO_CLAMP_AB = s => !CLAMP.abilities.includes(norm(Object.values(s.abilities)[0]));
  const ATTS = POOL.filter(s => LEARNS(s, MV.id) && NO_FIELD_AB(s))
    .sort((a, b) => (MV.category === 'Physical' ? b.baseStats.atk - a.baseStats.atk
      : b.baseStats.spa - a.baseStats.spa) || a.name.localeCompare(b.name));
  const TGTS = POOL.filter(s => NO_FIELD_AB(s) && NO_CLAMP_AB(s) && HOLD_FOR(s)
    && dex.getEffectiveness(MV.type, s) > 0 && dex.getImmunity(MV.type, s))
    .sort((a, b) => (a.baseStats.hp + a.baseStats.def) - (b.baseStats.hp + b.baseStats.def));
  console.log('\n  === ROUTE 4: FOCUS SASH — is it reachable at all? ===');
  let F = null; const tried = [];
  const STRIDE = Math.max(1, Math.floor(TGTS.length / 20));
  outer4:
  for (const AT of ATTS.slice(0, 2)) for (let i = 0; i < TGTS.length; i += STRIDE) {
    const H = HOLD_FOR(TGTS[i]); if (!H) continue;
    const r = playOne('sash', MV, AT, TGTS[i], 'Focus Sash', 1, [H, 'Protect']);
    if (!r) continue;
    const spent = r.sd.events.some(l => /^\|-enditem\|p2a:[^|]*\|Focus Sash/.test(l));
    tried.push(AT.name + ' -> ' + TGTS[i].name + '  sd dmgLines=' + r.sd.dmgLines
      + ' sashSpent=' + spent + ' hitcount=' + r.sd.hitcount + ' final=' + r.sd.final);
    if (spent && r.sd.dmgLines >= 2) { F = r; break outer4; }
  }
  console.log('      candidate boards played: ' + tried.length);
  for (const t of tried.slice(-8)) console.log('        ' + t);
  if (F) ROUTES.push({ name: 'FOCUS SASH', F });
  else console.log('      THE SASH NEVER SPENT ON A MULTI-ARRIVAL VOLLEY IN ' + tried.length
    + ' BOARDS — consistent with "arrival 1 alone must be lethal at full HP". A claim about the fixture.');
}

/* ================================ THE VERDICT ==================================================== */
/* WHAT MAY PART, BY ROUTE **AND BY ROW**. Named one row at a time rather than one route at a time: a
 * blanket "ENDURE is open" would swallow the HP row, and the HP row is the whole reason mechanism 1
 * is cheap and mechanism 2 was not. A declared row that turns GREEN fails too -- a stale declaration
 * is prose outliving what it described, which is the failure this repository keeps paying for. */
const DECLARED = new Map([['ENDURE', {
  rows: new Set(['`-damage` lines in the volley', 'effectiveness lines', '`-hitcount` value']),
  why: 'MECHANISM 1, patch A -- the survive-at-1 clamp rewrites the volley TOTAL, so `dmg !== R.dmg`'
     + ' at the packet gate and the vector is discarded. HP-neutral on both sides. A DIFFERENT ROOT'
     + ' from the absorb, and deliberately not bundled with it.',
}]]);
const SKIP_N = Object.values(SKIPPED).reduce((a, b) => a + b, 0);
console.log('\n  candidate boards SKIPPED: ' + SKIP_N + '   ' + JSON.stringify(SKIPPED));
for (const w of SKIP_WHY.slice(0, 8)) console.log('      ' + w);

for (const R of ROUTES) {
  const { F } = R, S = F.sd, M = F.me;
  console.log('\n  ================ ' + R.name + ' ================');
  console.log('  board: ' + F.AT.name + ' clicks ' + F.MV.name + ' into ' + F.T.name
    + (F.item ? ' holding ' + F.item : '') + ' [ability ' + F.ab + ', hpBoost x' + F.hb
    + ', clamp reasons: ' + F.reasons.join(',') + ']');
  if (F.sc.moveNotOnRequest) console.log('  WARNING — ' + F.sc.moveNotOnRequest
    + ' scripted click(s) were not on the request (' + F.sc.firstMissing + ').');
  console.log('  --- showdown, p2a slot ---');
  for (const l of S.events) console.log('      ' + l);
  console.log('  --- medicham2, p2a slot ---');
  for (const l of M.events) console.log('      ' + l);
  const D = DECLARED.get(R.name);
  const row = (what, s, m) => {
    const ok = s === m;
    const dec = !!(D && D.rows.has(what));
    console.log('  ' + (ok ? (dec ? 'CLOSED' : 'green ') : (dec ? 'DECL  ' : 'RED   ')) + ' ' + what.padEnd(34)
      + ' showdown ' + String(s).padEnd(8) + ' medicham2 ' + m);
    if (!ok && dec) { declBad++; return; }
    if (ok && dec) {
      console.log('        *** A DECLARED-OPEN ROW IS NOW GREEN. Remove the declaration. ***');
      bad++; return;
    }
    if (!ok) { bad++; if (R.control) ctlBad++; }
  };
  row('`-damage` lines in the volley', S.dmgLines, M.dmgLines);
  row('effectiveness lines', S.effLines, M.effLines);
  row('`-crit` lines', S.critLines, M.critLines);
  row('`-activate` lines', S.activates, M.activates);
  row('`-hitcount` value', S.hitcount, M.hitcount);
  row('HP at the end of the turn', S.final, M.final);
  row('fainted', S.fainted, M.fainted);
}
if (!ROUTES.length) {
  console.log('\n  NOTHING WAS STAGED. That is a claim about the fixture and NOT a pass.');
  process.exit(2);
}
if (ctlBad) console.log('  *** A CONTROL ARM PARTED. SUSPECT THE INSTRUMENT BEFORE THE ENGINE'
  + ' - every verdict above is unanchored until this is explained. ***');
else console.log('  controls held: the packet road works and one-arrival Disguise works, so what'
  + ' parts above is the CLAMP-plus-VOLLEY pair and nothing else.');
if (declBad) {
  console.log('\n  DECLARED OPEN, and therefore NOT counted against this file:');
  for (const [name, d] of DECLARED) console.log('    ' + name + ' — ' + d.why);
  console.log('    ' + declBad + ' declared row(s) parted. The HP row of that same route GATES and is'
    + ' green, which is what says the declaration is narration-plus-state and not a damage hole.');
}
console.log('\n' + (bad ? 'RED — ' + bad + ' UNDECLARED comparison(s) parted across ' + ROUTES.length + ' staged route(s)'
  : 'green — every undeclared comparison matched the authority (' + declBad + ' declared open)'));
process.exit(bad ? 1 : 0);
