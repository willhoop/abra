/* probe_lifeorb_toll.js — DOES THE LIFE ORB HOLDER PAY, EVERY TIME THE AUTHORITY MAKES IT PAY?
 *
 *   SHOWDOWN_PATH=... node tests/probe_lifeorb_toll.js --release <id>
 *   SHOWDOWN_PATH=... node tests/probe_lifeorb_toll.js --release <id> --sweep 500
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * `data/items.ts:3409-3413`, and Champions does NOT override it (`data/mods/champions/items.ts` has
 * no `lifeorb` key — checked, not assumed):
 *
 *     onAfterMoveSecondarySelf(source, target, move) {
 *       if (source && source !== target && move && move.category !== 'Status' && !source.forceSwitchFlag) {
 *         this.damage(source.baseMaxhp / 10, source, source, this.dex.items.get('lifeorb'));
 *       }
 *     }
 *
 * fired at `sim/battle-actions.ts:538-539`, which is reached only past two guards:
 *
 *     :523  if (!moveResult) { ... return false; }            a move that did not connect pays NOTHING
 *     :534  if (!(move.hasSheerForce && pokemon.hasAbility('sheerforce')) && !move.flags['futuremove'])
 *
 * THERE IS NO CLAUSE ABOUT THE DAMAGE NUMBER. The toll is owed by a non-Status move that CONNECTED,
 * whatever it dealt and whoever it hit.
 *
 * ================= WHAT THIS ENGINE ASKED INSTEAD ===============================================
 *
 *     medicham2-browser.js   if(m.item==='lifeorb' && a.move.d.max>0 && _reached>0)
 *
 * `a.move.d` is the damage RANGE computed when the ACTION WAS BUILT, against the body that was
 * standing in the aimed slot at the top of the turn. Switches resolve before moves. So when the aimed
 * body is REPLACED by a switch on the same turn, `a.move.d` still describes the body that left —
 * and if THAT body was type-immune, `d.max` is 0 while the move goes on to hit the arriving body for
 * real damage. The toll is then silently skipped.
 *
 * BOTH REAL DIVERGENCES ARE THIS, AND NOTHING ELSE. Measured over 499 real pairs from
 * `data/team-pool-frozen` (below, `--sweep`), exactly two games' toll sequences differed:
 *
 *   bo3-2653713441:p2  Whimsicott (Grass/FAIRY, immune to Dragon) is aimed at, switches out for
 *                      Gholdengo; Dragapult's Dragon Darts hits Gholdengo for 32 — no toll.
 *   bo3-2654018395:p1  Krookodile (Ground/DARK, immune to Psychic) is aimed at, switches out for
 *                      Abomasnow; Basculegion's Psychic Fangs hits Abomasnow for 53 — no toll.
 *
 * ================= WHAT THIS PROBE IS NOT ========================================================
 *
 * It is NOT a test that Life Orb works. Fourteen single-engine stagings and four two-engine boards —
 * ordinary hit, resisted hit, spread, multi-hit, drain, recoil, two-turn release, a KO, a mid-turn
 * KO, Magic Guard, Sheer Force, Future Sight, a Status click — all agreed with the authority before
 * this pass. The item is wired; ONE GATE on it reads a stale number.
 *
 * NOTHING IS TYPED AS AN EXPECTED VALUE. Each arm prints both engines' toll lines and the verdict is
 * whether they agree. Two controls flank the defect arm, because "they agree" is satisfied trivially
 * by an arm where neither engine pays:
 *   - `no-switch-immune`  the aimed body STAYS and is immune. NEITHER may pay.
 *   - `no-switch-hittable` the aimed body is hittable from the start. BOTH must pay.
 * and `status-click` is the over-fire control for the category clause.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

/* `--release` must be in argv or requiring the driver CUTS a release into the real store
 * (game_differential.js:196). Same guard, same reason, as tests/probe_drag_body.js. */
if (!process.argv.includes('--release')) {
  console.log('REFUSING TO RUN — pass --release <id>.');
  console.log('  Requiring engine/game_differential.js without it CUTS A RELEASE INTO THE REAL STORE');
  console.log('  at require time (game_differential.js:196).');
  process.exit(2);
}
const SWEEP = (() => {
  const i = process.argv.indexOf('--sweep');
  return i >= 0 ? Math.max(1, +process.argv[i + 1] || 0) : 0;
})();

