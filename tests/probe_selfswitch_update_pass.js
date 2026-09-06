/* probe_selfswitch_update_pass.js — A MOVE THAT PAYS ITS OWN HP AND THEN LEAVES THE FIELD MUST
 * SETTLE ITS `Update` HANDLERS FIRST. THIS ENGINE CARRIED THE BERRY OFF THE FIELD.
 *
 *   SHOWDOWN_PATH=... node tests/probe_selfswitch_update_pass.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `57778abd6073`
 * (`data/verification/longtail-E-pickpocket.json`, 961 games, census `census-pin-9446a684709d`, pool
 * `data/team-pool-frozen`), one board-material game, `any`-bucket verdict SHARED COINS:
 *
 *     event missing from medicham2 :: |-enditem|p2a|sitrusberry|[eat] <> |switch|p2a|clefable,l50|H/H
 *
 *     showdown   |-start|p2a: Orthworm|Substitute|[from] move: shedtail
 *                |-damage|p2a: Orthworm|72/145
 *                |-enditem|p2a: Orthworm|Sitrus Berry|[eat]
 *                |-heal|p2a: Orthworm|108/145|[from] item: Sitrus Berry
 *                |switch|p2a: Clefable|Clefable, L50|170/170|[from] Shed Tail
 *     medicham2  |-start|p2a: Orthworm|Substitute|[from] move: shedtail
 *                |-damage|p2a: Orthworm|72/145
 *                |switch|p2a: Clefable|clefable, L50|170/170|[from] shedtail
 *
 * Orthworm went to the bench on 72/145 still holding a berry the authority had eaten. That is a party
 * HP leaf AND a party item leaf, on a body that will come back later.
 *
 * THE RULE. `Battle#eachEvent('Update')` is raised INSIDE the hit loop
 * (data/mods/champions/scripts.ts:538, mainline sim/battle-actions.ts:967) for every move that
 * connects, STATUS MOVES INCLUDED — a status move's `spreadMoveHit` returns `true`, which becomes
 * `damage[i] = 0`, so the loop does not break above the pass. Shed Tail's HP is paid inside that same
 * call: `moveHit` applies `volatileStatus` and then `onHit`, and `onHit` is
 * `this.directDamage(Math.ceil(source.maxhp / 2))`. The SWITCH happens later still, in `useMove`,
 * after `useMoveInner` has returned. So the authority's order is cost, Update, leave.
 *
 * medicham2's `_stepUpdate` lives in the DAMAGING step list, and its own header says so: *"STATUS
 * moves do not reach this step list at all, so their Update still waits for the between-action
 * pass."* That is harmless everywhere except here — the between-action pass runs at the top of the
 * NEXT action, by which time this body is on the bench and out of `actA`/`actB` entirely.
 *
 * THE FIXTURE NEEDS NO SEARCH AT ALL, AND THAT IS DERIVED RATHER THAN LUCKY. The move's cost is
 * `ceil(maxhp/2)` and its own failure clause is `hp <= ceil(maxhp/2)`, so a user at FULL HP always
 * lands on `floor(maxhp/2)` — at or below the pinch line for every body in the regulation. One turn,
 * one click, no roll, no accuracy die.
 *
 * THE ARMS:
 *   REAL      the user holds the pinch berry. Both engines must put the same HP and the same hand on
 *             the bench.
 *   CONTROL   the same board under `MEDI_NO_SELFSWITCH_UPDATE=1`. The user must leave UNHEALED and
 *             still holding it — an identical result across a varied knob means the knob is unwired.
 *   SILENT    the same board with no item. The cost is identical and nothing can be settled, so this
 *             arm must not move under the knob.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_NO_SELFSWITCH_UPDATE === '1';
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

/* ---- THE MOVE IS THE TAGS', NOT A NAME: it must LEAVE THE FIELD and PAY ITS OWN HP. */
const CANDIDATES = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('costsUserHP')
    && ((v.tags || []).includes('passesState') || (v.tags || []).includes('pivotStatus')))
  .map(([k, v]) => ({ id: k, cost: v.params.costsUserHP, uses: v.uses || 0 }))
  .filter(x => dex.moves.get(x.id).exists && !dex.moves.get(x.id).isNonstandard);
console.log('  moves that PAY THEIR OWN HP and LEAVE THE FIELD:');
for (const c of CANDIDATES) console.log('      ' + c.id.padEnd(12) + ' ' + JSON.stringify(c.cost)
  + '  (' + c.uses + ' sheets)');
if (!CANDIDATES.length) { console.log('  NONE IN THIS FORMAT — a claim about the artifact, not about the engine.'); process.exit(2); }
const MV = CANDIDATES.sort((a, b) => b.uses - a.uses)[0];
const MOVE = dex.moves.get(MV.id);

