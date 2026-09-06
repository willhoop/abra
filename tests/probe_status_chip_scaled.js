/* probe_status_chip_scaled.js — AN ABILITY MAY *SCALE* A STATUS CHIP, NOT ONLY REFUSE IT OR CONVERT
 * IT, AND THIS ENGINE KNEW ONLY THE OTHER TWO. HEATPROOF'S BURN IS HALF SIZE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_status_chip_scaled.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `14b62cd5aeec`
 * (`data/game-differential.json`, 961 games, census `census-pin-9446a684709d`, pool
 * `data/team-pool-frozen`), one board-material game, `any`-bucket verdict SHARED COINS:
 *
 *   -damage field 3 :: |-damage|p2b|H/Hbrn|[from]brn <> |-damage|p2b|H/Hbrn|[from]brn
 *       [values differ: |-damage|p2b: Sinistcha|142/146 brn vs |-damage|p2b: Sinistcha|137/146 brn]
 *
 * 146 - 137 = 9 is `floor(146/16)`, the plain burn. 146 - 142 = 4 is that number halved. Sinistcha's
 * hidden ability is Heatproof, DERIVED off the species row rather than recalled.
 *
 * THE RULE, READ OFF THE AUTHORITY.
 *
 *     heatproof.onDamage(damage, target, source, effect) {
 *       if (effect && effect.id === 'brn') { return damage / 2; }        data/abilities.ts:1838-1841
 *     }
 *
 * and the burn itself is `this.damage(pokemon.baseMaxhp / 16)` at `onResidualOrder: 10`
 * (data/conditions.ts:15-18 — Champions does not override the `brn` condition). `Battle#damage` goes
 * through `spreadDamage`, which clamps with `clampIntRange(targetDamage, 1)` on BOTH sides of the
 * `Damage` event, so the arithmetic is
 *
 *     max(1, floor(maxhp/16))                 -> the chip
 *     max(1, floor(that * mult))              -> the chip a scaler leaves behind
 *
 * — 9 then 4 on a 146-HP body, which is exactly the pair the differential reported.
 *
 * IT IS A THIRD TAG, NOT A PARAM ON AN EXISTING ONE. `refusesIndirectDamage` (Magic Guard) refuses a
 * CLASS and `healsFromOwnStatus` (Poison Heal) CONVERTS one status into a heal. Folding a multiplier
 * into either would make a consumer read one field to choose between three opposite behaviours. The
 * membership was printed before anything was wired and is ONE: heatproof, `brn`, x0.5 — the eleven
 * legal abilities carrying an `onDamage` at all were listed, the two that `return false` are the two
 * tags above, the four that answer a MOVE name no status, and Rock Head answers `recoil`.
 *
 * THE FIXTURE IS TWO TURNS AND CARRIES ONE DIE. Flame Orb, the deterministic way to burn a body, is
 * `isNonstandard: 'Past'` in Champions — DERIVED, not assumed — so the burn has to come from
 * Will-O-Wisp at 85 accuracy. The arm is re-seeded until the burn lands and the number of attempts
 * is printed; a run that never lands it says NOT STAGED rather than passing.
 *
 * THE ARMS:
 *   SCALED    the body carries the scaling ability. Both engines must take the HALVED chip.
 *   CONTROL   the SAME body with an ability that does not scale anything. Both engines must take the
 *             FULL chip — that is what says the fixture is the ability and not the body, and it is a
 *             knob-cleared control in the strict sense: the varied thing is the ability itself.
 *   KNOB      the SCALED arm again under `MEDI_STATUS_CHIP_UNSCALED=1`. It must PART from the
 *             authority; an identical result across a varied knob means the knob is unwired.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_STATUS_CHIP_UNSCALED === '1';
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

/* ---- THE ABILITY IS THE TAG'S. */
const SCALERS = Object.entries(TAGS.abilities || {})
  .filter(([, v]) => (v.tags || []).includes('scalesOwnStatusDamage'))
  .map(([k, v]) => ({ id: k, p: v.params.scalesOwnStatusDamage, uses: v.uses || 0 }));
console.log('  abilities tagged `scalesOwnStatusDamage`:');
for (const a of SCALERS) console.log('      ' + a.id.padEnd(14) + JSON.stringify(a.p) + '  (' + a.uses + ' sheets)');
if (!SCALERS.length) { console.log('  NONE — a claim about the artifact, not about the engine.'); process.exit(2); }
const AB = SCALERS.sort((a, b) => b.uses - a.uses)[0];
const STATUS = AB.p.statuses[0];
const MULT = +AB.p.mult;

/* ---- THE STATUS'S OWN CHIP, off the authority's condition rather than a number typed here. */
const CHIP_DIV = { brn: 16, psn: 8 }[STATUS];
if (!CHIP_DIV) { console.log('  THIS PROBE ONLY KNOWS THE FLAT CHIPS (brn 1/16, psn 1/8); the tag names `'
  + STATUS + '`. Nothing was staged.'); process.exit(2); }

