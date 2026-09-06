/* probe_smart_target_redirect.js — A MOVE-SOURCED REDIRECT TURNS `smartTarget` OFF, SO THE DARTS
 * STOP SPLITTING. THIS ENGINE KEPT SPLITTING THEM AND HIT A BODY THE AUTHORITY NEVER TOUCHED.
 *
 *   SHOWDOWN_PATH=... node tests/probe_smart_target_redirect.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `cfe46f67bf1f`
 * (`data/game-differential.json`, 961 games, census `census-pin-9446a684709d`, pool
 * `data/team-pool-frozen`), one board-material game, `any`-bucket verdict SHARED COINS:
 *
 *     extra event emitted by medicham2 :: |-enditem|p1b|sitrusberry|[eat] <> |-damage|p1a|H/H
 *
 *     showdown   |move|p2b: Dragapult|Dragon Darts|p1b: Volcarona     (Rage Powder is up on Volcarona)
 *                |-damage|p1b: Volcarona|65/160
 *                |-enditem|p1b: Volcarona|Sitrus Berry|[eat]
 *                |-heal|p1b: Volcarona|105/160|[from] item: Sitrus Berry
 *                |-damage|p1b: Volcarona|31/160                       <- the SECOND dart, same body
 *     medicham2  |-damage|p1b: Volcarona|65/160
 *                |-damage|p1a: Rotom|1/125                            <- the second dart, WRONG BODY
 *
 * Rotom-Wash went from 56/125 to 1/125 in this engine and was never touched in the authority. That is
 * an `active[].hp` leaf, and it decided the rest of the game.
 *
 * THE RULE, READ OFF THE SOURCE. `Pokemon#getMoveTargets` (sim/pokemon.ts:826-840) runs the redirect
 * event FIRST and calls `getSmartTargets` SECOND:
 *
 *     target = this.battle.priorityEvent('RedirectTarget', this, this, move, target);   :836
 *     if (move.smartTarget) { targets = this.getSmartTargets(target, move); ... }        :838
 *
 * so the engine's existing comment — *"PLACED AFTER REDIRECTION ON PURPOSE ... the partner is the
 * partner of whoever the darts ended up aimed at"* — is half of the rule and the missing half is the
 * whole defect. EVERY redirector clears the flag on its way past:
 *
 *     followme.condition.onFoeRedirectTarget    if (move.smartTarget) move.smartTarget = false;
 *                                                                          data/moves.ts:6065
 *     ragepowder.condition.onFoeRedirectTarget  if (move.smartTarget) move.smartTarget = false;
 *                                                                          data/moves.ts:14617
 *     lightningrod.onAnyRedirectTarget          if (move.smartTarget) move.smartTarget = false;
 *                                                                      data/abilities.ts:2346
 *     stormdrain.onAnyRedirectTarget            if (move.smartTarget) move.smartTarget = false;
 *                                                                      data/abilities.ts:4641
 *
 * THE FIRST VERSION OF THIS FILE ASSERTED THE OPPOSITE FOR THE ABILITIES — "move clears it, ability
 * does not" — and its own source check went RED on the first run and said so. That check is the only
 * reason the wrong rule did not reach the engine, and it is why the derivation is READ out of the
 * authority's text on every run instead of being written down here once. Champions overrides none of
 * the four (grepped, not recalled).
 *
 * A THIRD SITE IS NAMED AND NOT COVERED: `wonderguard.onTryHit` (data/abilities.ts:5551) clears the
 * flag too, on an immunity, and suppresses its own `-immune` line when it does. Wonder Guard has no
 * legal carrier this probe stages and the case is a different one (an immunity, not a redirect), so
 * it is stated rather than folded in.
 *
 * THE ARMS:
 *   REAL      the redirector is up. Both darts must land on IT and its partner must be untouched.
 *   CONTROL   the same board under `MEDI_SMART_TARGET_SURVIVES_REDIRECT=1`. The partner must take a
 *             dart — an identical result across a varied knob means the knob is unwired.
 *   SILENT    the same board with the redirect click replaced by a self-move. The darts MUST STILL
 *             SPLIT, in both engines and under both knob settings. That is what says this scoped the
 *             flag to the redirect and did not delete Dragon Darts' whole mechanic.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_SMART_TARGET_SURVIVES_REDIRECT === '1';
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

/* ---- THE TWO POPULATIONS, PRINTED BEFORE ANYTHING IS WIRED TO THEM. A new derived membership
 * over-matches; this repository has paid for that twice. */
