/* probe_thaw_after_secondary.js — A MOVE THAT THAWS ITS TARGET: DOES THE TARGET GET TO BE FROZEN
 * WHILE THE MOVE'S OWN SECONDARY IS APPLIED?
 *
 *   SHOWDOWN_PATH=... node tests/probe_thaw_after_secondary.js
 *   SHOWDOWN_PATH=... node tests/probe_thaw_after_secondary.js --red   (the restore arm, run for you)
 *
 * ================= WHAT THE AUTHORITY DOES ======================================================
 *
 * BOTH thaw routes are handlers on the `frz` CONDITION, and Champions overrides only `onStart` and
 * `onBeforeMove` (`data/mods/champions/conditions.ts:31-56`, `inherit: true`), so these two are
 * mainline's and are read in full at `data/conditions.ts:112-125`:
 *
 *     onAfterMoveSecondary(target, source, move) { if (move.thawsTarget) target.cureStatus(); }
 *     onDamagingHit(damage, target, source, move) {
 *       if (move.type === 'Fire' && move.category !== 'Status' && move.id !== 'polarflare') target.cureStatus();
 *     }
 *
 * `spreadMoveHit` runs its steps in a fixed order (sim/battle-actions.ts):
 *
 *     1091  const activeTarget = ...
 *     1096  if (moveData.self ...)        this.selfDrops(...)          // step 4
 *     1099  if (moveData.secondaries)     this.secondaries(...)        // step 5  <-- THE STATUS LANDS HERE
 *     1121  runEvent('DamagingHit', ...)                               // the FIRE thaw
 *      814  runEvent('AfterMoveSecondary', ...)  via afterMoveSecondaryEvent, called from
 *     1005  hitStepMoveHitLoop, i.e. the whole hit loop later                  // the thawsTarget thaw
 *
 * SO THE TARGET IS STILL FROZEN WHEN THE SECONDARY IS TRIED, ON BOTH ROUTES. `Pokemon#trySetStatus`
 * refuses a body that already carries a status, silently, so an Inferno into a frozen body applies
 * NO BURN AT ALL and then thaws. The authority's own `-damage` line says so out loud — it prints the
 * status suffix, `|-damage|p2a: Milotic|127/170 frz`, and only then `|-curestatus|`.
 *
 * `polarflare` is `isNonstandard: 'CAP'` in this regulation, so the third clause of the Fire handler
 * is unreachable here and is deliberately NOT branched on. Derived and asserted below, not assumed.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * It cleared `frz` INSIDE `_stepApply`, BEFORE the damage landed and therefore before `_stepEffects`
 * ran the secondaries — the comment at the site said so in as many words ("Cleared BEFORE the damage
 * lands"). Two consequences, one of them board-material:
 *
 *   the BOARD      the target was status-free when the secondary was tried, so it took the burn. An
 *                  Inferno (100% brn) into a frozen body ended `brn` here and `''` there, plus the
 *                  burn's own residual chip.
 *   the NARRATION  `|-curestatus|` was emitted ABOVE the `|-damage|` instead of below it, and the
 *                  damage line carried no `frz` suffix.
 *
 * The pinned pool's `pair-redirect-priority ...bo3-2635897393` row is exactly this: a Sinistcha's
 * Matcha Gotcha (thawsTarget, 20% brn) into a frozen Gengar, `p2.party.gengar.status` reading `brn`
 * here against `''` there and the HP 54 against 62 — the missing 8 being the burn's own chip.
 *
 * ================= WHAT THIS FILE MEASURES ======================================================
 *
 * A staged two-phase battle through `game_differential`'s `middle` arm, which shares every die by
 * ADDRESS so the two engines draw the same values for the same kind of roll:
 *
 *   PHASE 1 (the hunt)  a low-offence carrier clicks its freezing moves turn after turn at a bulky
 *                       defender that heals itself, until BOTH engines report `-status ... frz` on
 *                       the same turn. There is no cheaper way in: the highest `frz` chance in this
 *                       regulation is 10%, derived below and printed, so the freeze is HUNTED rather
 *                       than assumed. A hunt that finds nothing is a COULD-NOT-STAGE and says so.
 *   PHASE 2             the same script replayed up to that turn, with the thawing move clicked on
 *                       the turn after it by a partner FASTER than the defender, so the click lands
 *                       before the defender's own move can spend a thaw attempt.
 *
 * NOTHING BELOW IS TYPED. The freezing moves are every legal move with a `frz` secondary; the
 * thawing moves are every legal FIRE damaging move plus every move `data/tags.json` tags
 * `thawsTarget`; the carriers, the defender, the idle clicks and the self-heal are all derived off
 * the format and printed.
 *
 * ================= THE CLAUSES ==================================================================
 *
 * B  BOARD     — the defender's status leaf at the turn boundary agrees between the engines, and the
 *                authority's is not the secondary's status. Scored only on cells where the
 *                AUTHORITY'S OWN `-damage` line carries the `frz` suffix, which is the only proof
 *                available that the target was frozen at the moment the move hit.
 * F  NARRATION — `|-curestatus|...|frz` is emitted BELOW the thaw move's `|-damage|` in both engines.
 *                This clause is what makes the low-chance members of the family worth staging: it
 *                holds whether or not their secondary fired.
 * C  CONTROL   — the same thaw move into an UNFROZEN defender. The engines must agree, and the
 *                authority must apply the status on at least one cell, or clause B could be green
 *                on an engine that had simply stopped applying secondaries.
 * D  CONTROL   — a frozen defender hit by a damaging move that is NEITHER Fire NOR `thawsTarget`,
 *                carrying its own status secondary. The defender must stay frozen in both engines,
 *                clean and under the knob. This is the over-match half: a fix that thawed on every
 *                hit would pass B and F and fail here.
 *
 * `MEDI_THAW_BEFORE_SECONDARY=1` RESTORES the cure happening above the damage.
 *
 * ================= WHAT IT STRUCTURALLY CANNOT SEE ==============================================
 *
 * Whether `AfterMoveSecondary` and `DamagingHit` are in the right order RELATIVE TO EACH OTHER —
 * a body has one status, so the two routes can never both fire on one click. Whether the thaw
 * happens at all when the move deals no damage (a Status Fire move; there is no `thawsTarget` status
 * move in this regulation). And Sheer Force, which deletes `AfterMoveSecondary` entirely and is a
 * separate mechanic with its own probe.
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
const KNOB_ON = process.env.MEDI_THAW_BEFORE_SECONDARY === '1';
const HUNT_TURNS = 21;

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
const line = x => Array.isArray(x) ? '|' + x.join('|') : String(x);
let bad = 0;
const refused = [], threw = [];

/* ---- THE AUTHORITY'S OWN TWO HANDLERS, READ OUT OF dist ---------------------------------------- */
{
  const src = require('fs').readFileSync(
    path.join(process.env.SHOWDOWN_PATH, 'dist', 'data', 'conditions.js'), 'utf8').replace(/\s+/g, ' ');
  const ams = /onAfterMoveSecondary\(target, source, move\) \{ if \(move\.thawsTarget\) \{ target\.cureStatus\(\); \} \}/.test(src);
  const dh = /onDamagingHit\(damage, target, source, move\) \{ if \(move\.type === "Fire" && move\.category !== "Status" && move\.id !== "polarflare"\) \{ target\.cureStatus\(\); \} \}/.test(src);
  console.log(NL + '=== THE AUTHORITY, READ OUT OF dist THIS RUN ===');
  console.log('  frz.onAfterMoveSecondary (thawsTarget route) matches the form this file scores: ' + ams);
  console.log('  frz.onDamagingHit        (Fire route)        matches the form this file scores: ' + dh);
  const pf = dex.moves.get('polarflare');
  console.log('  polarflare in this regulation: exists=' + pf.exists + ' isNonstandard='
    + JSON.stringify(pf.isNonstandard) + '  -> the handler\'s third clause is '
    + (pf.isNonstandard ? 'UNREACHABLE here' : 'REACHABLE and this file does not model it'));
  if (!ams || !dh) {
    console.log(NL + 'NOT RUN — the authority\'s frz handlers no longer read the way this file scores'
      + ' them. Re-read data/conditions.ts before trusting anything below.');
    process.exit(2);
  }
  if (!pf.isNonstandard) {
    console.log(NL + 'NOT RUN — polarflare became legal in this regulation, so the Fire route has an'
      + ' exception this engine does not carry and this file does not measure.');
    process.exit(2);
  }
}

