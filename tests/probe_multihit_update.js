/* probe_multihit_update.js — `eachEvent('Update')` IS INSIDE THE HIT LOOP, SO A PINCH BERRY IS EATEN
 * BETWEEN THE HITS OF A VOLLEY AND NOT AFTER IT.
 *
 *   SHOWDOWN_PATH=... node tests/probe_multihit_update.js
 *
 * WHERE THIS CAME FROM. The 2026-08-27 pinned whole-game differential (961 games, arm `middle`) has
 * SIX counted divergences. One of them is this, and the artifact's own cause string reads
 *
 *     extra event emitted by medicham2 :: |-enditem|p2a|sitrusberry|[eat] <> |-damage|p2a|H/H
 *
 * which names the CLASS and not the direction. Read out of `data/divergence-turns.json` card 3, both
 * engines' streams side by side, a four-hit Scale Shot into a 170 HP Incineroar holding a Sitrus:
 *
 *     SHOWDOWN                              MEDICHAM2
 *     -damage 140/170                       -damage 140/170
 *     -damage 110/170                       -damage 110/170
 *     -damage  80/170   <- crosses 1/2      -damage  80/170
 *     -enditem Sitrus [eat]                 -damage  50/170   <- a body the authority never had
 *     -heal   122/170                       -enditem Sitrus [eat]
 *     -damage  92/170                       -heal    92/170
 *     -hitcount 4                           -hitcount 4
 *
 * BOTH ENGINES ATE THE BERRY AND BOTH ENDED THE TURN ON 92/170. The authority ate it BETWEEN hit 3
 * and hit 4, at 80; this engine ate it after the whole volley, at 50. The `extra event` is our
 * fourth `-damage` line, which has no counterpart because the authority's fourth `-damage` reads
 * `92/170` — it lands on a body that has already healed.
 *
 * IT IS NOT NARRATION, AND THE OBSERVED GAME IS THE BENIGN CORNER OF IT. The engine spent two hits
 * standing on an HP the authority never reaches. Where the remaining hits total more than the body's
 * post-berry pool, the authority's body LIVES and this one FAINTS — a board difference, produced by
 * exactly the same wire, that this particular pair of teams happened not to reach.
 *
 * THE AUTHORITY'S POSITION, READ RATHER THAN RECALLED. `hitStepMoveHitLoop` raises the Update event
 * once per HIT, one statement below the damage accounting and inside the loop:
 *
 *     for (const [i, md] of moveDamage.entries()) { ... move.totalDamage += damage[i]; }
 *     this.battle.eachEvent('Update');                          sim/battle-actions.ts:967
 *     if (!pokemon.hp && targets.length === 1) { hit++; break; }
 *   }
 *   this.battle.faintMessages(false, false, !pokemon.hp);       :976
 *
 * and Champions overrides `hitStepMoveHitLoop` KEEPING that line verbatim —
 * data/mods/champions/scripts.ts:428 (the override) and :538 (the Update). Champions does NOT
 * override the berry: `grep -c sitrus data/mods/champions/items.ts` is 0, so `sitrusberry` is
 * mainline's (data/items.ts:5740), `onUpdate(pokemon) { if (pokemon.hp <= pokemon.maxhp / 2)
 * pokemon.eatItem(); }` with `onEat: this.heal(pokemon.baseMaxhp / 4)`. Both files were read this
 * session; neither value is typed from memory.
 *
 * THIS ENGINE ALREADY DECLARED THE GAP AND THE DECLARATION IS WHAT THIS CLOSES. `_stepUpdate`'s own
 * header says it: *"the pass is per HIT in the authority and this engine wraps the step list once per
 * MOVE, so a multi-hit move gets one pass rather than n"*. `_stepUpdate` is the LAST hit's pass. The
 * fix runs the same `_updateEvent` between the packets of a volley, which is where the other n-1 go.
 *
 * WHAT THE FIX STILL DOES NOT DO, said here rather than left to be found: the intermediate passes are
 * raised immediately below each packet's `-damage`, whereas the authority raises them below that
 * hit's WHOLE `spreadMoveHit` — its secondaries and its `onAfterHit` included. No multi-hit move in
 * this format carries a target secondary (printed below, derived, not asserted from memory), so the
 * two positions coincide today. The step list is still wrapped once per move; that remains
 * `tests/test-resolution-order.js`'s KNOWN-OPEN arm.
 *
 * THE FIXTURE IS CONSTRUCTED AND SEARCHED, AND IT IS SELECTED BY THE AUTHORITY ALONE. A crossing that
 * lands on the LAST hit is invisible (both engines eat in the same slot) and a crossing that KILLS is
 * a different claim, so the search plays candidate boards and keeps the first whose SHOWDOWN stream
 * shows the eat strictly between the first and the last `-damage` of the volley with no faint.
 * medicham2's stream is never consulted while choosing — choosing on "where they differ" would be
 * cherry-picking, and the selection is printed so a reader can check that it was not.
 *
 * THE CONTROL IS A CHILD ON `MEDI_MULTIHIT_UPDATE_ONCE=1`, which restores the once-per-move pass. The
 * parent FAILS if the knob does not move the eat back to the end of the volley, and FAILS if the
 * control arm does not part from the authority — a knob whose two arms agree is unwired.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_MULTIHIT_UPDATE_ONCE === '1';

/* The preload is self-applied for the reason tests/probe_recoil_after_clamp.js states: requiring the
 * driver first would cut a release into the REAL store, and doing the redirect with `-r` would make
 * this file unrunnable by engine/register_reality.js. */