/* ---- HOW THE STATUS IS INFLICTED. Flame Orb would be deterministic and is NOT legal here — checked
 * against the format rather than remembered. */
const ORB = dex.items.get('flameorb');
console.log('  flameorb in this format            : exists=' + ORB.exists + '  isNonstandard='
  + JSON.stringify(ORB.isNonstandard) + '   (so the burn must come from a MOVE, which carries a die)');
const INFLICT = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.status === STATUS
  && m.target === 'normal' && m.category === 'Status')
  .sort((a, b) => (b.accuracy === true ? 101 : b.accuracy) - (a.accuracy === true ? 101 : a.accuracy));
console.log('  status moves that inflict `' + STATUS + '`   : '
  + (INFLICT.map(m => m.id + ' (acc ' + m.accuracy + ')').join(', ') || 'NONE'));
if (!INFLICT.length) { console.log('  NO INFLICTOR — a claim about the format.'); process.exit(2); }
const INF = INFLICT[0];

/* ---- THE CARRIER. It must be able to CATCH the status, which is the type chart's own answer. */
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
const REFUSE_V = new Set(['refusesIndirectDamage', 'healsFromOwnStatus', 'passiveHeal',
  'refusesStatusMoves', 'immuneToStatus', 'curesOwnStatus']);
const CARRIERS = POOL.filter(s => Object.values(s.abilities).some(a => norm(a) === AB.id)
  && !G.CLOSET_SPECIES.has(norm(s.id))
  && dex.getImmunity(STATUS === 'brn' ? 'Fire' : 'Poison', s));
console.log('  legal carriers of ' + AB.id + ' that can catch ' + STATUS + ': '
  + (CARRIERS.map(s => s.name).join(', ') || 'NONE'));
if (!CARRIERS.length) { console.log('  NO CARRIER — a claim about the format.'); process.exit(2); }

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

/* THE CARRIER MUST ALSO OWN A SECOND ABILITY THAT SCALES NOTHING — that is the control arm, and it is
 * the same body so nothing else can move with it. */
const rowsC = [];
for (const s of CARRIERS) {
  const other = Object.values(s.abilities).find(a => norm(a) !== AB.id
    && !abilityTags(a).some(t => REFUSE_V.has(t)));
  const hold = SELF_HOLD(s);
  if (other && hold) rowsC.push({ s, other, hold });
}
if (!rowsC.length) { console.log('  NO CARRIER WITH A NEUTRAL SECOND ABILITY AND A SAFE HOLD MOVE — a claim about the fixture.'); process.exit(2); }
const CAR = rowsC[0];

const INFLICTORS = POOL.filter(s => LEARNS(s, INF.id) && s.name !== CAR.s.name
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
if (!INFLICTORS.length) { console.log('  NOBODY LEARNS ' + INF.id + ' — a claim about the format.'); process.exit(2); }
const INFB = INFLICTORS[0];
const FILL = POOL.filter(s => ![CAR.s.name, INFB.name].includes(s.name)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 5);
if (FILL.length < 5) { console.log('  NOT ENOUGH FILLER — a claim about the fixture.'); process.exit(2); }

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const dexAb = ab => Object.values(CAR.s.abilities).find(a => norm(a) === norm(ab)) || ab;
const AB_NAME = dexAb(AB.id);

const sides = (scaling) => ([
  [mon(INFB.name, [INF.name, SELF_HOLD(INFB)]),
   mon(FILL[0].name, [SELF_HOLD(FILL[0])]), mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
   mon(FILL[2].name, [SELF_HOLD(FILL[2])])],
  [mon(CAR.s.name, [CAR.hold], '', scaling ? AB_NAME : CAR.other),
   mon(FILL[3].name, [SELF_HOLD(FILL[3])]), mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
   mon(FILL[0].name === CAR.s.name ? FILL[1].name : FILL[0].name, [SELF_HOLD(FILL[0].name === CAR.s.name ? FILL[1] : FILL[0])])],
]);

/* ONE TURN, so exactly ONE residual has run at the boundary this probe reads. A second scripted turn
 * would put a second chip on the body and the expected HP would stop being `maxhp - chip`. */
const SCRIPT = [
  { p1: [{ m: norm(INF.id), t: 0 }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(CAR.hold) }, { m: norm(SELF_HOLD(FILL[3])) }] },
];

