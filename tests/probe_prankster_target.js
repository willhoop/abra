/* probe_prankster_target.js — ROADMAP #9: DOES `pranksterBlocked` REFUSE EXACTLY THE TARGETS THE
 * AUTHORITY REFUSES, AND NO OTHERS?
 *
 *   SHOWDOWN_PATH=... node tests/probe_prankster_target.js
 *
 * THE AUTHORITY, read (not recalled):
 *   - `data/abilities.ts` prankster: `onModifyPriority` sets `move.pranksterBoosted = true` for any
 *     `move.category === 'Status'` (no Champions override: data/mods/champions/abilities.ts has no
 *     `prankster` block).
 *   - `sim/battle-actions.ts:676-677`, inside `hitStepTryImmunity`:
 *         } else if (this.battle.gen >= 7 && move.pranksterBoosted && pokemon.hasAbility('prankster') &&
 *             !targets[i].isAlly(pokemon) && !this.dex.getImmunity('prankster', target)) {
 *     PER TARGET, FOES ONLY (`isAlly` is true of the user itself and of its partner).
 *   - `sim/battle-actions.ts:505-518`: a move whose target is `all`, `foeSide`, `allySide` or `allyTeam`
 *     goes to `tryMoveHit`, NOT `trySpreadMoveHit`, so it NEVER reaches `hitStepTryImmunity` — a
 *     Prankster Trick Room, Tailwind or Spikes cannot be refused however many Dark bodies stand there.
 *   - `dex.getImmunity('prankster', ['Dark'])` is false — asked below, not assumed.
 *
 * ARMS. Every arm is played in BOTH engines and read three ways: the two boards (the differential's own
 * state comparison), the refusal line (`|-immune|<target>` counted in each stream), and the effect the
 * arm exists for (a boost stage, a field or side condition) read off the authority so the arm cannot
 * pass by testing nothing. Every body, ability and move is derived from the format; none is typed.
 *
 *   foe-dark          single-target status at a Dark FOE                    refused: Prankster x Dark
 *   foe-nondark       the same move at the non-Dark foe                      lands  (control: the type)
 *   foe-dark-noprank  the same move at the Dark foe, user WITHOUT Prankster  lands  (control: the ability)
 *   ally-dark         single-target status at a Dark ALLY                    lands  (isAlly)
 *   spread            allAdjacentFoes status, Dark foe + non-Dark foe        Dark refused, other lands
 *   spread-noprank    the same, user without Prankster                       both land (control)
 *   self-dark         a DARK Prankster user's self-targeted status           lands  (isAlly of itself)
 *   field-all         an `all` move (pseudo-weather) with a Dark foe out     lands  (never reaches the step)
 *   side-ally         an `allySide` move with a Dark foe out                 lands
 *   side-foe          a `foeSide` move with Dark foes out                    lands
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require(D('engine', 'names.js'));

const legal = x => x && x.exists && !x.isNonstandard;
const sp = n => dex.species.get(n);
const nonMega = n => legal(sp(n)) && !sp(n).isMega && !sp(n).battleOnly;
if (dex.getImmunity('prankster', ['Dark'])) { console.log('PREMISE — the dex says Dark is NOT immune to Prankster'); process.exit(1); }
const darkImmune = types => !dex.getImmunity('prankster', types);

/* an ability is INERT for this probe when it registers nothing that could refuse, redirect, reflect
 * or rewrite a status move or a boost, and nothing that fires on entry */
const RISKY = /TryHit|TryBoost|ChangeBoost|Immunity|SetStatus|Bounce|TryMove|DragOut|AfterBoost|ModifyPriority|onStart|onSwitchIn|Redirect|onAnyModify|onFoe|onAlly|onSource|Weather|Terrain/;
const inert = a => { const ab = dex.abilities.get(a); return legal(ab) && !Object.keys(ab).some(k => /^on/.test(k) && RISKY.test(k)); };
const inertAbility = n => Object.values(sp(n).abilities).find(inert);