require(D('tests', '_live_release.js'));

/* `--team-store` IS PUSHED HERE AND IT IS NOT COSMETIC. `engine/diff_swarm.js` caches ONE team pool
 * in data/diff-team-pool.json, keyed on the store it was built from. A probe that let the driver read
 * the LIVE store would leave the cache holding a live key and charge the next PINNED run a ~41 s
 * rebuild — and the cache is single-slot, so the two runs fight. This probe never draws a team from
 * the pool (every board here is staged by hand), so pinning it costs nothing and keeps the slot. */
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

let bad = 0;
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');

/* ---- THE MOVE ------------------------------------------------------------------------------------
 * Every legal multi-hit move is printed with the reason it is or is not usable here, because "there
 * was no candidate" and "the search never looked" are the same output otherwise.
 *
 *   accuracy must be 100 — the arm below is `top-tie-first`, in which every sub-100 move MISSES.
 *   smartTarget must be off — Dragon Darts splits its two hits across two bodies, so its `-damage`
 *     lines are not one volley into one body and the crossing question is a different one.
 *   the hit count must be able to exceed 2 — with two hits there is no board where the crossing is
 *     mid-volley AND the body survives: the crossing needs d >= H/2 and survival needs 2d < H. */
const MULTI = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.multihit);
const hits = m => (Array.isArray(m.multihit) ? m.multihit[1] : m.multihit);
console.log('  every legal multi-hit move in this format:');
for (const m of MULTI) {
  const why = [];
  if (!(m.accuracy === true || m.accuracy === 100)) why.push('acc ' + m.accuracy + ' — misses on this arm');
  if (m.smartTarget) why.push('smartTarget — the hits go to different bodies');
  if (hits(m) < 3) why.push('at most ' + hits(m) + ' hits — no mid-volley crossing survives');
  if (m.secondaries && m.secondaries.length) why.push('carries a target secondary');
  console.log('      ' + m.id.padEnd(16) + 'multihit=' + JSON.stringify(m.multihit) + ' bp=' + m.basePower
    + ' acc=' + m.accuracy + ' type=' + m.type + (why.length ? '   NOT USABLE: ' + why.join('; ') : '   usable'));
}
const SEC = MULTI.filter(m => m.secondaries && m.secondaries.length);
console.log('  multi-hit moves carrying a TARGET SECONDARY: ' + (SEC.length ? SEC.map(m => m.id).join(', ')
  : 'NONE — so "below the packet" and "below the whole spreadMoveHit" are the same position today'));
const USABLE = MULTI.filter(m => (m.accuracy === true || m.accuracy === 100) && !m.smartTarget && hits(m) >= 3)
  .sort((a, b) => (b.basePower * hits(b)) - (a.basePower * hits(a)) || a.id.localeCompare(b.id));
if (!USABLE.length) { console.log('  NO USABLE MULTI-HIT MOVE — a claim about the format, not the engine.'); process.exit(2); }
const MV = USABLE[0];
console.log('  chosen move                        : ' + MV.name + '  (' + JSON.stringify(MV.multihit)
  + ' hits, ' + MV.basePower + ' BP, ' + MV.type + ')');

/* ---- THE BERRY ----------------------------------------------------------------------------------
 * Read off the artifact, never named: the item must heal at an HP THRESHOLD, and the threshold must
 * be strictly inside the volley's reach. `healsAtThreshold` is the same tag `berryPinchUpdate`
 * consumes, so the probe and the engine are looking at one fact. */
