/* probe_redirect_onto_the_aim.js — A REDIRECT HANDLER FIRES WHEN IT *RUNS*, NOT WHEN IT *MOVES THE
 * AIM*. AIM THE DARTS AT THE FOLLOW ME USER ITSELF AND THIS ENGINE STILL SPLIT THEM.
 *
 *   SHOWDOWN_PATH=... node tests/probe_redirect_onto_the_aim.js
 *   SHOWDOWN_PATH=... MEDI_REDIRECT_NEEDS_AIM_CHANGE=1 node tests/probe_redirect_onto_the_aim.js
 *
 * ================= THE SIBLING PROBE, AND WHAT IT DOES NOT COVER ================================
 *
 * `tests/probe_smart_target_redirect.js` already asserts that a redirect turns `move.smartTarget`
 * off, and reads the four clears out of the authority's own text on every run. It stages the darts
 * aimed at the redirector's PARTNER, so the redirect MOVES the aim.
 *
 * THIS PROBE STAGES THE OTHER HALF: the darts aimed AT the redirector. The authority's handler still
 * runs, still returns a target, and still clears the flag — the aim simply does not move. Read the
 * two handlers and the clear is unconditional while only the ANNOUNCEMENT is gated on the aim having
 * moved:
 *
 *     followme.condition.onFoeRedirectTarget                      data/moves.ts:6062-6069
 *       if (!...isSkyDropped() && this.validTarget(this.effectState.target, source, move.target)) {
 *         if (move.smartTarget) move.smartTarget = false;          <- unconditional
 *         return this.effectState.target;                          <- may be the body already aimed at
 *
 *     lightningrod.onAnyRedirectTarget                             data/abilities.ts:2342-2351
 *         if (move.smartTarget) move.smartTarget = false;          <- unconditional
 *         if (this.effectState.target !== target) {                <- ONLY the line is gated
 *           this.add('-activate', this.effectState.target, 'ability: Lightning Rod');
 *
 * `Pokemon#getMoveTargets` (sim/pokemon.ts:836-840) runs `priorityEvent('RedirectTarget', ...)`
 * BEFORE `getSmartTargets`, so a flag cleared by a no-op redirect still costs the split.
 *
 * ================= WHAT WAS WRONG ==============================================================
 *
 * `redirectDrawnTo` in engine/medicham2-browser.js answered the wrong question. Both of its winners
 * returned NULL when the winner was the body already aimed at:
 *
 *     if(_drawers.length) return _drawers[0]===aimed ? null : {to:_drawers[0],announce:null};
 *     if(_rods.length)  { if(_rods[0]===aimed) return null; ... }
 *
 * and `null` is what `_aimRedirected` reads. The comment beside the first line — *"THE AIMED BODY
 * BEING THE WINNER IS 'NO REDIRECT', NOT 'TRY THE NEXT ONE'"* — is right about not asking the slower
 * partner and wrong about the flag: the handler DID run. So a Dragon Darts clicked straight at a
 * Follow Me user kept its split and put its second dart into a body the authority never touches.
 *
 * ================= WHAT IT COST, MEASURED ======================================================
 *
 * Row 22 of the 34 board partings in the held-out 12,000-game draw on release `18773c22878f`
 * (`data/verification/game-differential.g12000.json`), turn 5:
 *
 *     showdown   |move|p2b: Dragapult|Dragon Darts|p1a: Clefable   (Follow Me is up on Clefable)
 *                |-immune|p1a: Clefable                             <- Fairy. Nothing else happens.
 *     medicham2  |move|p2b: Dragapult|dragondarts|p1a: Clefable
 *                |-damage|p1b: Tsareena|56/147                      <- both darts, WRONG BODY
 *                |-damage|p1b: Tsareena|14/147
 *
 * Tsareena went 147 -> 14 here and was never touched there. The `-immune` line is the authority's
 * second consequence of the same clear: `hitStepTypeImmunity` announces on
 * `runImmunity(move, !move.smartTarget)` (sim/battle-actions.ts:661).
 *
 * ================= THE ARMS ====================================================================
 *
 *   REAL      the redirect is up AND the darts are aimed at the redirector. Both darts must land on
 *             it; its partner must be UNTOUCHED, and the two streams must not part.
 *   SILENT    the same board with the redirect click replaced by a self-move. The darts MUST still
 *             split across both bodies — that is what says the flag was scoped to the redirect and
 *             Dragon Darts was not simply broken.
 *   CONTROL   the same board in a child under MEDI_REDIRECT_NEEDS_AIM_CHANGE=1, which restores the
 *             `=== aimed ? null` answer. The partner MUST be hit there. **Identical results across a
 *             varied knob mean the knob is unwired**, so that is asserted rather than hoped for.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

/* ===== THE KNOB IS NOT THE CONTROL-ARM MARKER, AND CONFLATING THEM HID THE KNOB ================
 *
 * This probe spawns ITSELF with the knob set, as its control arm, and that child must exit 0 — it
 * asserts nothing, it only reports what the pre-fix engine did. The first version keyed that quiet
 * path on the KNOB VARIABLE, so a human who set the knob from outside got the quiet path too and the
 * probe exited **0 under a deliberately broken engine**. That is precisely "an unwired knob gives
 * identical output" wearing a green exit code, and it is indistinguishable from a knob that does
 * nothing.
 *
 * The control arm is now marked by its OWN variable, set only by the spawn. So:
 *   knob set from outside  -> the FULL verdict runs against the broken engine and this exits 1
 *   spawned control child  -> the quiet path, exit 0, `__CONTROL__` for the parent to read
 * The child spawn is skipped when the knob came from outside, because a child of an already-broken
 * parent would compare a control against a control and report "the knob changed nothing" — true, and
 * about the wrong thing. */