const SMART = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('smartTarget'))
  .map(([k, v]) => ({ id: k, uses: v.uses || 0 }))
  .filter(x => dex.moves.get(x.id).exists && !dex.moves.get(x.id).isNonstandard);
const REDIR_MOVES = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('redirects'))
  .map(([k, v]) => ({ id: k, uses: v.uses || 0 }))
  .filter(x => dex.moves.get(x.id).exists && !dex.moves.get(x.id).isNonstandard);
const REDIR_ABILS = Object.entries(TAGS.abilities || {})
  .filter(([, v]) => (v.tags || []).includes('redirectsType'))
  .map(([k]) => k);
console.log('  moves tagged smartTarget            : ' + (SMART.map(x => x.id + ' (' + x.uses + ')').join(', ') || 'NONE'));
console.log('  moves tagged redirects              : ' + (REDIR_MOVES.map(x => x.id + ' (' + x.uses + ')').join(', ') || 'NONE'));
console.log('  abilities tagged redirectsType      : ' + (REDIR_ABILS.join(', ') || 'NONE')
  + '   <- these clear the flag too; the check below reads that out of the authority');
if (!SMART.length || !REDIR_MOVES.length) { console.log('  ONE OF THE TWO POPULATIONS IS EMPTY — a claim about the artifact.'); process.exit(2); }

/* THE CLAIM ABOVE IS CHECKED AGAINST THE AUTHORITY'S OWN TEXT rather than trusted: every move-sourced
 * redirector must carry the clear, and no redirect ABILITY may. A regulation that changed either
 * would make the wire below wrong, and this is what would say so. */
{
  const src = require('fs').readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'moves.ts'), 'utf8');
  const abs = require('fs').readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'abilities.ts'), 'utf8');
  /* A TOP-LEVEL ENTRY IN EITHER FILE OPENS AT A NEWLINE FOLLOWED BY ONE TAB, and it is held in a
   * named constant rather than written inline four times because an editor that eats the escape
   * turns the literal into an unterminated string, which is a syntax error rather than a wrong
   * answer — but only after it has cost a run. */
  const NL = String.fromCharCode(10) + String.fromCharCode(9);
  let miss = 0;
  for (const r of REDIR_MOVES) {
    const i = src.indexOf(NL + r.id + ': {');
    const block = i < 0 ? '' : src.slice(i, src.indexOf(NL + '},', i));
    const has = /if \(move\.smartTarget\) move\.smartTarget = false;/.test(block);
    console.log('    ' + r.id.padEnd(12) + (has ? 'clears move.smartTarget  (data/moves.ts)' : 'DOES NOT CLEAR IT'));
    if (!has) miss++;
  }
  for (const id of REDIR_ABILS) {
    const i = abs.indexOf(NL + id + ': {');
    const block = i < 0 ? '' : abs.slice(i, abs.indexOf(NL + '},', i));
    const has = /if \(move\.smartTarget\) move\.smartTarget = false;/.test(block);
    console.log('    ' + id.padEnd(12) + (has ? 'clears move.smartTarget  (data/abilities.ts)' : 'DOES NOT CLEAR IT'));
    if (!has) miss++;
  }
  if (miss) { console.log('  RED — the authority does not say what this probe is about to assert.'); bad++; }
}

const MV = dex.moves.get(SMART.sort((a, b) => b.uses - a.uses)[0].id);
const USERS = POOL.filter(s => LEARNS(s, MV.id) && !G.CLOSET_SPECIES.has(norm(s.id)));
if (!USERS.length) { console.log('  NO LEGAL CARRIER OF ' + MV.id + ' — a claim about the format.'); process.exit(2); }

/* THE REDIRECTOR. Prefer one with NO powder gate — Rage Powder is refused by a Grass type, Overcoat
 * or Safety Goggles, and a fixture that silently fails that check would test nothing. Read off the
 * move's own flags rather than named. */
const REDIR = REDIR_MOVES.map(r => dex.moves.get(r.id))
  .sort((a, b) => (a.flags.powder ? 1 : 0) - (b.flags.powder ? 1 : 0))[0];
console.log('  the redirect click                  : ' + REDIR.id + '  (powder flag: '
  + (REDIR.flags.powder ? 'YES — the target side must not resist it' : 'no') + ', priority ' + REDIR.priority + ')');

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