const PINCH = Object.entries(TAGS.items || {})
  .filter(([, v]) => (v.tags || []).includes('healsAtThreshold'))
  .map(([k, v]) => ({ id: k, p: v.params.healsAtThreshold, uses: v.uses }))
  .sort((a, b) => b.uses - a.uses);
console.log('  items tagged healsAtThreshold      :');
for (const b of PINCH) console.log('      ' + b.id.padEnd(14) + 'triggersBelow=' + b.p.triggersBelow
  + ' restores=' + b.p.restores + ' restoresFlat=' + b.p.restoresFlat + '  (' + b.uses + ' sheets)');
const BERRY = PINCH.find(b => b.p.triggersBelow && b.p.restores
  && dex.items.get(b.id).exists && !dex.items.get(b.id).isNonstandard);
if (!BERRY) { console.log('  NO FRACTIONAL PINCH BERRY — a claim about the artifact.'); process.exit(2); }
const BERRY_ITEM = dex.items.get(BERRY.id);
console.log('  chosen berry                       : ' + BERRY_ITEM.name + '  (eats below '
  + BERRY.p.triggersBelow + ', restores ' + BERRY.p.restores + ')');

/* ---- THE BODIES ----------------------------------------------------------------------------------
 * The target's ability must not touch the berry, the threshold or the item; Berserk's own param
 * carries `defersHealingBerry`, which is a DIFFERENT mechanic sitting on this exact line. The
 * attacker's and the fillers' must not put weather or terrain on the board, which would move the
 * damage under the reader's feet. Both read off the tag names, never off a list of abilities. */
const abTags = s => { const t = TAGS.abilities[norm(Object.values(s.abilities)[0])]; return (t && t.tags) || []; };
const NO_BERRY_AB = s => !abTags(s).some(t => /berry|threshold|heal|item|ripen|unnerve/i.test(t));
const NO_FIELD_AB = s => !abTags(s).some(t => /weather|terrain/i.test(t));
/* a status move the target spends its turn on: it must not shield the volley away and must not leave. */
const SELF_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.flags.charge && !m.stallingMove && !m.selfSwitch
  && !(TAGS.moves[m.id] && (TAGS.moves[m.id].tags || []).includes('userFaints'))).map(m => m.id);

const ATTS = POOL.filter(s => LEARNS(s, MV.id) && LEARNS(s, 'protect') && NO_FIELD_AB(s))
  .sort((a, b) => (MV.category === 'Physical' ? b.baseStats.atk - a.baseStats.atk
    : b.baseStats.spa - a.baseStats.spa) || a.name.localeCompare(b.name));
const TGTS = POOL.filter(s => dex.getImmunity(MV.type, s) && dex.getEffectiveness(MV.type, s) === 0
  && NO_BERRY_AB(s) && NO_FIELD_AB(s) && SELF_MOVES.some(m => LEARNS(s, m)))
  .sort((a, b) => a.name.localeCompare(b.name));
const FILL = POOL.filter(s => LEARNS(s, 'protect') && NO_FIELD_AB(s));
console.log('  attackers that learn it            : ' + ATTS.length
  + (ATTS.length ? '   e.g. ' + ATTS.slice(0, 4).map(s => s.name).join(', ') : ''));
console.log('  neutral targets with a hold move   : ' + TGTS.length);
if (!ATTS.length || TGTS.length < 2 || FILL.length < 8) {
  console.log('  NOT ENOUGH LEGAL BODIES — a claim about the fixture, not about the engine.'); process.exit(2);
}

const mon = (sp, mvs, item, ab) => ({ species: sp, item: item || '', ability: ab || '', moves: mvs });
const ARM = G.ARM_BY_ID.get('top-tie-first');
if (!ARM) { console.log('  NO SUCH ARM — a claim about the driver.'); process.exit(2); }

/* WHY A CANDIDATE WAS SKIPPED, COUNTED AND NAMED RATHER THAN SWALLOWED. `mcKey` THROWS by contract on
 * a species with no `MC.mons` row rather than guessing, so a build failure here is legitimate and
 * common. A bare `catch { return null }` would make "this body cannot be built" and "the builder is
 * broken" read alike — and if it ever became ALL of them, the search below would report NO BOARD PUTS
 * THE CROSSING MID-VOLLEY, which is a claim about Pokemon, when the truth was that nothing built. */
