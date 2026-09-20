/* probe_bounced_move_redirect.js — A MAGIC-BOUNCED MOVE IS A WHOLE NEW `useMove`, SO IT GOES
 * THROUGH TARGET SELECTION AGAIN — AND A FOLLOW ME ON THE OTHER SIDE DRAWS IT.
 *
 *   SHOWDOWN_PATH=... node tests/probe_bounced_move_redirect.js
 *   SHOWDOWN_PATH=... MEDI_BOUNCE_IGNORES_REDIRECT=1 node tests/probe_bounced_move_redirect.js
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED ====================================
 *
 * `data/mods/champions/abilities.ts` has NO `magicbounce` key — grepped, not assumed — so mainline
 * governs (`data/abilities.ts`):
 *
 *     magicbounce.onTryHit(target, source, move) {
 *       const newMove = this.dex.getActiveMove(move.id);
 *       newMove.hasBounced = true;
 *       this.actions.useMove(newMove, target, { target: source });      <- a WHOLE move use
 *
 * `useMove` is not a re-aim. It runs `useMoveInner`, which calls
 * `pokemon.getMoveTargets(move, target)` (sim/battle-actions.ts:467) — and `getMoveTargets`'s
 * `default:` case runs `priorityEvent('RedirectTarget', ...)` before it returns anything
 * (sim/pokemon.ts:836). So the reflected move is aimed at the clicker, then REDIRECTED like any
 * other single-target move, and `if (selectedTarget !== target) this.battle.retargetLastMove(target)`
 * rewrites the `|move|` line it already printed (sim/pokemon.ts:845-847).
 *
 * The drawer is a FOE OF THE BOUNCER, which is the clicker's own partner — `followme`'s handler is
 * `onFoeRedirectTarget` and the bounced move's source is the bouncer.
 *
 * ================= WHAT WAS WRONG ==============================================================
 *
 * `bounceOff` in engine/medicham2-browser.js ended `return user;` — the clicker, always. No target
 * selection was re-run for the reflected move, so a Follow Me partner standing beside the clicker
 * never drew it and the drop landed on the clicker instead.
 *
 * ================= WHAT IT COST, MEASURED ======================================================
 *
 * Rows 5 and 10 of the 34 board partings in the held-out 12,000-game draw on release `18773c22878f`
 * (`data/verification/game-differential.g12000.json`) — the SAME shape twice, classified by the
 * instrument as `-unboost: a different body`:
 *
 *     showdown   |move|p1a: Hatterene|Fake Tears|p2b: Clefable|[from] ability: Magic Bounce
 *                |-unboost|p2b: Clefable|spd|2
 *     medicham2  |move|p1a: Hatterene|faketears|p2a: Whimsicott|[from] ability: Magic Bounce
 *                |-unboost|p2a: Whimsicott|spd|2
 *
 * Row 5 then pays for it on the next line: a Dazzling Gleam into the pair takes the -2 SpD body from
 * 95 to 21 there and the OTHER body from 38 to 1, breaking a Focus Sash this engine should never
 * have broken. **It is not a narration difference; it is which body is soft.**
 *
 * ================= THE ARMS ====================================================================
 *
 *   REAL      the clicker aims a reflectable stat drop at the bouncer while its own PARTNER holds
 *             the redirect. The drop must land on the PARTNER, in both engines, and the streams
 *             must not part.
 *   SILENT    the same board with the redirect click replaced by a self-move. The drop must land on
 *             the CLICKER — that is what says the bounce still works and the redirect was scoped.
 *   CONTROL   a child under MEDI_BOUNCE_IGNORES_REDIRECT=1. The drop must go back to the clicker in
 *             the REAL arm. **Identical results across a varied knob mean the knob is unwired.**
 *
 * ONE REASON PER CELL. The drop is read as a BOOST STAGE on two named bodies, not as damage, so
 * nothing else on the board can move it: neither body is hit, neither faints, and the move has no
 * secondary. The bouncer's own stage is printed too — a reflected move that failed to leave the
 * bouncer at all would otherwise read the same as one that reached the partner.
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
const KNOB_SET = process.env.MEDI_BOUNCE_IGNORES_REDIRECT === '1';
const CHILD = KNOB_SET && process.env.ABRA_PROBE_CONTROL_ARM === '1';
if (KNOB_SET && !CHILD) {
  console.log('');
  console.log('  MEDI_BOUNCE_IGNORES_REDIRECT=1 WAS SET FROM OUTSIDE THIS PROCESS.');
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

/* THE THREE POPULATIONS, PRINTED BEFORE ANYTHING IS WIRED TO THEM. */
const BOUNCE_AB = Object.keys(TAGS.abilities || {})
  .filter(k => (TAGS.abilities[k].tags || []).includes('reflectsStatusMoves'));