/* ---- THE FIXTURE, DERIVED ---------------------------------------------------------------------- */
const secOf = m => [].concat(m.secondaries || [], m.secondary ? [m.secondary] : []).filter(Boolean);
const statusSec = m => secOf(m).map(s => s.status).filter(Boolean);
const damaging = m => m.exists && !m.isNonstandard && m.basePower > 0 && m.category !== 'Status';
const FREEZERS = dex.moves.all().filter(m => damaging(m) && statusSec(m).includes('frz'))
  .sort((a, b) => a.id.localeCompare(b.id));
const TAGGED_THAW = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).includes('thawsTarget'));
const THAWERS = dex.moves.all()
  .filter(m => damaging(m) && m.target === 'normal' && statusSec(m).length
               && (m.type === 'Fire' || TAGGED_THAW.includes(m.id)))
  .sort((a, b) => (b.secondaries || [{}])[0].chance - (a.secondaries || [{}])[0].chance
                  || a.id.localeCompare(b.id));
/* THE OVER-FIRE CONTROL MOVE: damaging, single-target, carries a status secondary, and is NEITHER
 * Fire NOR tagged thawsTarget. Derived so the control cannot accidentally be a thawer. */
const NONTHAW = dex.moves.all()
  .filter(m => damaging(m) && m.target === 'normal' && statusSec(m).length
               && m.type !== 'Fire' && !TAGGED_THAW.includes(m.id))
  .sort((a, b) => (b.secondaries || [{}])[0].chance - (a.secondaries || [{}])[0].chance);