const fs = require('fs');
const CS = require(D('engine', 'champions_sim.js'));
const G = require(D('engine', 'game_differential.js'));

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE CAST IS DERIVED, NOT NAMED FROM MEMORY ------------------------------------------------- */
const CAST = [['garchomp', 'dragonclaw'], ['garchomp', 'protect'], ['whimsicott', 'protect'],
              ['gholdengo', 'protect'], ['milotic', 'protect'], ['incineroar', 'protect'],
              ['torterra', 'protect'], ['mawile', 'protect'],
              ['gholdengo', 'nastyplot'], ['whimsicott', 'tailwind']];
{
  let bad = 0;
  for (const [sp, mv] of CAST) if (!CS.canLearn(sp, mv)) { console.log(`  learnset: ${sp} / ${mv} -> NOT LEGAL`); bad++; }
  console.log(`  learnset (TeamValidator): ${CAST.length - bad} of ${CAST.length} cast rows LEGAL`);
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

/* THE TYPE FACTS ARE THE AUTHORITY'S OWN, printed so the arm cannot rest on a remembered chart. */
{
  const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
  const Dx = Dex.forFormat('gen9championsvgc2026regmb');
  for (const sp of ['whimsicott', 'gholdengo']) {
    const t = Dx.species.get(sp).types;
    console.log(`  Dex: Dragon into ${sp} (${t.join('/')}) -> `
      + (Dx.getImmunity('Dragon', t) ? 'hittable, x' + Math.pow(2, Dx.getEffectiveness('Dragon', t)) : 'IMMUNE'));
  }
}

/* THE ORB HOLDER IS THE ONLY BODY CARRYING AN ITEM, so a `[from] item:` line on either stream can
 * only be this one. Every ability is named explicitly — a blank one is whatever the builder felt
 * like, which is the uncleared control this repo has a standing rule about. */
const TEAM_ORB = [mon('garchomp', 'Life Orb', 'Rough Skin', ['Dragon Claw', 'Protect']),
                  mon('milotic', '', 'Marvel Scale', ['Protect']),
                  mon('incineroar', '', 'Intimidate', ['Protect']),
                  mon('torterra', '', 'Overgrow', ['Protect'])];
/* p1a is the FAIRY (immune to Dragon); `gholdengo` sits on the bench and is hittable. */
const TEAM_FOE_IMMUNE = [mon('whimsicott', '', 'Prankster', ['Protect', 'Tailwind']),
                         mon('mawile', '', 'Intimidate', ['Protect']),
                         mon('gholdengo', '', 'Good as Gold', ['Protect', 'Nasty Plot']),
                         mon('torterra', '', 'Overgrow', ['Protect'])];
/* the same four bodies with the HITTABLE one already standing — the arm's positive control */
const TEAM_FOE_HITTABLE = [mon('gholdengo', '', 'Good as Gold', ['Protect', 'Nasty Plot']),
                           mon('mawile', '', 'Intimidate', ['Protect']),
                           mon('whimsicott', '', 'Prankster', ['Protect', 'Tailwind']),
                           mon('torterra', '', 'Overgrow', ['Protect'])];

/* Showdown's `|split|pX` is followed by the SECRET line and then the SHARED (percentage) line, so the
 * SAME event appears twice with different HP. Dropping the shared half is what makes a count of lines
 * a count of EVENTS — the first version of this probe counted both and reported a 1-toll turn as 2. */
function unsplit(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const l = String(log[i]);
    if (/^\|split\|/.test(l)) { if (log[i + 1] !== undefined) out.push(String(log[i + 1])); i += 2; continue; }
    out.push(l);
  }
  return out;
}
const orbLines = ls => ls.filter(l => /\[from\] *item: *Life Orb/i.test(String(l))).map(String);
/* THE BODY AND THE HP, so "both engines wrote a line" cannot pass for "both wrote the SAME line". */
const orbShape = (l) => {
  const f = String(l).split('|');
  return (f[2] || '').split(':')[0].trim() + ':' + (f[3] || '').trim().replace(/ .*$/, '');
};