const REDIR_MOVES = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).includes('redirects'))
  .filter(k => dex.moves.get(k).exists && !dex.moves.get(k).isNonstandard);
/* THE CLICK IS A SINGLE-TARGET REFLECTABLE STAT DROP, read off the authority's own move record:
 * `flags.reflectable` is what magicbounce tests, `target: 'normal'` is what reaches the redirect's
 * `default:` case, and a negative `boosts` entry is what makes the landing readable as a stage. */
const DROPS = Object.keys(TAGS.moves || {}).map(k => dex.moves.get(k))
  .filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
    && m.flags.reflectable && m.target === 'normal'
    && m.boosts && Object.values(m.boosts).some(v => v < 0));
console.log('  abilities tagged reflectsStatusMoves : ' + (BOUNCE_AB.join(', ') || 'NONE'));
console.log('  moves tagged redirects               : ' + (REDIR_MOVES.join(', ') || 'NONE'));
console.log('  reflectable single-target stat drops : ' + (DROPS.map(m => m.id).join(', ') || 'NONE'));
if (!BOUNCE_AB.length || !REDIR_MOVES.length || !DROPS.length) {
  console.log('  A POPULATION IS EMPTY — a claim about the artifact, not about the engine.'); process.exit(2);
}

/* THE CLAIM IS CHECKED AGAINST THE AUTHORITY'S OWN TEXT: the bounce must be a `useMove` (which runs
 * target selection again) and not a re-aim. A regulation that turned it into a re-aim would make
 * this whole probe wrong, and this is what would say so. */
{
  const abs = require('fs').readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'abilities.ts'), 'utf8');
  const NL = String.fromCharCode(10) + String.fromCharCode(9);
  for (const id of BOUNCE_AB) {
    const i = abs.indexOf(NL + id + ': {');
    const block = i < 0 ? '' : abs.slice(i, abs.indexOf(NL + '},', i));
    const has = /this\.actions\.useMove\(newMove, target, \{ target: source \}\)/.test(block);
    console.log('    ' + id.padEnd(12) + (has ? 'reflects via useMove(newMove, bouncer, {target: clicker})'
      : 'DOES NOT REFLECT VIA useMove — this probe asserts something the authority does not say'));
    if (!has) bad++;
  }
}

/* Prefer a redirector with NO powder gate: Rage Powder is refused by a Grass type, Overcoat or
 * Safety Goggles, and a fixture that silently failed that check would test nothing. */
const REDIR = REDIR_MOVES.map(id => dex.moves.get(id))
  .sort((a, b) => (a.flags.powder ? 1 : 0) - (b.flags.powder ? 1 : 0))[0];

const SELF_HOLD = (s) => {
  const skip = new Set(['rest', 'sleeptalk', 'substitute', 'endure', 'wish', 'charge', 'doubleteam']);
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (skip.has(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge;
  }) || null;
};
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
/* NEITHER RECEIVING BODY MAY REFUSE OR REVERSE THE DROP. Clear Body, Mirror Armor, Contrary and the
 * ally-veils would each make "the stage did not move" mean something other than "the move went
 * elsewhere" — the two-reasons failure. Read off the artifact's tags, not named. */
const REFUSE = new Set(['refusesDrops', 'reversesBoosts', 'reflectsDrops', 'protectsAllyFromStatus',
  'refusesStatusMoves', 'allyRefusesStatus', 'reflectsStatusMoves', 'statusImmune', 'onSwitchInDrop']);
const okAbility = (s) => Object.values(s.abilities).find(ab => !abilityTags(ab).some(t => REFUSE.has(t)));

/* THE BOUNCER: a legal carrier of a reflectsStatusMoves ability. The ability is written onto it
 * explicitly, so the builder cannot hand the arm a different one. */