/* THE TWO BODIES ON THE RECEIVING SIDE: one clicks the redirect, the other is the AIMED body and must
 * be able to survive one dart and take zero in the real arm. Both must be hit NEUTRALLY or better by
 * the smart move (a type immunity would hide the whole question) and neither may carry an ability
 * that touches the incoming hit. */
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
const REFUSE = new Set(['onSwitchInDrop', 'damageReduce', 'survivesFromFull', 'absorbsMoveType',
  'immuneToMoveClass', 'punishesContact', 'noRecoil', 'formeAbsorbsHit', 'halvesTypeDamage',
  'redirectsType', 'typeImmunity']);
const okAbility = (s) => Object.values(s.abilities).find(ab => !abilityTags(ab).some(t => REFUSE.has(t)));
const takesIt = (s) => dex.getImmunity(MV.type, s) && dex.getEffectiveness(MV.type, s) >= 0;

const REDIRECTORS = POOL.filter(s => LEARNS(s, REDIR.id) && takesIt(s) && okAbility(s)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
if (!REDIRECTORS.length) { console.log('  NO LEGAL BODY CAN CLICK THE REDIRECT AND TAKE THE MOVE — a claim about the fixture.'); process.exit(2); }
const RD = REDIRECTORS[0];
const AIMEDS = POOL.filter(s => s.name !== RD.name && takesIt(s) && okAbility(s)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
if (!AIMEDS.length) { console.log('  NO LEGAL AIMED BODY — a claim about the fixture.'); process.exit(2); }
const AIM = AIMEDS[0];
const U = USERS.find(s => s.name !== RD.name && s.name !== AIM.name) || USERS[0];
const U_AB = okAbility(U) || Object.values(U.abilities)[0];

const FILL = POOL.filter(s => ![U.name, RD.name, AIM.name].includes(s.name)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 5);
if (FILL.length < 5) { console.log('  NOT ENOUGH FILLER — a claim about the fixture.'); process.exit(2); }

console.log('\n  chosen  : ' + U.name + ' [' + U_AB + '] clicks ' + MV.id + ' (' + MV.basePower
  + ' BP x' + MV.multihit + ') AIMED AT ' + AIM.name + ' [' + okAbility(AIM) + ']');
console.log('            ' + RD.name + ' [' + okAbility(RD) + '] clicks ' + REDIR.id + ' and draws it');
console.log('            AUTHORITY : the redirect clears smartTarget, so BOTH darts land on ' + RD.name
  + ' and ' + AIM.name + ' takes ZERO');
console.log('            DEFECT    : the split survives the redirect, so ' + AIM.name + ' takes one dart');

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const sides = () => {
  const A = [
    mon(U.name, [MV.name, SELF_HOLD(U) || 'Protect'], '', U_AB),
    mon(FILL[0].name, [SELF_HOLD(FILL[0])]),
    mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
    mon(FILL[2].name, [SELF_HOLD(FILL[2])]),
  ];
  const B = [
    mon(AIM.name, [SELF_HOLD(AIM)], '', okAbility(AIM)),
    mon(RD.name, [REDIR.name, SELF_HOLD(RD)], '', okAbility(RD)),
    mon(FILL[3].name, [SELF_HOLD(FILL[3])]),
    mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
  ];
  return [A, B];
};
const script = (withRedirect) => ([
  { p1: [{ m: norm(MV.id), t: 0 }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(SELF_HOLD(AIM)) }, withRedirect ? { m: norm(REDIR.id) } : { m: norm(SELF_HOLD(RD)) }] },
  { p1: [{ m: norm(SELF_HOLD(U) || 'protect') }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(SELF_HOLD(AIM)) }, { m: norm(SELF_HOLD(RD)) }] },
]);