const KNOB_SET = process.env.MEDI_REDIRECT_NEEDS_AIM_CHANGE === '1';
const CHILD = KNOB_SET && process.env.ABRA_PROBE_CONTROL_ARM === '1';
if (KNOB_SET && !CHILD) {
  console.log('');
  console.log('  MEDI_REDIRECT_NEEDS_AIM_CHANGE=1 WAS SET FROM OUTSIDE THIS PROCESS.');
  console.log('  The engine is running with the defect restored, so every assertion below is expected');
  console.log('  to FAIL and this run MUST exit 1. The control child is skipped.');
}
require(D('tests', '_live_release.js'));

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];

let bad = 0;
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');

/* BOTH POPULATIONS PRINTED BEFORE ANYTHING IS WIRED TO THEM. */
const SMART = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('smartTarget'))
  .map(([k, v]) => ({ id: k, uses: v.uses || 0 }))
  .filter(x => dex.moves.get(x.id).exists && !dex.moves.get(x.id).isNonstandard);
const REDIR_MOVES = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('redirects'))
  .map(([k, v]) => ({ id: k, uses: v.uses || 0 }))
  .filter(x => dex.moves.get(x.id).exists && !dex.moves.get(x.id).isNonstandard);
console.log('  moves tagged smartTarget : ' + (SMART.map(x => x.id + ' (' + x.uses + ')').join(', ') || 'NONE'));
console.log('  moves tagged redirects   : ' + (REDIR_MOVES.map(x => x.id + ' (' + x.uses + ')').join(', ') || 'NONE'));
if (!SMART.length || !REDIR_MOVES.length) { console.log('  ONE OF THE TWO POPULATIONS IS EMPTY — a claim about the artifact.'); process.exit(2); }