const HEAL = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && m.heal && !m.status && !m.volatileStatus);
/* THE IDLE CLICK — a self-targeting boost that touches neither special stat, so it cannot move the
 * damage of any special attacker in the fixture and cannot itself apply a status. */
const IDLE = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && m.boosts && !m.status && !m.volatileStatus
  && !m.boosts.spa && !m.boosts.spd);

console.log(NL + '=== THE FIXTURE, DERIVED THIS RUN (knob MEDI_THAW_BEFORE_SECONDARY='
  + (KNOB_ON ? '1' : 'unset') + ') ===');
console.log('  legal moves with a `frz` SECONDARY: '
  + FREEZERS.map(m => m.id + '@' + (secOf(m).find(s => s.status === 'frz') || {}).chance + '%').join(' '));
console.log('  tags.json thawsTarget moves       : ' + TAGGED_THAW.join(' '));
console.log('  THAWERS scored (Fire or tagged, carrying a status secondary): '
  + THAWERS.map(m => m.id + '/' + m.type + '/' + statusSec(m).join(',')
      + '@' + (secOf(m).find(s => s.status) || {}).chance + '%').join(' '));
console.log('  the non-thawing CONTROL move      : '
  + (NONTHAW[0] ? NONTHAW[0].id + '/' + NONTHAW[0].type + '/' + statusSec(NONTHAW[0]).join(',') : 'NONE'));
if (!FREEZERS.length || !THAWERS.length || !NONTHAW.length || !HEAL.length || !IDLE.length) {
  console.log(NL + 'COULD-NOT-STAGE — this regulation is missing a freezer, a thawer, a non-thawing'
    + ' control, a self-heal or an inert idle click. That is a claim about the FORMAT.');
  process.exit(1);
}

/* THE FREEZE CARRIER: the lowest-offence legal body that learns three or more freezers, so one game
 * spends three different move ADDRESSES per pass and the defender survives the hunt. */
const ICER = POOL.filter(s => FREEZERS.filter(m => LS(s)[m.id]).length >= 3)
  .sort((a, b) => (a.baseStats.atk + a.baseStats.spa) - (b.baseStats.atk + b.baseStats.spa))[0];