const run = (scaling, tag, nth) => {
  const [SA, SB] = sides(scaling);
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'statuschip/' + tag + '/' + nth, {
    arm: G.ARM_BY_ID.get('middle'), script: SCRIPT,
    onBoundary: (snap) => seen.push({
      me: snap.medi.sides.p2.party[norm(CAR.s.name)] || null,
      sd: snap.sd.sides.p2.party[norm(CAR.s.name)] || null,
    }),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (!seen.length) return { staged: false, why: 'no turn boundary was reached' };
  /* THE LAST BOUNDARY, NOT THE FIRST. `onBoundary` fires BEFORE turn 1 as well as after it, so
   * `seen[0]` is the board before anything was clicked — which is how the first draft of this probe
   * reported the burn as having missed on all twelve seeds. The same trap caught
   * `probe_smart_target_redirect.js` in batch E. */
  const M = seen[seen.length - 1];
  return { staged: true, r, M, burned: !!(M.sd && M.sd.status === STATUS),
           meHp: M.me && M.me.hp, sdHp: M.sd && M.sd.hp, maxhp: M.sd && M.sd.maxhp,
           meStatus: M.me && M.me.status, sdStatus: M.sd && M.sd.status,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

/* THE DIE IS RE-SEEDED UNTIL IT LANDS, AND THE ATTEMPTS ARE PRINTED. A probe that quietly accepted a
 * miss would assert about a body that was never burned at all. */
const roll = (scaling, tag) => {
  for (let n = 1; n <= 12; n++) {
    const r = run(scaling, tag, n);
    if (!r.staged) return { ...r, tries: n };
    if (r.burned) return { ...r, tries: n };
  }
  return { staged: false, why: INF.id + ' (acc ' + INF.accuracy + ') missed on all 12 seeds', tries: 12 };
};

const FULL = (mx) => Math.max(1, Math.floor(mx / CHIP_DIV));
const SCALED = (mx) => Math.max(1, Math.floor(FULL(mx) * MULT));

console.log('\n  chosen  : ' + INFB.name + ' clicks ' + INF.id + ' at ' + CAR.s.name
  + ' [' + AB_NAME + '], which then takes its own ' + STATUS + ' chip at the residual');
console.log('            the CONTROL arm is the SAME body carrying ' + CAR.other
  + ', which scales nothing');

console.log('\n  === THE SCALED ARM ===');
const SC1 = roll(true, CHILD ? 'control' : 'scaled');
if (!SC1.staged) { console.log('  NOT STAGED — ' + SC1.why); process.exit(1); }
console.log('  burn landed after ' + SC1.tries + ' seed(s);  max HP ' + SC1.maxhp
  + ',  full chip ' + FULL(SC1.maxhp) + ',  scaled chip ' + SCALED(SC1.maxhp));
console.log('  after one residual : medicham2 ' + SC1.meHp + '/' + SC1.maxhp + ' [' + SC1.meStatus
  + ']     showdown ' + SC1.sdHp + '/' + SC1.maxhp + ' [' + SC1.sdStatus + ']');
console.log('  first protocol divergence: ' + (SC1.div ? JSON.stringify(SC1.div) : 'none — the streams agree'));

console.log('\n  === THE CONTROL ARM — the same body, an ability that scales nothing ===');
const CT1 = roll(false, CHILD ? 'silent-control' : 'control');
if (!CT1.staged) { console.log('  NOT STAGED — ' + CT1.why); process.exit(1); }
console.log('  burn landed after ' + CT1.tries + ' seed(s)');
console.log('  after one residual : medicham2 ' + CT1.meHp + '/' + CT1.maxhp + '     showdown '
  + CT1.sdHp + '/' + CT1.maxhp);

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_STATUS_CHIP_UNSCALED=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({ meHp: SC1.meHp, sdHp: SC1.sdHp, div: !!SC1.div,
    divLine: SC1.div && SC1.div.me, ctlMe: CT1.meHp, ctlSd: CT1.sdHp, max: SC1.maxhp }));
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
need('the body really was ' + STATUS + '-ed (the fixture)', SC1.sdStatus, STATUS);
need('the CONTROL body was too, so the two arms are comparable', CT1.sdStatus, STATUS);
need('showdown takes the HALVED chip on the scaler (the authority — a control on the arithmetic)',
  SC1.sdHp, SC1.maxhp - SCALED(SC1.maxhp));
need('showdown takes the FULL chip without it (the authority, the other way)',
  CT1.sdHp, CT1.maxhp - FULL(CT1.maxhp));
need('medicham2 takes the halved chip too', SC1.meHp, SC1.maxhp - SCALED(SC1.maxhp));
need('medicham2 still takes the full chip on the control body', CT1.meHp, CT1.maxhp - FULL(CT1.maxhp));
need('the scaled game does not part at all', SC1.div, null);
need('the control game does not part at all', CT1.div, null);

{
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_STATUS_CHIP_UNSCALED=1 (the knob), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_STATUS_CHIP_UNSCALED: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the knob child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.meHp !== SC1.meHp;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the scaled arm: default '
      + SC1.meHp + '  vs knob ' + ctl.meHp);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.meHp !== ctl.max - FULL(ctl.max)) {
      console.log('  RED    the knob arm did not land on the FULL chip, so it is not the old behaviour.'); bad++;
    }
    if (!ctl.div) { console.log('  RED    the knob arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the knob arm parts on its own line: ' + ctl.divLine);
    if (ctl.ctlMe !== CT1.meHp) {
      console.log('  RED    THE CONTROL BODY MOVED under the knob (' + CT1.meHp + ' -> ' + ctl.ctlMe
        + '). The knob reaches further than the scaler.'); bad++;
    } else console.log('  green  the control body did NOT move under the knob (' + ctl.ctlMe + ')');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