function runArm(label, teamFoe, script, note) {
  const a = G.buildPair(teamFoe), b = G.buildPair(TEAM_ORB);      // a = p1 (the foes), b = p2 (the Orb)
  if (!a || !b) return { label, note, verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const r = G.playGame(a, b, 'directed', 'probe-lifeorb:' + label, {
    script, onBoundary: (snap) => { snap.identical = true; snap.diffs = []; },
  });
  const sd = unsplit((G.lastSdLog ? G.lastSdLog() : []).map(String));
  const me = ((r && r.mediTrace) || []).map(String);
  const dmgOf = ls => ls.filter(l => /^\|-damage\|/.test(l) && !/\[from\]/.test(l)).map(String);
  return { label, note, verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns,
           sd: orbLines(sd), me: orbLines(me), sdHit: dmgOf(sd), meHit: dmgOf(me),
           script: G.scriptCounters ? G.scriptCounters() : null };
}

/* THE AIMED BODY MUST NOT CLICK PROTECT, and the first run of this probe failed because it did:
 * Protect stops Dragon Claw outright, so `no-switch-hittable` staged NOTHING and reported "the two
 * engines paid the same tolls" — trivially, on an arm where neither could. The idle click is a
 * SELF-TARGETING status move, derived legal by TeamValidator above, that cannot interfere. */
const IDLE = { gholdengo: 'nastyplot', whimsicott: 'tailwind' };
const clickAt = idle => ({ p1: [{ m: idle }, { m: 'protect' }],
                           p2: [{ m: 'dragonclaw', t: 0 }, { m: 'protect' }] });
const SWITCH_THEN = { p1: [{ sw: 'gholdengo' }, { m: 'protect' }],
                      p2: [{ m: 'dragonclaw', t: 0 }, { m: 'protect' }] };
const STATUS_ONLY = { p1: [{ m: IDLE.gholdengo }, { m: 'protect' }],
                      p2: [{ m: 'protect' }, { m: 'protect' }] };

console.log('\nDOES THE LIFE ORB HOLDER PAY — both engines, one item, four boards\n');
console.log('  mode ' + G.MODE);
console.log('  release ' + (G.REL && G.REL.id));

const ARMS = [
  runArm('no-switch-hittable', TEAM_FOE_HITTABLE, [clickAt(IDLE.gholdengo)],
    'THE CONTROL THAT MUST FIRE: the aimed body is hittable from the start, so `a.move.d` is built '
    + 'against the body that is actually hit. If this pays nothing the item is unwired and every arm '
    + 'below is meaningless.'),
  runArm('status-click', TEAM_FOE_HITTABLE, [STATUS_ONLY],
    'THE CATEGORY OVER-FIRE CONTROL: `move.category !== "Status"`. Both engines must pay ZERO. '
    + 'Without it an engine that paid on EVERY click would agree with the authority everywhere else.'),
  runArm('no-switch-immune', TEAM_FOE_IMMUNE, [clickAt(IDLE.whimsicott)],
    'THE CONNECTION OVER-FIRE CONTROL: the aimed body is a FAIRY and stays. Dragon cannot touch it, '
    + 'the move does not connect, and NEITHER engine may pay. This is the arm that stops the fix '
    + 'below from becoming "pay on every damaging click".'),
  runArm('aimed-body-replaced-by-a-switch', TEAM_FOE_IMMUNE, [SWITCH_THEN],
    'THE DEFECT: the FAIRY is aimed at and then switches out for a body Dragon CAN hit. The move '
    + 'connects and deals real damage; `a.move.d.max` still describes the body that left.'),
];

const pad = (s, n) => String(s == null ? '' : s).padEnd(n);
let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const x of ARMS) {
  console.log('\n' + '='.repeat(96));
  console.log('  ' + x.label + '   (' + x.verdict + (x.why ? ' — ' + x.why : '') + ')');
  console.log('  ' + x.note);
  console.log('='.repeat(96));
  if (x.verdict !== 'RAN') {
    console.log('  COULD-NOT-STAGE is a claim about the FIXTURE, never about the mechanic.');
    fails++; continue;
  }
  console.log(`  turns played: ${x.turns}   scripted clicks NOT on the request: `
    + `${x.script ? x.script.moveNotOnRequest : '?'}`);
  console.log('  the MOVE\'s own damage   showdown ' + pad(x.sdHit.join(' ') || '(none)', 40)
    + '  medicham ' + (x.meHit.join(' ') || '(none)'));
  console.log('  LIFE ORB TOLLS');
  const n = Math.max(x.sd.length, x.me.length);
  for (let i = 0; i < n; i++) console.log('    ' + pad(x.sd[i] || '(none)', 58) + '  ' + (x.me[i] || '(none)'));
  if (!n) console.log('    (neither engine wrote a toll)');
  const sdS = x.sd.map(orbShape), meS = x.me.map(orbShape);
  const same = sdS.length === meS.length && sdS.every((v, i) => v === meS[i]);

  if (x.label === 'status-click' || x.label === 'no-switch-immune') {
    ok(x.sd.length === 0 && x.me.length === 0,
      `${x.label}: NEITHER engine pays a toll (the over-fire control)`,
      (x.sd.length || x.me.length) ? `showdown ${x.sd.length}, medicham ${x.me.length}` : '');
  } else {
    ok(x.sdHit.length > 0, `${x.label}: the move CONNECTED on the authority — the arm is not inert`,
      x.sdHit.length ? '' : 'no damage line at all; this arm proves nothing about medicham2');
    ok(x.sd.length > 0, `${x.label}: the AUTHORITY paid a toll`,
      x.sd.length ? '' : 'the authority did not pay either — the fixture is not the case this arm names');
    ok(same, `${x.label}: the two engines paid the SAME tolls, in order, on the same bodies`,
      same ? '' : `showdown [${sdS.join(', ') || '-'}]  medicham [${meS.join(', ') || '-'}]`);
  }
}