const SKIPPED = { noFiller: 0, noHoldMove: 0, buildThrew: 0, buildNull: 0, gameThrew: 0 };
const SKIP_WHY = [];
/* Play one candidate board and report what the AUTHORITY did to the target during the volley. */
function playOne(AT, T, hb) {
  const HOLD = SELF_MOVES.find(m => LEARNS(T, m));
  const f = FILL.filter(s => s.name !== AT.name && s.name !== T.name).slice(0, 6);
  if (f.length < 6) { SKIPPED.noFiller++; return null; }
  if (!HOLD) { SKIPPED.noHoldMove++; return null; }
  const A = [mon(AT.name, [MV.name, 'Protect'], '', Object.values(AT.abilities)[0]),
    mon(f[0].name, ['Protect']), mon(f[1].name, ['Protect']), mon(f[2].name, ['Protect'])];
  const B = [mon(T.name, [HOLD, 'Protect'], BERRY_ITEM.name, Object.values(T.abilities)[0]),
    mon(f[3].name, ['Protect']), mon(f[4].name, ['Protect']), mon(f[5].name, ['Protect'])];
  const script = [{ p1: [{ m: norm(MV.id), t: 0 }, { m: 'protect' }], p2: [{ m: HOLD }, { m: 'protect' }] }];
  let a, b;
  try { a = G.buildPair(A); b = G.buildPair(B, { hpBoost: hb }); }
  catch (e) {
    SKIPPED.buildThrew++;
    SKIP_WHY.push(AT.name + ' vs ' + T.name + ' x' + hb + ': buildPair threw — '
      + String((e && e.message) || e));
    return null;
  }
  if (!a || !b) {
    SKIPPED.buildNull++;
    SKIP_WHY.push(AT.name + ' vs ' + T.name + ' x' + hb + ': buildPair returned null');
    return null;
  }
  G.resetScriptCounters();
  const g = G.playGame(a, b, 'directed', 'mhupd/' + norm(AT.name) + '/' + norm(T.name) + '/' + hb,
    { arm: ARM, script });
  if (g.err) {
    SKIPPED.gameThrew++;
    SKIP_WHY.push(AT.name + ' vs ' + T.name + ' x' + hb + ': the game threw — ' + g.err);
    return null;
  }
  return { AT, T, hb, HOLD, A, B, script, a, b, g,
    sd: read(G.sdStream(G.lastSdLog())), me: read(g.mediTrace || []),
    sc: G.scriptCounters() };
}
/* WHAT THE TARGET'S SLOT DID, out of one stream. The slot is `p2a:` rather than a species name,
 * because the two engines spell a name differently and matching on it would silently read zero. */
function read(lines) {
  const ev = lines.filter(l => /^\|(-damage|-heal|-enditem|faint)\|p2a:/.test(l));
  const hp = l => { const m = /\|(\d+)\/(\d+)/.exec(l); return m ? +m[1] : null; };
  const dmg = ev.filter(l => l.startsWith('|-damage|'));
  const eatAt = ev.findIndex(l => /^\|-enditem\|p2a:[^|]*\|[^|]*\|\[eat\]/.test(l));
  return {
    events: ev,
    hits: dmg.length,
    /* how many of the volley's `-damage` lines precede the eat. THE WHOLE MEASUREMENT. */
    hitsBeforeEat: eatAt < 0 ? null : ev.slice(0, eatAt).filter(l => l.startsWith('|-damage|')).length,
    ate: eatAt >= 0,
    fainted: ev.some(l => l.startsWith('|faint|')),
    lowest: dmg.length ? Math.min(...dmg.map(hp).filter(v => v != null)) : null,
    final: ev.length ? hp(ev[ev.length - 1]) : null,
  };
}

/* ---- THE SEARCH, JUDGED ON THE SHOWDOWN STREAM ONLY --------------------------------------------- */
const STRIDE = Math.max(1, Math.floor(TGTS.length / 12));
let F = null; const tried = [];
outer:
for (const AT of ATTS.slice(0, 4)) {
  for (let i = 0; i < TGTS.length; i += STRIDE) {
    for (const hb of [1, 2, 3]) {
      const r = playOne(AT, TGTS[i], hb);
      if (!r) continue;
      const s = r.sd;
      tried.push(AT.name + ' -> ' + TGTS[i].name + ' x' + hb + '  sd hits=' + s.hits
        + ' ate=' + s.ate + ' beforeEat=' + s.hitsBeforeEat + ' fainted=' + s.fainted);
      if (s.ate && !s.fainted && s.hits >= 3 && s.hitsBeforeEat > 0 && s.hitsBeforeEat < s.hits) { F = r; break outer; }
    }
  }
}
console.log('  candidate boards played            : ' + tried.length);
for (const t of tried.slice(-6)) console.log('      ' + t);
const SKIP_N = Object.values(SKIPPED).reduce((a, b) => a + b, 0);
console.log('  candidate boards SKIPPED           : ' + SKIP_N + '   ' + JSON.stringify(SKIPPED)
  + (SKIP_WHY.length ? '\n      e.g. ' + SKIP_WHY.slice(0, 3).join(' | ') : ''));