/* ---- THE PINCH ITEM, off its own tag. */
const PINCH = Object.entries(TAGS.items || {})
  .filter(([, v]) => (v.tags || []).includes('healsAtThreshold'))
  .map(([k, v]) => ({ id: k, p: v.params.healsAtThreshold, uses: v.uses || 0 }))
  .filter(x => dex.items.get(x.id).exists && !dex.items.get(x.id).isNonstandard)
  .sort((a, b) => b.uses - a.uses);
if (!PINCH.length) { console.log('  NO PINCH-HEAL ITEM — a claim about the artifact.'); process.exit(2); }
const BERRY = PINCH[0], BERRY_ITEM = dex.items.get(BERRY.id);

const USERS = POOL.filter(s => LEARNS(s, MV.id) && !G.CLOSET_SPECIES.has(norm(s.id)));
console.log('  legal carriers of ' + MV.id + ': ' + (USERS.map(s => s.name).join(', ') || 'NONE'));
if (!USERS.length) { console.log('  NO LEGAL CARRIER — a claim about the format.'); process.exit(2); }

let BUILD_FAILS = 0;
const FILLER0 = POOL.filter(s => LEARNS(s, 'protect')).slice(0, 3);
const buildHP = (s) => {
  try {
    const p = G.buildPair([{ species: s.name, item: '', ability: '', moves: ['Protect'] },
      ...FILLER0.filter(f => f.name !== s.name).slice(0, 3)
        .map(f => ({ species: f.name, item: '', ability: '', moves: ['Protect'] }))]);
    return p ? p[0].medi.st.hp : null;
  } catch (e) {
    /* A BUILD FAILURE IS NOT AN ABSENT CARRIER. Returning null silently would drop the species
     * from the row set and shrink the denominator without saying so, which is the shape this
     * repo's silent-catch gate exists to stop. */
    console.error('  BUILD FAILED for ' + s.name + ': ' + e.message);
    BUILD_FAILS++;
    return null;
  }
};

/* THE ROUNDING IS THE ARTIFACT'S, DERIVED FROM THE HANDLER (`directDamage(Math.ceil(maxhp/2))`),
 * NOT A SHARED FLOOR — the same distinction the engine's own cost block makes for Substitute. */
const RND = (MV.cost && MV.cost.rounds === 'ceil') ? Math.ceil : Math.floor;
const FRAC = +((MV.cost && MV.cost.costsFraction) || 0.5);
const rows = [];
for (const s of USERS) {
  const H = buildHP(s); if (!H) continue;
  const cost = RND(H * FRAC), after = H - cost;
  if (!(after > 0)) continue;                       // it has to survive to reach the bench
  if (!(after <= H * (+BERRY.p.triggersBelow.split('/')[0] / +BERRY.p.triggersBelow.split('/')[1])))
    continue;                                       // ...and the cost must cross the pinch line
  rows.push({ s, H, cost, after, heal: Math.trunc(H / 4) });
}
if (!rows.length) { console.log('  NO CARRIER WHOSE COST CROSSES THE PINCH LINE — a claim about the fixture.'); process.exit(2); }
const F = rows.sort((a, b) => (a.H * (1 / 2) - a.after) - (b.H * (1 / 2) - b.after) || a.s.name.localeCompare(b.s.name))[0];
const U_AB = Object.values(F.s.abilities)[0];

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
const FILL = POOL.filter(s => s.name !== F.s.name && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 7);
if (FILL.length < 7) { console.log('  NOT ENOUGH FILLER — a claim about the fixture.'); process.exit(2); }

console.log('\n  chosen  : ' + F.s.name + ' [' + U_AB + '] holding ' + BERRY_ITEM.name + ' clicks ' + MV.id);
console.log('            built max HP ' + F.H + ';  the cost is ' + (MV.cost.rounds || 'trunc') + '('
  + F.H + ' x ' + FRAC + ') = ' + F.cost + '  ->  it leaves the field on ' + F.after);
console.log('            the pinch line is ' + BERRY.p.triggersBelow + ' of ' + F.H + ' = ' + (F.H / 2)
  + ', so the cost ALWAYS crosses it from full HP — no roll, no accuracy die');
console.log('            the AUTHORITY settles the berry at scripts.ts:538 and only then leaves:  '
  + F.after + ' + ' + F.heal + ' = ' + (F.after + F.heal) + ' on the bench, hand empty');