if (!ICER) { console.log(NL + 'COULD-NOT-STAGE — no legal body learns three freezing moves.'); process.exit(1); }
const ICE_MOVES = FREEZERS.filter(m => LS(ICER)[m.id]).slice(0, 3);

function partnerFor(mv) {
  return POOL.filter(s => LS(s)[mv.id] && IDLE.filter(i => LS(s)[i.id]).length >= 2
                          && norm(s.name) !== norm(ICER.name))
    .sort((a, b) => b.baseStats.spe - a.baseStats.spe)[0] || null;
}
function defenderFor(mv) {
  /* not Ice (cannot be frozen), not immune to the thawer's own secondary status, slower than the
   * partner so the thaw click lands before the defender can spend a thaw attempt, resists Ice so it
   * survives the hunt, and heals itself so the hunt can run its full length. */
  const st = statusSec(mv)[0];
  const P = partnerFor(mv); if (!P) return null;
  return POOL.filter(s => !s.types.includes('Ice')
      && dex.getImmunity(st === 'brn' ? 'Fire' : st === 'par' ? 'Electric' : 'Poison', s.types)
      && Math.pow(2, dex.getEffectiveness('Ice', s.types)) <= 0.5
      && s.baseStats.spe < P.baseStats.spe
      && HEAL.some(h => LS(s)[h.id]) && LS(s).protect)
    .sort((a, b) => (b.baseStats.hp + b.baseStats.spd) - (a.baseStats.hp + a.baseStats.spd))[0] || null;
}
function pad(list, used) {
  const out = list.slice();
  for (const m of list) used.add(norm(m.species));
  for (const s of POOL) {
    if (out.length >= 4) break;
    if (used.has(norm(s.name))) continue;
    used.add(norm(s.name)); out.push(mon(s.name, '', '', ['Protect']));
  }
  return out;
}