const BOUNCERS = POOL.filter(s => Object.values(s.abilities).some(a => BOUNCE_AB.includes(norm(a)))
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
if (!BOUNCERS.length) { console.log('  NO LEGAL MAGIC BOUNCE CARRIER — a claim about the format.'); process.exit(2); }
const BC = BOUNCERS[0];
const BC_AB = Object.values(BC.abilities).find(a => BOUNCE_AB.includes(norm(a)));

/* THE CLICKER AND ITS PARTNER: the clicker must learn the drop, the partner must learn the redirect,
 * and the drop must be readable on both. */
/* AND BOTH OF THEM MUST BE ABLE TO TAKE THE REFLECTED MOVE. The first staging picked Toxic Thread
 * into a POISON clicker and the silent control read `|-immune|p2a: Ariados` on the authority — the
 * bounce landed nowhere, so "the clicker's stage did not move" was true for a reason that has
 * nothing to do with redirection. A move carrying a STATUS is refused outright for the same reason
 * (a second immunity road), and the type chart is asked of both receiving bodies. */
const takesIt = (m, s) => dex.getImmunity(m.type, s);
let MV = null, CK = null, PT = null;
for (const m of DROPS) {
  if (m.status || m.volatileStatus) continue;
  const cks = POOL.filter(s => LEARNS(s, m.id) && okAbility(s) && s.name !== BC.name
    && takesIt(m, s) && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
  const pts = POOL.filter(s => LEARNS(s, REDIR.id) && okAbility(s) && s.name !== BC.name
    && takesIt(m, s) && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
  const ck = cks[0], pt = pts.find(s => s.name !== (ck && ck.name));
  if (ck && pt) { MV = m; CK = ck; PT = pt; break; }
}
if (!MV) { console.log('  COULD NOT STAGE — no drop with a legal clicker and a legal redirect partner.'); process.exit(2); }
const DROPPED = Object.keys(MV.boosts).find(k => MV.boosts[k] < 0);

const FILL = POOL.filter(s => ![BC.name, CK.name, PT.name].includes(s.name)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 5);
if (FILL.length < 5) { console.log('  NOT ENOUGH FILLER.'); process.exit(2); }

console.log('\n  chosen  : ' + CK.name + ' [' + okAbility(CK) + '] clicks ' + MV.id
  + ' (' + DROPPED + ' ' + MV.boosts[DROPPED] + ') AT ' + BC.name + ' [' + BC_AB + ']');
console.log('            its PARTNER ' + PT.name + ' [' + okAbility(PT) + '] clicks ' + REDIR.id
  + ' — a FOE of the bouncer, so it draws what the bouncer sends back');
console.log('            AUTHORITY : the reflected ' + MV.id + ' is a new useMove and is redirected — '
  + PT.name + ' takes the ' + DROPPED + ' drop');
console.log('            DEFECT    : `bounceOff` returned the clicker unconditionally — ' + CK.name + ' takes it');

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const sides = () => {
  const A = [
    mon(BC.name, [SELF_HOLD(BC)], '', BC_AB),
    mon(FILL[0].name, [SELF_HOLD(FILL[0])]),
    mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
    mon(FILL[2].name, [SELF_HOLD(FILL[2])]),
  ];
  const B = [
    mon(CK.name, [MV.name, SELF_HOLD(CK)], '', okAbility(CK)),
    mon(PT.name, [REDIR.name, SELF_HOLD(PT)], '', okAbility(PT)),
    mon(FILL[3].name, [SELF_HOLD(FILL[3])]),
    mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
  ];
  return [A, B];
};
const script = (withRedirect) => ([
  { p1: [{ m: norm(SELF_HOLD(BC)) }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(MV.id), t: 0 }, withRedirect ? { m: norm(REDIR.id) } : { m: norm(SELF_HOLD(PT)) }] },
  { p1: [{ m: norm(SELF_HOLD(BC)) }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(SELF_HOLD(CK)) }, { m: norm(SELF_HOLD(PT)) }] },
]);

const stage = (x) => (x && x.boosts ? x.boosts[DROPPED] : null);
const run = (withRedirect, tag) => {
  const [SA, SB] = sides();
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'bouncedmoveredirect/' + tag, {
    arm: G.ARM_BY_ID.get('middle'), script: script(withRedirect),
    onBoundary: (snap) => seen.push({
      meCk: stage(snap.medi.sides.p2.party[norm(CK.name)]), sdCk: stage(snap.sd.sides.p2.party[norm(CK.name)]),
      mePt: stage(snap.medi.sides.p2.party[norm(PT.name)]), sdPt: stage(snap.sd.sides.p2.party[norm(PT.name)]),
      meBc: stage(snap.medi.sides.p1.party[norm(BC.name)]), sdBc: stage(snap.sd.sides.p1.party[norm(BC.name)]),
    }),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (!seen.length) return { staged: false, why: 'no turn boundary was reached' };
  /* THE LAST BOUNDARY, NOT THE FIRST: `onBoundary` fires before turn 1 too, where every stage is 0
   * and every assertion about "who did NOT move" is trivially true. */
  return { staged: true, M: seen[seen.length - 1], div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

const show = (M) => {
  console.log('    the CLICKER   (' + CK.name + ')  me ' + String(M.meCk).padEnd(6) + ' sd ' + M.sdCk);
  console.log('    the PARTNER   (' + PT.name + ')  me ' + String(M.mePt).padEnd(6) + ' sd ' + M.sdPt);
  console.log('    the BOUNCER   (' + BC.name + ')  me ' + String(M.meBc).padEnd(6) + ' sd ' + M.sdBc
    + '   <- must be 0 in both: the move was sent BACK, not taken');
};

console.log('\n  === THE REAL ARM — the clicker\'s partner holds the redirect ===');
const REAL = run(true, CHILD ? 'control' : 'real');
if (!REAL.staged) { console.log('  NOT STAGED — ' + REAL.why); process.exit(1); }
show(REAL.M);
console.log('    first protocol divergence: ' + (REAL.div ? JSON.stringify(REAL.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — no redirect, so the bounce lands on the CLICKER ===');
const SIL = run(false, CHILD ? 'silent-control' : 'silent');
if (!SIL.staged) { console.log('  NOT STAGED — ' + SIL.why); process.exit(1); }
show(SIL.M);
console.log('    first protocol divergence: ' + (SIL.div ? JSON.stringify(SIL.div) : 'none — the streams agree'));

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_BOUNCE_IGNORES_REDIRECT=1) — this arm asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    meCk: REAL.M.meCk, mePt: REAL.M.mePt, div: !!REAL.div, divLine: REAL.div && REAL.div.sd,
    silentMeCk: SIL.M.meCk, silentMePt: SIL.M.mePt,
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
/* THE FIXTURE FIRST: the move must actually have been reflected, or nothing below is about a bounce. */
need('showdown: the BOUNCER took no drop (the fixture — it reflected rather than absorbed)', REAL.M.sdBc, 0);
need('showdown: the PARTNER took the drop (the authority — the bounce was redirected)', REAL.M.sdPt, MV.boosts[DROPPED]);
need('showdown: and the CLICKER did not', REAL.M.sdCk, 0);
need('medicham2: the partner took it too', REAL.M.mePt, REAL.M.sdPt);
need('medicham2: and the clicker did not', REAL.M.meCk, REAL.M.sdCk);
need('the streams do not part at all', REAL.div, null);
need('SILENT CONTROL: showdown puts the bounce on the CLICKER', SIL.M.sdCk, MV.boosts[DROPPED]);
need('SILENT CONTROL: ...and not on the partner', SIL.M.sdPt, 0);
need('SILENT CONTROL: medicham2 agrees on the clicker', SIL.M.meCk, SIL.M.sdCk);
need('SILENT CONTROL: medicham2 agrees on the partner', SIL.M.mePt, SIL.M.sdPt);

if (KNOB_SET) {
  console.log('');
  console.log('  --- the control child is SKIPPED: the knob is already set in this process, so a child');
  console.log('      of it would compare a control against a control and say the knob changed nothing ---');
} else {
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_BOUNCE_IGNORES_REDIRECT=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_BOUNCE_IGNORES_REDIRECT: '1', ABRA_PROBE_CONTROL_ARM: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.mePt !== REAL.M.mePt || ctl.meCk !== REAL.M.meCk;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES which body took the drop: default clicker '
      + REAL.M.meCk + ' / partner ' + REAL.M.mePt + '   vs control clicker ' + ctl.meCk + ' / partner ' + ctl.mePt);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.meCk !== MV.boosts[DROPPED]) {
      console.log('  RED    the control arm did NOT put the drop back on the clicker, so it is not the old behaviour.'); bad++;
    }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on the authority\'s line: ' + ctl.divLine);
    if (ctl.silentMeCk !== SIL.M.meCk || ctl.silentMePt !== SIL.M.mePt) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob. The knob reaches past the redirect.'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (clicker ' + ctl.silentMeCk + ')');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