const ROSTER = [...new Set(CS.moveCarriers('Protect'))].filter(nonMega);
const PRANK = CS.abilityCarriers('Prankster').filter(nonMega);
const statusMoves = dex.moves.all().filter(legal).filter(m => m.category === 'Status');
const dropOnly = m => m.boosts && Object.values(m.boosts).every(v => v < 0) && !m.onHit && !m.volatileStatus
  && !m.flags.powder && !m.flags.sound;
const learn = (n, pred) => statusMoves.find(m => pred(m) && CS.canLearn(n, m.name));

/* ---- the bodies --------------------------------------------------------------------------------- */
const pickUser = (pred) => PRANK.filter(n => !darkImmune(sp(n).types)).find(n => learn(n, pred));
const SINGLE = m => m.target === 'normal' && dropOnly(m);
const SPREAD = m => m.target === 'allAdjacentFoes' && m.boosts && Object.values(m.boosts).every(v => v < 0) && !m.onHit;
const ALL = m => m.target === 'all' && m.pseudoWeather && !m.onHit;
const ALLY_SIDE = m => m.target === 'allySide' && m.sideCondition && !m.onHit;
const FOE_SIDE = m => m.target === 'foeSide' && m.sideCondition && !m.onHit;
const SELF = m => m.target === 'self' && m.boosts && !m.onHit && !m.stallingMove && !m.heal && !m.volatileStatus;

const BOOST_IDLE = m => m.target === 'self' && m.boosts && !m.onHit && !m.stallingMove && !m.heal && !m.volatileStatus
  && !m.self && !m.selfSwitch && !m.sideCondition && !m.condition && !m.onTryHit && !m.onTry;
/* an idle click that touches none of the stats `avoid` names — so the arm's own leaf is read clean */
const idleFor = (n, avoid) => { const m = statusMoves.find(x => BOOST_IDLE(x) && CS.canLearn(n, x.name)
  && Object.keys(x.boosts).every(k => !(avoid || []).includes(k))); return m && m.name; };

const USER = pickUser(SINGLE);
const SPREAD_USER = PRANK.filter(n => !darkImmune(sp(n).types)).find(n => learn(n, SPREAD));
/* every stat either dropping move reads — a foe's idle click must leave all of them alone */
const READ = [...new Set([USER && learn(USER, SINGLE), SPREAD_USER && learn(SPREAD_USER, SPREAD)]
  .filter(Boolean).flatMap(m => Object.keys(m.boosts)))];
const DARK = ROSTER.filter(n => darkImmune(sp(n).types) && !Object.values(sp(n).abilities).includes('Prankster')
  && inertAbility(n) && !sp(n).types.includes('Grass') && idleFor(n, READ))[0];
const PLAIN = ROSTER.filter(n => !darkImmune(sp(n).types) && inertAbility(n) && !sp(n).types.includes('Grass')
  && n !== USER && n !== SPREAD_USER && idleFor(n, READ))[0];
const DARK_USER = PRANK.filter(n => darkImmune(sp(n).types)).find(n => learn(n, SELF));
if (!USER || !DARK || !PLAIN || !DARK_USER) { console.log('FIXTURE — user/dark/plain/dark-user missing', USER, DARK, PLAIN, DARK_USER); process.exit(1); }
const noPrank = n => Object.values(sp(n).abilities).find(a => a !== 'Prankster' && inert(a));

console.log('\n  FIXTURES (derived from ' + CS.FORMAT + ')');
console.log('    Prankster user    ' + USER + ' (' + sp(USER).types.join('/') + ')   non-Prankster control ability: ' + noPrank(USER));
console.log('    Dark body         ' + DARK + ' (' + sp(DARK).types.join('/') + ', ' + inertAbility(DARK) + ')');
console.log('    plain body        ' + PLAIN + ' (' + sp(PLAIN).types.join('/') + ', ' + inertAbility(PLAIN) + ')');
console.log('    Dark Prankster    ' + DARK_USER + ' (' + sp(DARK_USER).types.join('/') + ')');