if (!tried.length && SKIP_N) {
  console.log('  RED — EVERY CANDIDATE WAS SKIPPED AND NONE WAS PLAYED. That is the harness, not the '
    + 'format, and the "no board puts the crossing mid-volley" verdict below would have read as a '
    + 'fact about Pokemon.');
  process.exit(1);
}
if (!F) {
  console.log('  NO BOARD IN THIS FORMAT PUTS THE CROSSING MID-VOLLEY — a claim about the fixture, '
    + 'not about the engine. Nothing was staged.');
  process.exit(2);
}
console.log('  CHOSEN (on the SHOWDOWN stream alone): ' + F.AT.name + ' clicks ' + MV.name + ' into '
  + F.T.name + ' holding ' + BERRY_ITEM.name + ', hpBoost x' + F.hb
  + '   [target holds with ' + F.HOLD + ']');
if (F.sc.moveNotOnRequest) {
  console.log('  RED — ' + F.sc.moveNotOnRequest + ' scripted click(s) were not on the request ('
    + F.sc.firstMissing + '). The arm did not run.');
  process.exit(1);
}

console.log('\n  === THE TARGET\'S SLOT, LINE FOR LINE ===');
console.log('  --- showdown ---');
for (const l of F.sd.events) console.log('      ' + l);
console.log('  --- medicham2 ---');
for (const l of F.me.events) console.log('      ' + l);

/* ---- THE VERDICT -------------------------------------------------------------------------------- */
const S = F.sd, M = F.me;
console.log('\n  === THE VERDICT ===');
console.log('  hits in the volley                 : showdown ' + S.hits + '   medicham2 ' + M.hits);
console.log('  `-damage` lines BEFORE the eat     : showdown ' + S.hitsBeforeEat + '   medicham2 ' + M.hitsBeforeEat);
console.log('  lowest HP the body ever stood on   : showdown ' + S.lowest + '   medicham2 ' + M.lowest);
console.log('  HP at the end of the volley        : showdown ' + S.final + '   medicham2 ' + M.final);

if (CHILD) {
  console.log('  CONTROL ARM (MEDI_MULTIHIT_UPDATE_ONCE=1) — this arm asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({ beforeEat: M.hitsBeforeEat, lowest: M.lowest,
    hits: M.hits, parted: M.hitsBeforeEat !== S.hitsBeforeEat || M.lowest !== S.lowest }));
} else {
  const need = (what, got, want) => {
    const ok = got === want;
    console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + got + (ok ? '' : '   (wanted ' + want + ')'));
    return ok;
  };
  /* THE AUTHORITY IS ASSERTED FIRST AND IT IS A CONTROL ON THE FIXTURE, not a restatement of the
   * claim: if Showdown did NOT eat mid-volley on this board then the selection above is broken and
   * every line under it means nothing. */
  if (!need('showdown ate it mid-volley (a control on the FIXTURE, not on the engine)',
    S.hitsBeforeEat > 0 && S.hitsBeforeEat < S.hits, true)) bad++;
  if (!need('medicham2 ate it after the same number of hits', M.hitsBeforeEat, S.hitsBeforeEat)) bad++;
  if (!need('...so it never stands on an HP the authority never reaches', M.lowest, S.lowest)) bad++;
  if (!need('...and the two volleys land the same number of hits', M.hits, S.hits)) bad++;
  if (!need('...and end on the same HP', M.final, S.final)) bad++;
}

if (!CHILD) {
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_MULTIHIT_UPDATE_ONCE=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_MULTIHIT_UPDATE_ONCE: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').slice(-14).map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.beforeEat !== M.hitsBeforeEat || ctl.lowest !== M.lowest;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob MOVES the eat: default beforeEat='
      + M.hitsBeforeEat + ' lowest=' + M.lowest + '   vs control beforeEat=' + ctl.beforeEat
      + ' lowest=' + ctl.lowest);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (!ctl.parted) { console.log('  RED    the control arm did NOT part from the authority, so it is not the old behaviour.'); bad++; }
  }
}

/* THE CHILD MUST NOT PRINT "green". It asserts nothing about the fix by construction, and a control
 * arm that signs off as a pass is how a measurement gets quoted as a verdict. */
console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed'
  : CHILD ? 'CONTROL ARM FINISHED — it MEASURED, it did not assert. The parent judges.'
    : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