/* ---- ONE STAGED CELL --------------------------------------------------------------------------- */
function stage(mv, frozen, padTurns) {
  const P = partnerFor(mv), V = defenderFor(mv);
  if (!P || !V) { refused.push(mv.id + ': no legal partner or defender'); return null; }
  const PI = IDLE.filter(i => LS(P)[i.id]).slice(0, 2);
  const heal = HEAL.find(h => LS(V)[h.id]);
  const build = () => {
    const used = new Set();
    const pa = G.buildPair(pad([mon(ICER.name, '', '', ICE_MOVES.map(m => m.name).concat(['Protect'])),
                                mon(P.name, '', '', [mv.name].concat(PI.map(m => m.name)))], used));
    const pb = G.buildPair(pad([mon(V.name, '', '', [heal.name, 'Protect'])], used));
    return [pa, pb];
  };
  const hunt = t => ({ p1: [{ m: ICE_MOVES[t % ICE_MOVES.length].id, t: 0 }, { m: PI[t % PI.length].id }],
                       p2: [{ m: heal.id }, { m: 'protect' }] });
  const idleTurn = t => ({ p1: [{ m: 'protect' }, { m: PI[t % PI.length].id }],
                           p2: [{ m: heal.id }, { m: 'protect' }] });
  const hitTurn = { p1: [{ m: 'protect' }, { m: mv.id, t: 0 }], p2: [{ m: heal.id }, { m: 'protect' }] };
  const frzTurns = arr => { let t = 0; const out = []; for (const raw of arr) {
      const p = line(raw).split('|'); if (p[1] === 'turn') t = Number(p[2]) || t;
      if (p[1] === '-status' && /^p2a/.test(p[2] || '') && p[3] === 'frz') out.push(t); } return out; };

  let F = 0;
  if (frozen) {
    const [pa, pb] = build();
    const script = []; for (let t = 0; t < HUNT_TURNS; t++) script.push(hunt(t));
    let r;
    try { r = G.playGame(pa, pb, 'directed', 'probe_thaw/hunt/' + mv.id, { script, arm: ARM }); }
    catch (e) { threw.push('hunt ' + mv.id + ': ' + String((e && e.message) || e).split(NL)[0]); return null; }
    const sdF = frzTurns(G.sdStream(G.lastSdLog())), meF = frzTurns(r.mediTrace || []);
    if (!sdF.length || sdF[0] !== meF[0]) {
      refused.push(mv.id + ': the hunt found no shared freeze in ' + HUNT_TURNS + ' turns [sd '
        + (sdF.join(',') || 'none') + ' / me ' + (meF.join(',') || 'none') + ']');
      return null;
    }
    F = sdF[0];
  }
  const [pa2, pb2] = build();
  const s2 = [];
  for (let t = 0; t < F; t++) s2.push(hunt(t));
  /* THE CONTROL'S HIT TURN IS SWEPT BY THE CALLER, not fixed. The middle arm addresses every die by
   * TURN, so a control staged on one turn is one draw of the accuracy die and one of the secondary
   * die — and the first version of this file staged Inferno's control on a turn it MISSED, which
   * read as "the authority applied no status" and would have been reported as a dead secondary. */
  if (!frozen) for (let t = 0; t < (padTurns || 1); t++) s2.push(idleTurn(t));
  s2.push(JSON.parse(JSON.stringify(hitTurn)));
  let r2;
  try { r2 = G.playGame(pa2, pb2, 'directed', 'probe_thaw/hit/' + mv.id + '/' + (frozen ? 'frz' : 'clear'),
                        { script: s2, arm: ARM }); }
  catch (e) { threw.push('hit ' + mv.id + ': ' + String((e && e.message) || e).split(NL)[0]); return null; }
  const T = s2.length;
  const tailOf = arr => { let t = 0; const out = []; for (const raw of arr) {
      const l = line(raw); const p = l.split('|'); if (p[1] === 'turn') t = Number(p[2]) || t;
      if (t >= T) out.push(l); } return out; };
  const sd = tailOf(G.sdStream(G.lastSdLog())), me = tailOf(r2.mediTrace || []);
  const read = arr => {
    const dmgIx = arr.findIndex(l => /^\|-damage\|p2a/.test(l));
    const curIx = arr.findIndex(l => /^\|-curestatus\|p2a[^|]*\|frz/.test(l));
    const dmg = dmgIx >= 0 ? arr[dmgIx] : '';
    return { connected: dmgIx >= 0, dmgFrz: /\bfrz\b/.test(dmg), curIx, dmgIx,
             gained: arr.filter(l => /^\|-status\|p2a/.test(l)).map(l => l.split('|')[3]) };
  };
  const div = (r2.stateDiv && Array.isArray(r2.stateDiv.diffs)) ? r2.stateDiv.diffs : [];
  return { mv: mv.id, frozen, F, turn: T, defender: V.name, partner: P.name,
           sd: read(sd), me: read(me), sdLines: sd, meLines: me,
           statusDiv: div.filter(d => /\.status$/.test(d.path)),
           anyDiv: div };
}

/* ---- THE SWEEP --------------------------------------------------------------------------------- */
const scored = [], ctrlClear = [], ctrlNonThaw = [];
for (const mv of THAWERS) {
  const row = stage(mv, true);
  if (row) {
    if (!row.sd.connected) { refused.push(mv.id + ': the thaw click never connected on the authority'); }
    else if (!row.sd.dmgFrz) { refused.push(mv.id + ': the AUTHORITY\'s damage line carries no `frz`'
      + ' suffix, so the target was not frozen when the move hit and this cell asks nothing'); }
    else scored.push(row);
  }
  /* Sweep the control's turn until the authority both CONNECTS and applies its status; a cell where
   * the move missed or the secondary die came up short asks nothing and is not kept. */
  let c = null;
  for (let padT = 1; padT <= 8; padT++) {
    const cand = stage(mv, false, padT);
    if (!cand || !cand.sd.connected) continue;
    c = cand;
    if (cand.sd.gained.length) break;
  }
  if (c) ctrlClear.push(c);
}
{
  const mv = NONTHAW[0];
  const row = stage(mv, true);
  if (row && row.sd.connected && row.sd.dmgFrz) ctrlNonThaw.push(row);
  else refused.push('control ' + mv.id + ': could not stage a frozen defender for the over-fire control');
}