/* THE CLEAR IS READ OUT OF THE AUTHORITY, AND SO IS THE FACT THAT IT IS UNCONDITIONAL. A regulation
 * that put the clear behind the aim-moved test would make this whole probe wrong, and this is what
 * would say so. */
{
  const src = require('fs').readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'moves.ts'), 'utf8');
  const NL = String.fromCharCode(10) + String.fromCharCode(9);
  let miss = 0;
  for (const r of REDIR_MOVES) {
    const i = src.indexOf(NL + r.id + ': {');
    const block = i < 0 ? '' : src.slice(i, src.indexOf(NL + '},', i));
    const clear = /if \(move\.smartTarget\) move\.smartTarget = false;/.exec(block);
    /* THE ORDER IS THE CLAIM: the clear must sit ABOVE the `return this.effectState.target`, with no
     * `!== target` test between them. If the handler ever guarded the clear on the aim having moved,
     * this engine's old answer would have been right. */
    const ret = block.indexOf('return this.effectState.target');
    const guarded = clear && ret > 0 && /!== target/.test(block.slice(clear.index, ret));
    console.log('    ' + r.id.padEnd(12)
      + (clear ? 'clears move.smartTarget' : 'DOES NOT CLEAR IT')
      + (clear ? (guarded ? '  — but GUARDED on the aim having moved' : '  — UNCONDITIONALLY, above its return') : ''));
    if (!clear || guarded) miss++;
  }
  if (miss) { console.log('  RED — the authority does not say what this probe is about to assert.'); bad++; }
}

const MV = dex.moves.get(SMART.sort((a, b) => b.uses - a.uses)[0].id);
const USERS = POOL.filter(s => LEARNS(s, MV.id) && !G.CLOSET_SPECIES.has(norm(s.id)));
if (!USERS.length) { console.log('  NO LEGAL CARRIER OF ' + MV.id + ' — a claim about the format.'); process.exit(2); }

/* Prefer a redirector with NO powder gate: Rage Powder is refused by a Grass type, Overcoat or
 * Safety Goggles, and a fixture that silently failed that check would test nothing. */
const REDIR = REDIR_MOVES.map(r => dex.moves.get(r.id))
  .sort((a, b) => (a.flags.powder ? 1 : 0) - (b.flags.powder ? 1 : 0))[0];
console.log('  the redirect click       : ' + REDIR.id + '  (powder flag: '
  + (REDIR.flags.powder ? 'YES' : 'no') + ', priority ' + REDIR.priority + ')');

const SELF_HOLD = (s) => {
  const bad2 = new Set(['rest', 'sleeptalk', 'substitute', 'endure', 'wish', 'charge', 'doubleteam']);
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (bad2.has(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge;
  }) || null;
};

const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
const REFUSE = new Set(['onSwitchInDrop', 'damageReduce', 'survivesFromFull', 'absorbsMoveType',
  'immuneToMoveClass', 'punishesContact', 'noRecoil', 'formeAbsorbsHit', 'halvesTypeDamage',
  'redirectsType', 'typeImmunity']);
const okAbility = (s) => Object.values(s.abilities).find(ab => !abilityTags(ab).some(t => REFUSE.has(t)));
/* BOTH RECEIVING BODIES MUST TAKE THE MOVE NEUTRALLY OR BETTER. A type immunity on the PARTNER is
 * exactly the confound that would make "untouched" mean nothing here — the real game found this
 * defect through a Fairy standing in front of a Dragon move, and a probe that reproduced THAT would
 * read the same whether or not the split happened. */
const takesIt = (s) => dex.getImmunity(MV.type, s) && dex.getEffectiveness(MV.type, s) >= 0;