const mon = (species, ability, moves, item) => {
  const bad = moves.filter(m => !CS.canLearn(species, m));
  if (bad.length) { console.log('  FIXTURE ILLEGAL — ' + species + ' cannot learn ' + bad.join(', ')); process.exit(1); }
  return { species, item: item || '', ability, moves };
};
const fill = ex => ROSTER.filter(n => !ex.includes(n) && inertAbility(n)).slice(0, 2)
  .map(n => ({ species: n, item: '', ability: inertAbility(n), moves: ['Protect'] }));

/* ---- the arms ----------------------------------------------------------------------------------- */
const ARMS = [];
const arm = (id, spec) => ARMS.push({ id, ...spec });
{
  const mv = learn(USER, SINGLE), stats = Object.keys(mv.boosts);
  const u = ab => mon(USER, ab, [mv.name, 'Protect']);
  const dark = mon(DARK, inertAbility(DARK), [idleFor(DARK, stats), 'Protect']);
  const plain = mon(PLAIN, inertAbility(PLAIN), [idleFor(PLAIN, stats), 'Protect']);
  const partner = mon(PLAIN, inertAbility(PLAIN), ['Protect']);
  const foeIdle = [{ m: N.id(idleFor(DARK, stats)) }, { m: N.id(idleFor(PLAIN, stats)) }];
  arm('foe-dark', { A: [u('Prankster'), fill([USER, DARK, PLAIN])[0]], B: [dark, plain],
    t1: { p1: [{ m: mv.id, t: 0 }, { m: 'protect' }], p2: foeIdle },
    expect: { refusedAt: 'p2a', stat: ['p2a', stats[0], 0] }, why: 'Prankster x Dark foe — the one refusal' });
  arm('foe-nondark', { A: [u('Prankster'), fill([USER, DARK, PLAIN])[0]], B: [dark, plain],
    t1: { p1: [{ m: mv.id, t: 1 }, { m: 'protect' }], p2: foeIdle },
    expect: { refusedAt: null, stat: ['p2b', stats[0], mv.boosts[stats[0]]] }, why: 'CONTROL — the same move at a non-Dark foe lands' });
  arm('foe-dark-noprank', { A: [u(noPrank(USER)), fill([USER, DARK, PLAIN])[0]], B: [dark, plain],
    t1: { p1: [{ m: mv.id, t: 0 }, { m: 'protect' }], p2: foeIdle },
    expect: { refusedAt: null, stat: ['p2a', stats[0], mv.boosts[stats[0]]] }, why: 'CONTROL — the same Dark foe, no Prankster: lands' });
  const allyDark = mon(DARK, inertAbility(DARK), [idleFor(DARK, stats), 'Protect']);
  arm('ally-dark', { A: [u('Prankster'), allyDark], B: [mon(PLAIN, inertAbility(PLAIN), ['Protect']), fill([USER, DARK, PLAIN])[0]],
    t1: { p1: [{ m: mv.id, ally: true }, { m: N.id(idleFor(DARK, stats)) }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    expect: { refusedAt: null, stat: ['p1b', stats[0], mv.boosts[stats[0]]] }, why: 'a Dark ALLY — isAlly, never refused' });
}
{
  const su = PRANK.filter(n => !darkImmune(sp(n).types)).find(n => learn(n, SPREAD));
  if (su) {
    const mv = learn(su, SPREAD), stats = Object.keys(mv.boosts);
    /* a powder spread move is refused by Grass and by Overcoat for its OWN reason; both foes are
     * filtered non-Grass above, so the only refusal left standing is Prankster's */
    const foes = [mon(DARK, inertAbility(DARK), [idleFor(DARK, stats), 'Protect']), mon(PLAIN, inertAbility(PLAIN), [idleFor(PLAIN, stats), 'Protect'])];
    const foeIdle = [{ m: N.id(idleFor(DARK, stats)) }, { m: N.id(idleFor(PLAIN, stats)) }];
    const partner = fill([su, DARK, PLAIN])[0];
    arm('spread', { A: [mon(su, 'Prankster', [mv.name, 'Protect']), partner], B: foes,
      t1: { p1: [{ m: mv.id }, { m: 'protect' }], p2: foeIdle },
      expect: { refusedAt: 'p2a', stat: ['p2b', stats[0], mv.boosts[stats[0]]], stat2: ['p2a', stats[0], 0] },
      why: 'allAdjacentFoes — per target: the Dark foe refused, the other lands' });
    arm('spread-noprank', { A: [mon(su, noPrank(su), [mv.name, 'Protect']), partner], B: foes,
      t1: { p1: [{ m: mv.id }, { m: 'protect' }], p2: foeIdle },
      expect: { refusedAt: null, stat: ['p2a', stats[0], mv.boosts[stats[0]]] }, why: 'CONTROL — no Prankster: the Dark foe is hit too' });
  } else console.log('  (no legal Prankster carrier learns an allAdjacentFoes status move — spread arm not staged)');
}
{
  const mv = learn(DARK_USER, SELF), st = Object.keys(mv.boosts)[0];
  arm('self-dark', { A: [mon(DARK_USER, 'Prankster', [mv.name, 'Protect']), fill([DARK_USER, DARK, PLAIN])[0]],
    B: [mon(DARK, inertAbility(DARK), ['Protect']), mon(PLAIN, inertAbility(PLAIN), ['Protect'])],
    t1: { p1: [{ m: mv.id }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    expect: { refusedAt: null, stat: ['p1a', st, mv.boosts[st]] }, why: 'a DARK Prankster user aims at itself — isAlly of itself' });
}
/* THE FIELD ARMS ARE EXHAUSTIVE OVER THE REACHABLE SET, not one example per class. Every status move
 * with target `all` / `allySide` / `foeSide` / `allyTeam` that ANY legal Prankster carrier learns is
 * staged, once, from a carrier that is not itself Dark, with two Dark bodies standing opposite. A move
 * that routes through a per-body refusal in this engine (as Perish Song does for Good as Gold) is
 * exactly where a target-blind `pranksterBlocked` would bite, and one example per class cannot see
 * which moves those are. */
const FIELD_TARGETS = new Set(['all', 'allySide', 'foeSide', 'allyTeam']);
const fieldRead = (m) => m.pseudoWeather ? { where: 'field', kind: 'pseudoWeather', id: m.pseudoWeather }
  : m.weather ? { where: 'field', kind: 'weather', id: N.id(m.weather) }
  : m.terrain ? { where: 'field', kind: 'terrain', id: N.id(m.terrain) }
  : m.sideCondition ? { where: m.target === 'foeSide' ? 'p2' : 'p1', kind: 'side', id: N.id(m.sideCondition) }
  : null;
const FOE_B = PRANK.includes(DARK_USER) ? ROSTER.filter(n => darkImmune(sp(n).types) && n !== DARK && inertAbility(n)
  && !Object.values(sp(n).abilities).includes('Prankster'))[0] : DARK_USER;
const seenField = new Set();
for (const u of PRANK.filter(n => !darkImmune(sp(n).types))) {
  for (const mv of statusMoves.filter(m => FIELD_TARGETS.has(m.target) && CS.canLearn(u, m.name))) {
    if (seenField.has(mv.id)) continue; seenField.add(mv.id);
    const read = fieldRead(mv);
    if (!read) { console.log('  (' + mv.name + ' — ' + mv.target + ' — writes no field, weather, terrain or side condition this probe can read; not staged)'); continue; }
    arm(mv.target + ':' + mv.id, { A: [mon(u, 'Prankster', [mv.name, 'Protect']), fill([u, DARK, FOE_B, PLAIN])[0]],
      B: [mon(DARK, inertAbility(DARK), ['Protect']), mon(FOE_B, inertAbility(FOE_B), ['Protect'])],
      t1: { p1: [{ m: mv.id }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      expect: { refusedAt: null, field: read }, why: 'a `' + mv.target + '` move — tryMoveHit, never the immunity step', move: mv.name });
  }
}
console.log('    field arms: ' + seenField.size + ' distinct moves; Dark bodies opposite them: ' + DARK + ', ' + FOE_B);

/* ---- play ---------------------------------------------------------------------------------------- */
const slot = (battle, s) => battle.sides[s[1] === '1' ? 0 : 1].active[s[2] === 'a' ? 0 : 1];
const immuneCount = (log, who) => (log || []).map(String).filter(l => new RegExp('^\\|-immune\\|' + who + ':', 'i').test(l)).length;
let red = 0, unreadable = 0;
const results = [];
console.log('\n  ' + 'arm'.padEnd(18) + 'move'.padEnd(16) + 'boards'.padEnd(10) + 'refusal medi/sd'.padEnd(18) + 'authority effect'.padEnd(22) + 'verdict');
for (const a of ARMS) {
  const pa = G.buildPair(a.A.concat(fill(a.A.concat(a.B).map(x => x.species))), { hpBoost: 4 });
  const pb = G.buildPair(a.B.concat(fill(a.A.concat(a.B).map(x => x.species))), { hpBoost: 4 });
  if (!pa || !pb) { console.log('  ' + a.id.padEnd(18) + 'COULD NOT BUILD'); unreadable++; continue; }
  const script = [a.t1, { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }];
  let sd = null, eff1 = null;
  /* THE EFFECT IS READ AT BOUNDARY 1 — the board right after the click — because a two-turn condition
   * (Fairy Lock) is already gone by the end of the script */
  const effectOf = (battle) => {
    if (a.expect.stat) {
      const [s, st, v] = a.expect.stat; const p = slot(battle, s);
      let txt = s + ' ' + st + ' ' + (p ? p.boosts[st] : NaN), ok = !!p && p.boosts[st] === v;
      if (a.expect.stat2) { const [s2, st2, v2] = a.expect.stat2; const p2 = slot(battle, s2); txt += ', ' + s2 + ' ' + st2 + ' ' + p2.boosts[st2]; ok = ok && p2.boosts[st2] === v2; }
      return { txt, ok };
    }
    const f = a.expect.field;
    const held = f.kind === 'pseudoWeather' ? !!battle.field.pseudoWeather[f.id]
      : f.kind === 'weather' ? N.id(battle.field.weather) === f.id
      : f.kind === 'terrain' ? N.id(battle.field.terrain) === f.id
      : !!battle.sides[f.where === 'p1' ? 0 : 1].sideConditions[f.id];
    /* a ONE-TURN side condition (Quick Guard, `duration: 1`) has already ended by the boundary, so its
     * own start line is the evidence: `-singleturn` / `-sidestart` naming the move, in this turn's log */
    const started = !held && battle.log.map(String).some(l => /^\|-(singleturn|sidestart)\|/.test(l)
      && N.id(l.split('|').slice(3).join('|').replace(/^move: /, '')) === f.id);
    return { txt: f.where + ' ' + f.id + ' ' + (held ? 'up' : started ? 'started' : 'ABSENT'), ok: held || started };
  };
  const r = G.playGame(pa, pb, 'directed', 'prank9/' + a.id, { script, onBoundary: (s, t, S, battle) => {
    sd = battle; if (t === 1) eff1 = effectOf(battle); } });
  const who = a.expect.refusedAt;
  const refMedi = who ? immuneCount(r.mediTrace, who) : ['p1a', 'p1b', 'p2a', 'p2b'].reduce((n, w) => n + immuneCount(r.mediTrace, w), 0);
  const refSd = who ? immuneCount(sd && sd.log, who) : ['p1a', 'p1b', 'p2a', 'p2b'].reduce((n, w) => n + immuneCount(sd && sd.log, w), 0);
  const want = who ? 1 : 0;
  const effect = eff1 ? eff1.txt : 'NO BOUNDARY 1', effectOk = !!(eff1 && eff1.ok);
  const boardsAgree = !r.stateDiv && r.boundaries > 0 && r.boundariesAgreed === r.boundaries;
  const authorityRight = refSd === want && effectOk;
  const engineRight = refMedi === want && boardsAgree;
  const verdict = !authorityRight ? 'UNREADABLE (the authority did not do what the arm stages)'
                : engineRight ? 'GREEN' : 'RED';
  if (verdict === 'RED') red++; if (/^UNREADABLE/.test(verdict)) unreadable++;
  const mvName = (a.t1.p1[0].m || '');
  console.log('  ' + a.id.padEnd(18) + mvName.padEnd(16) + (boardsAgree ? 'agree' : 'DIFFER').padEnd(10)
    + (refMedi + '/' + refSd + ' (want ' + want + ')').padEnd(18) + effect.padEnd(22) + verdict + (r.err ? '  [threw: ' + r.err + ']' : ''));
  if (verdict !== 'GREEN' && r.stateDiv) console.log('      first board divergence: ' + JSON.stringify(r.stateDiv).slice(0, 300));
  results.push({ id: a.id, why: a.why, move: mvName, boardsAgree, refusal: { medi: refMedi, sd: refSd, want }, effect, verdict });
}
/* ---- THE FUNCTION ITSELF, ASKED DIRECTLY ---------------------------------------------------------
 * Every played arm above can be green while `pranksterBlocked` is still target-blind, because no
 * branch of the battle loop happens to ask it about a field move today. That is ROADMAP #9's own word,
 * LATENT: the day a field-move branch starts calling the shared refusal per body (as Perish Song's
 * branch already does for Good as Gold), a blind function refuses a Prankster Trick Room at a Dark foe.
 * So the function is asked the authority's question for every field move staged above, with a Dark foe
 * on the OTHER side (so the side clause cannot be what answers), and the single-target move as the
 * control that must still come back refused. */
const M = require(D('engine', 'medicham2-browser.js'));
const { mcKey } = require(D('engine', 'mc_key.js'));
const body = (n, ab, sf) => { const b = M.buildMon(mcKey(n), {}); b.ability = ab; b._sf = sf; return b; };
const sfA = {}, sfB = {};
const uB = body(USER, 'prankster', sfA), dB = body(DARK, N.id(inertAbility(DARK)), sfB);
const directCtl = M.pranksterBlocked(uB, dB, learn(USER, SINGLE).id);
const directBad = [...seenField].filter(id => M.pranksterBlocked(uB, dB, id));
console.log('  DIRECT  pranksterBlocked(' + USER + ', Dark foe ' + DARK + ', <move>):');
console.log('    control ' + learn(USER, SINGLE).id + ' -> ' + directCtl + ' (must be true)');
console.log('    field moves answered REFUSED: ' + directBad.length + ' of ' + seenField.size + (directBad.length ? '  ' + directBad.join(' ') : '') + ' (must be 0)');
const directOk = directCtl === true && directBad.length === 0;
if (!directOk) red++;
results.push({ id: 'direct', control: directCtl, fieldRefused: directBad, verdict: directOk ? 'GREEN' : 'RED' });

const fs = require('fs');
fs.writeFileSync(D('data', 'verification', 'probe-prankster-target.json'), JSON.stringify({
  generated: new Date().toISOString(), roadmap: 9, format: CS.FORMAT,
  knob: process.env.MEDI_PRANKSTER_TARGET_BLIND || null, fixtures: { USER, DARK, PLAIN, DARK_USER },
  results, red, unreadable, run_ok: red === 0 && unreadable === 0 }, null, 1) + '\n');
console.log('\n  RED ' + red + '   UNREADABLE ' + unreadable + '   (wrote data/verification/probe-prankster-target.json)\n');
process.exit(red || unreadable ? 1 : 0);