const show = r => '  ' + (r.frozen ? 'FROZEN ' : 'CLEAR  ') + r.mv.padEnd(15)
  + ('->' + r.defender).padEnd(14) + ' froze t' + r.F + ' hit t' + r.turn
  + '  sd[dmgFrz=' + r.sd.dmgFrz + ' gained=' + JSON.stringify(r.sd.gained)
  + ' cureBelowDamage=' + (r.sd.curIx < 0 ? 'n/a' : r.sd.curIx > r.sd.dmgIx) + ']'
  + '  me[gained=' + JSON.stringify(r.me.gained)
  + ' cureBelowDamage=' + (r.me.curIx < 0 ? 'n/a' : r.me.curIx > r.me.dmgIx) + ']'
  + '  status leaf parted=' + (r.statusDiv.length ? JSON.stringify(r.statusDiv[0]) : 'no');

console.log(NL + '=== THE SWEEP — ' + scored.length + ' scored cell(s), ' + ctrlClear.length
  + ' unfrozen control(s), ' + ctrlNonThaw.length + ' non-thawing control(s) ===');
console.log('  freeze carrier ' + ICER.name + ' clicking ' + ICE_MOVES.map(m => m.id).join('/'));
if (refused.length) console.log('  REFUSED (' + refused.length + '): ' + refused.join(' | '));
if (threw.length) console.log('  THREW (' + threw.length + '): ' + threw.join(' | '));
for (const r of scored.concat(ctrlClear, ctrlNonThaw)) console.log(show(r));

/* ---- CLAUSE A — THE FIXTURE REACHED THE RULE --------------------------------------------------- */
if (!scored.length) {
  console.log(NL + 'COULD-NOT-STAGE — no cell put a frozen defender under a thawing move. That is a'
    + ' claim about this fixture and about nothing else.');
  process.exit(1);
}

/* ---- CLAUSE B — THE BOARD ---------------------------------------------------------------------- */
const bBad = scored.filter(r => r.statusDiv.length
  || JSON.stringify(r.sd.gained) !== JSON.stringify(r.me.gained));
console.log(NL + 'CLAUSE B — ' + (scored.length - bBad.length) + ' of ' + scored.length
  + ' scored cell(s) agree on what the frozen defender gained.');
if (bBad.length) {
  console.log('  FAIL — ' + bBad.length + ' cell(s) part: ' + bBad.map(r => r.mv
    + ' sd=' + JSON.stringify(r.sd.gained) + ' me=' + JSON.stringify(r.me.gained)
    + (r.statusDiv.length ? ' ' + JSON.stringify(r.statusDiv[0]) : '')).join(' | '));
  bad++;
}

/* ---- CLAUSE F — THE NARRATION ORDER ------------------------------------------------------------ */
const fRows = scored.filter(r => r.sd.curIx >= 0);
const fBad = fRows.filter(r => !(r.sd.curIx > r.sd.dmgIx) || r.me.curIx < 0 || !(r.me.curIx > r.me.dmgIx));
console.log(NL + 'CLAUSE F — ' + (fRows.length - fBad.length) + ' of ' + fRows.length
  + ' cell(s) emit `-curestatus frz` BELOW the thaw move\'s `-damage`, in both engines.');
if (!fRows.length) {
  console.log('  FAIL — the authority never emitted a cure line, so the order was never asked.');
  bad++;
} else if (fBad.length) {
  console.log('  FAIL — ' + fBad.length + ' cell(s): ' + fBad.map(r => r.mv
    + ' sd(dmg@' + r.sd.dmgIx + ' cure@' + r.sd.curIx + ')'
    + ' me(dmg@' + r.me.dmgIx + ' cure@' + r.me.curIx + ')').join(' | '));
  bad++;
}

/* ---- CLAUSE C — THE UNFROZEN CONTROL ----------------------------------------------------------- */
console.log(NL + 'CLAUSE C — ' + ctrlClear.length + ' unfrozen control cell(s).');
const cBad = ctrlClear.filter(r => r.statusDiv.length
  || JSON.stringify(r.sd.gained) !== JSON.stringify(r.me.gained));