const REDIRECTORS = POOL.filter(s => LEARNS(s, REDIR.id) && takesIt(s) && okAbility(s)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
if (!REDIRECTORS.length) { console.log('  NO LEGAL BODY CAN CLICK THE REDIRECT AND TAKE THE MOVE.'); process.exit(2); }
const RD = REDIRECTORS[0];
const PARTNERS = POOL.filter(s => s.name !== RD.name && takesIt(s) && okAbility(s)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
if (!PARTNERS.length) { console.log('  NO LEGAL PARTNER BODY.'); process.exit(2); }
const PT = PARTNERS[0];
const U = USERS.find(s => s.name !== RD.name && s.name !== PT.name) || USERS[0];
const U_AB = okAbility(U) || Object.values(U.abilities)[0];

const FILL = POOL.filter(s => ![U.name, RD.name, PT.name].includes(s.name)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 5);
if (FILL.length < 5) { console.log('  NOT ENOUGH FILLER.'); process.exit(2); }

console.log('\n  chosen  : ' + U.name + ' [' + U_AB + '] clicks ' + MV.id + ' (' + MV.basePower
  + ' BP x' + MV.multihit + ') AIMED AT ' + RD.name + ' — the redirector ITSELF');
console.log('            ' + RD.name + ' [' + okAbility(RD) + '] clicks ' + REDIR.id + ', which changes NOTHING about the aim');
console.log('            its partner ' + PT.name + ' [' + okAbility(PT) + '] takes ' + MV.type
  + ' at x' + Math.pow(2, dex.getEffectiveness(MV.type, PT)) + ' — so "untouched" can only mean the split did not happen');
console.log('            AUTHORITY : the handler still runs and clears smartTarget — BOTH darts into '
  + RD.name + ', ' + PT.name + ' UNTOUCHED');
console.log('            DEFECT    : `=== aimed ? null` reads as "no redirect", the split survives, '
  + PT.name + ' takes a dart');

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const sides = () => {
  const A = [
    mon(U.name, [MV.name, SELF_HOLD(U) || 'Protect'], '', U_AB),
    mon(FILL[0].name, [SELF_HOLD(FILL[0])]),
    mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
    mon(FILL[2].name, [SELF_HOLD(FILL[2])]),
  ];
  const B = [
    mon(PT.name, [SELF_HOLD(PT)], '', okAbility(PT)),
    mon(RD.name, [REDIR.name, SELF_HOLD(RD)], '', okAbility(RD)),
    mon(FILL[3].name, [SELF_HOLD(FILL[3])]),
    mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
  ];
  return [A, B];
};
/* `t: 1` IS THE WHOLE DIFFERENCE FROM THE SIBLING PROBE: the darts are aimed at foe slot 1, which is
 * the redirector's own slot. */
const script = (withRedirect) => ([
  { p1: [{ m: norm(MV.id), t: 1 }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(SELF_HOLD(PT)) }, withRedirect ? { m: norm(REDIR.id) } : { m: norm(SELF_HOLD(RD)) }] },
  { p1: [{ m: norm(SELF_HOLD(U) || 'protect') }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(SELF_HOLD(PT)) }, { m: norm(SELF_HOLD(RD)) }] },
]);