/* ---- THE CORPUS SWEEP (opt-in) ------------------------------------------------------------------
 *
 * The staged arms above say what the rule IS. This says how often the two engines part on REAL
 * sheets, and it is what turned "Life Orb never fires" into two named games. Opt-in because it is
 * minutes, not seconds, and because a probe that always runs it stops being run. */
if (SWEEP) {
  const STORE = D('data', 'team-pool-frozen', 'games.bo3.jsonl');
  console.log('\n' + '='.repeat(96));
  console.log('  CORPUS SWEEP — real sheets, only teams that actually carry a Life Orb');
  console.log('  ' + STORE);
  console.log('='.repeat(96));
  const teams = [], seen = new Set();
  for (const line of fs.readFileSync(STORE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let g; try { g = JSON.parse(line); } catch (e) { continue; }
    for (const side of ['p1', 'p2']) {
      const t = (g.sheets || {})[side];
      if (!t || t.length < 4) continue;
      if (!t.some(p => norm(p && p.item) === 'lifeorb')) continue;
      const k = t.map(p => norm(p.species)).sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      teams.push({ t, id: g.id + ':' + side });
    }
  }
  console.log('  teams carrying a Life Orb: ' + teams.length);
  let played = 0, threw = 0, differ = 0, tSd = 0, tMe = 0;
  const bad = [];
  for (let i = 0; i < Math.min(SWEEP, teams.length - 1); i++) {
    const a = G.buildPair(teams[i].t), b = G.buildPair(teams[(i + 1) % teams.length].t);
    if (!a || !b) continue;
    let r;
    try { r = G.playGame(a, b, 'omit-protect', teams[i].id + ' vs ' + teams[(i + 1) % teams.length].id); }
    catch (e) { threw++; continue; }
    if (r.err) { threw++; continue; }
    played++;
    const so = orbLines(unsplit((G.lastSdLog() || []).map(String))).map(orbShape);
    const mo = orbLines(((r && r.mediTrace) || []).map(String)).map(orbShape);
    tSd += so.length; tMe += mo.length;
    if (!(so.length === mo.length && so.every((v, k) => v === mo[k]))) {
      differ++;
      if (bad.length < 8) bad.push({ tag: teams[i].id, sd: so, me: mo });
    }
  }
  console.log(`  games played ${played}, threw ${threw}`);
  console.log(`  total tolls: showdown ${tSd}, medicham ${tMe}`);
  console.log(`  toll SEQUENCES that differ: ${differ}`);
  for (const b of bad) console.log(`    ${b.tag}\n       sd ${JSON.stringify(b.sd)}\n       me ${JSON.stringify(b.me)}`);
  ok(differ === 0, `corpus sweep: no real game's toll sequence differs (${played} games)`,
    differ ? `${differ} of ${played} differ` : '');
}

console.log('\n' + '='.repeat(96));
console.log('  ' + (fails ? fails + ' clause(s) did not hold' : 'every clause held'));
process.exit(fails ? 1 : 0);