console.log('            the DEFECT carries it off the field:  ' + F.after + ' on the bench, still holding ' + BERRY.id);

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const sides = (withBerry) => {
  const A = [
    mon(F.s.name, [MOVE.name, SELF_HOLD(F.s) || 'Protect'], withBerry ? BERRY_ITEM.name : '', U_AB),
    mon(FILL[0].name, [SELF_HOLD(FILL[0])]),
    mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
    mon(FILL[2].name, [SELF_HOLD(FILL[2])]),
  ];
  const B = [
    mon(FILL[3].name, [SELF_HOLD(FILL[3])]),
    mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
    mon(FILL[5].name, [SELF_HOLD(FILL[5])]),
    mon(FILL[6].name, [SELF_HOLD(FILL[6])]),
  ];
  return [A, B];
};
const SCRIPT = [
  { p1: [{ m: norm(MV.id) }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(SELF_HOLD(FILL[3])) }, { m: norm(SELF_HOLD(FILL[4])) }] },
  { p1: [{ m: norm(SELF_HOLD(FILL[1])) }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(SELF_HOLD(FILL[3])) }, { m: norm(SELF_HOLD(FILL[4])) }] },
];

const run = (withBerry, tag) => {
  const [SA, SB] = sides(withBerry);
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'selfswitchupdate/' + tag, {
    arm: G.ARM_BY_ID.get('middle'), script: SCRIPT,
    onBoundary: (snap) => seen.push({
      me: snap.medi.sides.p1.party[norm(F.s.name)] || null,
      sd: snap.sd.sides.p1.party[norm(F.s.name)] || null,
    }),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (!seen.length) return { staged: false, why: 'no turn boundary was reached' };
  return { staged: true, r, M: seen[seen.length - 1], boundaries: seen.length,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

const show = (M) => {
  const f = x => x ? (String(x.hp) + '/' + x.maxhp + '  item=' + JSON.stringify(x.item)) : '(NO ROW)';
  console.log('    the pivoted body   me ' + f(M.me).padEnd(34) + ' sd ' + f(M.sd));
};

console.log('\n  === THE REAL ARM — the user holds the berry ===');
const REAL = run(true, CHILD ? 'control' : 'real');
if (!REAL.staged) { console.log('  NOT STAGED — ' + REAL.why); process.exit(1); }
show(REAL.M);
console.log('    first protocol divergence: ' + (REAL.div ? JSON.stringify(REAL.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — no item, so nothing can be settled either way ===');
const SIL = run(false, CHILD ? 'silent-control' : 'silent');
if (!SIL.staged) { console.log('  NOT STAGED — ' + SIL.why); process.exit(1); }
show(SIL.M);

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_NO_SELFSWITCH_UPDATE=1) — this arm asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    meHp: REAL.M.me && REAL.M.me.hp, meItem: REAL.M.me && REAL.M.me.item,
    sdHp: REAL.M.sd && REAL.M.sd.hp, div: !!REAL.div, divLine: REAL.div && REAL.div.sd,
    silentMeHp: SIL.M.me && SIL.M.me.hp, silentMeItem: SIL.M.me && SIL.M.me.item,
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
/* THE FIXTURE, then the AUTHORITY as a control on the derived arithmetic, then the engine. */
need('the move really was paid: the SILENT arm left the body under its own max HP',
  !!(SIL.M.sd && SIL.M.sd.hp === F.after), true);
need('showdown: the body reached the bench on cost-then-heal (the authority — a control on the arithmetic)',
  REAL.M.sd && REAL.M.sd.hp, F.after + F.heal);
need('showdown: with an empty hand', REAL.M.sd && REAL.M.sd.item, '');
need('medicham2: the same HP', REAL.M.me && REAL.M.me.hp, F.after + F.heal);
need('medicham2: the same empty hand', REAL.M.me && REAL.M.me.item, '');
need('the streams do not part at all', REAL.div, null);
need('SILENT CONTROL: with no item both engines leave on the bare cost', SIL.M.me && SIL.M.me.hp, F.after);
need('SILENT CONTROL: and they agree', SIL.M.me && SIL.M.me.hp, SIL.M.sd && SIL.M.sd.hp);

{
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_NO_SELFSWITCH_UPDATE=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_NO_SELFSWITCH_UPDATE: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.meHp !== (REAL.M.me && REAL.M.me.hp);
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the HP that reaches the bench: default '
      + (REAL.M.me && REAL.M.me.hp) + '  vs control ' + ctl.meHp);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.meHp !== F.after || ctl.meItem !== BERRY.id) {
      console.log('  RED    the control arm did not carry the berry off unspent (' + ctl.meHp + '/'
        + JSON.stringify(ctl.meItem) + '), so it is not the old behaviour.'); bad++;
    }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on the authority\'s line: ' + ctl.divLine);
    if (ctl.silentMeHp !== (SIL.M.me && SIL.M.me.hp) || ctl.silentMeItem !== (SIL.M.me && SIL.M.me.item)) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob. The knob reaches further than the pass.'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (' + ctl.silentMeHp + ')');
  }
}

/* A COUNTER NOTHING READS IS NOT A COUNTER. */
if (BUILD_FAILS) { console.log('  RED    ' + BUILD_FAILS + ' species could not be BUILT, so the row set is short by that many and the denominator is not what it claims.'); bad++; }
else console.log('  green  every legal carrier built (0 build failures)');
console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