const run = (withRedirect, tag) => {
  const [SA, SB] = sides();
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'redirectontotheaim/' + tag, {
    arm: G.ARM_BY_ID.get('middle'), script: script(withRedirect),
    onBoundary: (snap) => seen.push({
      mePt: snap.medi.sides.p2.party[norm(PT.name)] || null,
      sdPt: snap.sd.sides.p2.party[norm(PT.name)] || null,
      meRd: snap.medi.sides.p2.party[norm(RD.name)] || null,
      sdRd: snap.sd.sides.p2.party[norm(RD.name)] || null,
    }),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (!seen.length) return { staged: false, why: 'no turn boundary was reached' };
  /* THE LAST BOUNDARY, NOT THE FIRST: `onBoundary` fires before turn 1 too, and on that board every
   * body is untouched and the whole probe would be green on a turn it never played. */
  return { staged: true, r, M: seen[seen.length - 1], boundaries: seen.length,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

const show = (M) => {
  const f = x => x ? (String(x.hp) + '/' + x.maxhp + (x.hp === x.maxhp ? '  UNTOUCHED' : '')) : '(NO ROW)';
  console.log('    the PARTNER       me ' + f(M.mePt).padEnd(28) + ' sd ' + f(M.sdPt));
  console.log('    the REDIRECTOR    me ' + f(M.meRd).padEnd(28) + ' sd ' + f(M.sdRd));
};

console.log('\n  === THE REAL ARM — the redirect is up AND the aim is already on it ===');
const REAL = run(true, CHILD ? 'control' : 'real');
if (!REAL.staged) { console.log('  NOT STAGED — ' + REAL.why); process.exit(1); }
show(REAL.M);
console.log('    first protocol divergence: ' + (REAL.div ? JSON.stringify(REAL.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — no redirect click, so the darts MUST still split ===');
const SIL = run(false, CHILD ? 'silent-control' : 'silent');
if (!SIL.staged) { console.log('  NOT STAGED — ' + SIL.why); process.exit(1); }
show(SIL.M);
console.log('    first protocol divergence: ' + (SIL.div ? JSON.stringify(SIL.div) : 'none — the streams agree'));

const untouched = x => !!(x && x.hp === x.maxhp);
if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_REDIRECT_NEEDS_AIM_CHANGE=1) — this arm asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    mePt: REAL.M.mePt && REAL.M.mePt.hp, sdPt: REAL.M.sdPt && REAL.M.sdPt.hp,
    ptUntouched: untouched(REAL.M.mePt), div: !!REAL.div, divLine: REAL.div && REAL.div.sd,
    silentMePt: SIL.M.mePt && SIL.M.mePt.hp, silentPtUntouched: untouched(SIL.M.mePt),
  }));
  console.log('\ngreen — the control arm ran');
  process.exit(0);
}

console.log('\n  === THE VERDICT ===');
const need = (what, got, want) => {
  const ok = got === want;
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + JSON.stringify(got)
    + (ok ? '' : '   (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
  return ok;
};
need('the redirector was hit at all (the fixture — otherwise nothing was aimed anywhere)',
  !!(REAL.M.sdRd && REAL.M.sdRd.hp < REAL.M.sdRd.maxhp), true);
need('showdown: the PARTNER is untouched (the authority — both darts stayed on the redirector)',
  untouched(REAL.M.sdPt), true);
need('medicham2: the partner is untouched too', untouched(REAL.M.mePt), true);
need('the two engines agree on the redirector\'s HP', REAL.M.meRd && REAL.M.meRd.hp, REAL.M.sdRd && REAL.M.sdRd.hp);
need('the streams do not part at all', REAL.div, null);
need('SILENT CONTROL: showdown STILL splits the darts (the partner IS hit)', untouched(SIL.M.sdPt), false);
need('SILENT CONTROL: medicham2 splits them the same way', SIL.M.mePt && SIL.M.mePt.hp, SIL.M.sdPt && SIL.M.sdPt.hp);
need('SILENT CONTROL: ...and on the aimed body too', SIL.M.meRd && SIL.M.meRd.hp, SIL.M.sdRd && SIL.M.sdRd.hp);

if (KNOB_SET) {
  console.log('');
  console.log('  --- the control child is SKIPPED: the knob is already set in this process, so a child');
  console.log('      of it would compare a control against a control and say the knob changed nothing ---');
} else {
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_REDIRECT_NEEDS_AIM_CHANGE=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_REDIRECT_NEEDS_AIM_CHANGE: '1', ABRA_PROBE_CONTROL_ARM: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.mePt !== (REAL.M.mePt && REAL.M.mePt.hp);
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the partner\'s HP: default '
      + (REAL.M.mePt && REAL.M.mePt.hp) + '  vs control ' + ctl.mePt);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.ptUntouched) { console.log('  RED    the control arm did NOT hit the partner, so it is not the old behaviour.'); bad++; }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on the authority\'s line: ' + ctl.divLine);
    if (ctl.silentMePt !== (SIL.M.mePt && SIL.M.mePt.hp)) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob (' + (SIL.M.mePt && SIL.M.mePt.hp)
        + ' -> ' + ctl.silentMePt + '). The knob reaches past the redirect.'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (' + ctl.silentMePt + ')');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