const run = (withRedirect, tag) => {
  const [SA, SB] = sides();
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'smarttargetredirect/' + tag, {
    arm: G.ARM_BY_ID.get('middle'), script: script(withRedirect),
    onBoundary: (snap) => seen.push({
      meAim: snap.medi.sides.p2.party[norm(AIM.name)] || null,
      sdAim: snap.sd.sides.p2.party[norm(AIM.name)] || null,
      meRd: snap.medi.sides.p2.party[norm(RD.name)] || null,
      sdRd: snap.sd.sides.p2.party[norm(RD.name)] || null,
    }),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (!seen.length) return { staged: false, why: 'no turn boundary was reached' };
  /* THE LAST BOUNDARY, NOT THE FIRST. `onBoundary` fires before turn 1 as well as after it, so
   * `seen[0]` is the board BEFORE anything was clicked — every body at full HP, every assertion
   * trivially "untouched", and the whole probe green on a turn it never played. Caught on the first
   * run by the fixture assertion, which is what that assertion is for. */
  return { staged: true, r, M: seen[seen.length - 1], boundaries: seen.length,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

const show = (M) => {
  const f = x => x ? (String(x.hp) + '/' + x.maxhp + (x.hp === x.maxhp ? '  UNTOUCHED' : '')) : '(NO ROW)';
  console.log('    the AIMED body    me ' + f(M.meAim).padEnd(28) + ' sd ' + f(M.sdAim));
  console.log('    the REDIRECTOR    me ' + f(M.meRd).padEnd(28) + ' sd ' + f(M.sdRd));
};

console.log('\n  === THE REAL ARM — the redirect is up ===');
const REAL = run(true, CHILD ? 'control' : 'real');
if (!REAL.staged) { console.log('  NOT STAGED — ' + REAL.why); process.exit(1); }
show(REAL.M);
console.log('    first protocol divergence: ' + (REAL.div ? JSON.stringify(REAL.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — no redirect, so the darts MUST still split ===');
const SIL = run(false, CHILD ? 'silent-control' : 'silent');
if (!SIL.staged) { console.log('  NOT STAGED — ' + SIL.why); process.exit(1); }
show(SIL.M);
console.log('    first protocol divergence: ' + (SIL.div ? JSON.stringify(SIL.div) : 'none — the streams agree'));

const untouched = x => !!(x && x.hp === x.maxhp);
if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_SMART_TARGET_SURVIVES_REDIRECT=1) — this arm asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    meAim: REAL.M.meAim && REAL.M.meAim.hp, sdAim: REAL.M.sdAim && REAL.M.sdAim.hp,
    aimUntouched: untouched(REAL.M.meAim), div: !!REAL.div, divLine: REAL.div && REAL.div.sd,
    silentMeAim: SIL.M.meAim && SIL.M.meAim.hp, silentAimUntouched: untouched(SIL.M.meAim),
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
/* THE FIXTURE FIRST: the darts must have gone somewhere at all. */
need('the redirector was hit at all (the fixture — otherwise nothing was aimed anywhere)',
  !!(REAL.M.sdRd && REAL.M.sdRd.hp < REAL.M.sdRd.maxhp), true);
need('showdown: the AIMED body is untouched (the authority — both darts went to the redirector)',
  untouched(REAL.M.sdAim), true);
need('medicham2: the aimed body is untouched too', untouched(REAL.M.meAim), true);
need('the two engines agree on the redirector\'s HP', REAL.M.meRd && REAL.M.meRd.hp, REAL.M.sdRd && REAL.M.sdRd.hp);
need('the streams do not part at all', REAL.div, null);
/* AND THE MECHANIC MUST STILL WORK: with no redirect the darts still split across the two bodies. */
need('SILENT CONTROL: showdown STILL splits the darts (the aimed body is hit)', untouched(SIL.M.sdAim), false);
need('SILENT CONTROL: and its partner is hit too', !!(SIL.M.sdRd && SIL.M.sdRd.hp < SIL.M.sdRd.maxhp), true);
need('SILENT CONTROL: medicham2 splits them the same way', SIL.M.meAim && SIL.M.meAim.hp, SIL.M.sdAim && SIL.M.sdAim.hp);
need('SILENT CONTROL: ...on both bodies', SIL.M.meRd && SIL.M.meRd.hp, SIL.M.sdRd && SIL.M.sdRd.hp);

{
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_SMART_TARGET_SURVIVES_REDIRECT=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_SMART_TARGET_SURVIVES_REDIRECT: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.meAim !== (REAL.M.meAim && REAL.M.meAim.hp);
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the aimed body\'s HP: default '
      + (REAL.M.meAim && REAL.M.meAim.hp) + '  vs control ' + ctl.meAim);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.aimUntouched) { console.log('  RED    the control arm did NOT hit the aimed body, so it is not the old behaviour.'); bad++; }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on the authority\'s line: ' + ctl.divLine);
    if (ctl.silentMeAim !== (SIL.M.meAim && SIL.M.meAim.hp)) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob (' + (SIL.M.meAim && SIL.M.meAim.hp)
        + ' -> ' + ctl.silentMeAim + '). The knob reaches past the redirect.'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (' + ctl.silentMeAim + ')');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