const cApplied = ctrlClear.filter(r => r.sd.gained.length).length;
if (!ctrlClear.length) { console.log('  FAIL — no unfrozen control was staged.'); bad++; }
else if (cBad.length) {
  console.log('  FAIL — ' + cBad.length + ' control cell(s) part: ' + cBad.map(r => r.mv
    + ' sd=' + JSON.stringify(r.sd.gained) + ' me=' + JSON.stringify(r.me.gained)).join(' | '));
  bad++;
} else if (!cApplied) {
  console.log('  FAIL — the authority applied NO status on any unfrozen control, so clause B could be'
    + ' green on an engine that had simply stopped applying secondaries.');
  bad++;
} else console.log('  the secondary lands on an unfrozen body in both engines (' + cApplied
  + ' cell(s) where the authority applied one).');

/* ---- CLAUSE D — THE NON-THAWING CONTROL -------------------------------------------------------- */
console.log(NL + 'CLAUSE D — ' + ctrlNonThaw.length + ' non-thawing control cell(s).');
if (!ctrlNonThaw.length) { console.log('  FAIL — the over-fire question was not asked.'); bad++; }
else {
  const dBad = ctrlNonThaw.filter(r => r.statusDiv.length || r.sd.curIx >= 0 || r.me.curIx >= 0);
  if (dBad.length) {
    console.log('  FAIL — ' + dBad.length + ' cell(s): a non-Fire, non-thawsTarget move thawed the'
      + ' defender or parted the status leaf: ' + dBad.map(r => r.mv
        + ' sdCure@' + r.sd.curIx + ' meCure@' + r.me.curIx
        + (r.statusDiv.length ? ' ' + JSON.stringify(r.statusDiv[0]) : '')).join(' | '));
    bad++;
  } else console.log('  the defender stays frozen in both engines when the move thaws nothing.');
}

/* ---- THE RESTORE ARM --------------------------------------------------------------------------- */
if (!RED_CHILD && !KNOB_ON) {
  console.log(NL + '=== THE RESTORE ARM — MEDI_THAW_BEFORE_SECONDARY=1, in a child (the knob is read'
    + ' at module load, so it cannot be flipped in-process) ===');
  const cp = require('child_process');
  let out = '';
  try {
    out = cp.execFileSync(process.execPath, [__filename, '--red'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
        env: Object.assign({}, process.env, { MEDI_THAW_BEFORE_SECONDARY: '1' }) });
  } catch (e) {
    out = String((e && e.stdout) || '');
    if (!out) {
      console.log('  FAIL — the restore arm produced no output at all: '
        + String((e && e.message) || e).split(NL)[0]);
      bad++;
    }
  }
  const bLine = (out.match(/^CLAUSE B — .*$/m) || [''])[0];
  const fLine = (out.match(/^CLAUSE F — .*$/m) || [''])[0];
  const cLine = (out.match(/^CLAUSE C — .*$/m) || [''])[0];
  const dLine = (out.match(/^CLAUSE D — .*$/m) || [''])[0];
  console.log('  child ' + bLine);
  console.log('  child ' + fLine);
  console.log('  child ' + cLine);
  console.log('  child ' + dLine);
  const redF = /^ {2}FAIL — \d+ cell\(s\): .*cure@/m.test(out);
  const redB = (out.match(/^ {2}FAIL — (\d+) cell\(s\) part:/m) || [])[1];
  console.log('  child board disagreements: ' + (redB === undefined ? '0' : redB)
    + ';  child narration-order failures: ' + redF);
  if ((redB === undefined || Number(redB) === 0) && !redF) {
    console.log('  FAIL — THE KNOB CHANGED NOTHING. Either it is not bound or this fixture never'
      + ' reaches the rule, and a green run above is therefore evidence of nothing.');
    bad++;
  } else {
    console.log('  the knob moves the fixture — it reaches the rule.');
  }
  if (/^ {2}FAIL — \d+ control cell\(s\) part/m.test(out)) {
    console.log('  FAIL — the restore arm ALSO moved the unfrozen control. The knob is wider than the'
      + ' rule it restores.');
    bad++;
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' clause(s) failed.' : 'GREEN — every clause held.'));
process.exit(bad ? 1 : 0);
