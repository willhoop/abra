/* test-immunity-gate.js — DOES data/tags.json CARRY THE MOVE-SPECIFIC IMMUNITY, AND DOES ITS
 * CONDITION PREDICT WHAT THE AUTHORITY ACTUALLY DOES?
 *
 *   SHOWDOWN_PATH=... node tests/test-immunity-gate.js
 *   SHOWDOWN_PATH=... node tests/test-immunity-gate.js --red   (the deliberate break, see below)
 *
 * ================= WHAT WAS RED, AND WHY A COUNT COULD NOT HAVE SEEN IT ==========================
 *
 * Six legal moves carry `onTryImmunity` and NONE of them had any representation in data/tags.json.
 * Endeavor's row was
 *
 *     ["pp","fixedDamage","targetClass","contact","noExtraHit","formatSecondaryCount","callRefusalFlags"]
 *
 * — `fixedDamage` and no gate at all. Endeavor's entire gate is `return pokemon.hp < target.hp`, so
 * two bodies at equal HP make it FALSE, and `hitStepTryImmunity` turns a false into `|-immune|` and
 * stops the move at step 3 of 8. A consumer that reads `fixedDamage` alone runs the `damageCallback`
 * at step 7 (`target.hp - pokemon.hp` = 0) and narrates a zero-damage hit — "drops to 100%".
 *
 * The tag was not WRONG. It was ABSENT, which is this project's signature failure: nothing threw,
 * nothing scored badly, and the roster credits the move clean because nothing ever staged the
 * condition. A census count cannot detect it and neither can a coverage percentage.
 *
 * ================= THE THREE THINGS THIS ASSERTS, AND WHY NONE SUBSTITUTES ======================
 *
 * 1. MEMBERSHIP, BOTH DIRECTIONS. The set of moves carrying `immunityGate` in the artifact must EQUAL
 *    the set of legal moves carrying `onTryImmunity` in the authority. Equality, not containment: a
 *    tag that matches MORE than the authority's handler set is a silent over-match (ROADMAP #178) and
 *    a count cannot see one, because an over-match and a correct derivation both go UP.
 *
 * 2. READABILITY. Every row's condition must be structured. `readable: false` is deliberately emitted
 *    rather than dropped by the deriver, so an unrecognised handler arrives here as a failure instead
 *    of as a move that appears to have no immunity.
 *
 * 3. THE ORACLE. Each staged arm is played in the OFFICIAL simulator and the derived condition is
 *    evaluated against the same two bodies. Nothing here types an expected outcome: Showdown says
 *    whether `|-immune|` was emitted, the tag says whether it should have been, and the two are
 *    compared. A test that carried its own answer would be exactly as fallible as its author, which
 *    is the mistake `tests/staged_board.js` was built to stop this repo repeating.
 *
 * ================= WILL'S REQUIREMENT: THE POSITIVE ARM IS NOT OPTIONAL =========================
 *
 * "A test that only proves the immunity is a test that ships an Endeavor which never works." Every
 * move here is staged BOTH ways — the gate closed and the gate open — and the open arm additionally
 * asserts the move's real effect landed (Endeavor equalises HP, Trick swaps the item, Leech Seed
 * plants, Attract attracts, Worry Seed rewrites the ability). Without that half, an engine that
 * refused all six unconditionally would pass.
 *
 * ================= THE FIXTURES ARE DERIVED, NEVER NAMED ========================================
 *
 * Sticky Hold's carrier, Insomnia's carrier, a Grass-typed body and a gendered pair are all read out
 * of `Dex.forFormat(gen9championsvgc2026regmb)` under CLAUDE.md's own legality filter on every run —
 * so this file cannot name a species that has rotated out, and it fails loudly if the format stops
 * containing one rather than quietly staging something else.
 *
 * Moves are ASSIGNED for staging and are not learnset-checked, exactly as `tests/staged_board.js` and
 * the directed table in `engine/game_differential.js` do. Only the authority runs here, so nothing
 * about the comparison depends on move legality. Nothing in this file is a set recommendation.
 *
 * ================= WHAT IT DOES NOT TOUCH ======================================================
 *
 * This file loads NO part of `engine/medicham2-browser.js` and does not require
 * `engine/game_differential.js`. It compares an ARTIFACT against the AUTHORITY; whether our simulator
 * then honours the tag is a separate claim and belongs to whoever wires the consumer.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

const CS = require(D('engine', 'champions_sim.js'));
const { Dex, Teams } = CS.sim();
const { Battle } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'battle.js'));
const dex = Dex.forFormat(CS.FORMAT);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* THE ARTIFACT UNDER TEST. `--tags <file>` lets the red demonstration point at the pre-change copy
 * without editing anything, and the path is printed so a green run can never be mistaken for a green
 * run against the wrong file. */
const tagsArg = process.argv.indexOf('--tags');
const TAGS_PATH = tagsArg >= 0 ? process.argv[tagsArg + 1] : D('data', 'tags.json');
const TAGS = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));

let fails = 0;
const FAIL = (msg) => { console.log('  FAIL  ' + msg); fails++; };
const PASS = (msg) => console.log('  ok    ' + msg);

console.log('IMMUNITY GATE — the artifact against the authority');
console.log('  tags       ' + TAGS_PATH);
console.log('  generated  ' + TAGS.generated);
console.log('  format     ' + CS.FORMAT);
console.log('');

/* ------------------------------------------------------------------ 1. MEMBERSHIP, BOTH WAYS -- */
const legalMove = m => m && m.exists && !m.isNonstandard;
const AUTHORITY = new Set(dex.moves.all().filter(m => legalMove(m) && m.onTryImmunity).map(m => m.id));
const ARTIFACT = new Set(Object.entries(TAGS.moves)
  .filter(([, r]) => (r.tags || []).includes('immunityGate')).map(([id]) => id));

console.log('MEMBERSHIP');
console.log('  authority (legal moves with onTryImmunity): ' + [...AUTHORITY].sort().join(', '));
console.log('  artifact  (moves tagged immunityGate):      ' + ([...ARTIFACT].sort().join(', ') || '(none)'));
for (const id of AUTHORITY) if (!ARTIFACT.has(id)) FAIL(`${id} carries onTryImmunity and has NO immunityGate row — the gate is UNDERIVED`);
for (const id of ARTIFACT) if (!AUTHORITY.has(id)) FAIL(`${id} is tagged immunityGate and the authority gives it NO onTryImmunity — OVER-MATCH`);
if (!fails) PASS(`the two sets are equal, ${AUTHORITY.size} members`);
if (!AUTHORITY.size) FAIL('the authority reports ZERO moves with onTryImmunity — the probe is broken, not the format');
console.log('');

/* ------------------------------------------------------------------ 2. EVERY ROW IS READABLE --- */
console.log('READABILITY');
for (const id of [...AUTHORITY].sort()) {
  const p = TAGS.moves[id] && TAGS.moves[id].params && TAGS.moves[id].params.immunityGate;
  if (!p) { FAIL(`${id}: no immunityGate param`); continue; }
  if (!p.readable || !p.condition) { FAIL(`${id}: condition UNREADABLE — ${p.handler}`); continue; }
  if (p.announces !== '-immune') FAIL(`${id}: announces ${p.announces}, the step list says -immune`);
  if (p.attribution !== null) FAIL(`${id}: carries an attribution ${JSON.stringify(p.attribution)}; the step's add() is bare`);
  if (typeof p.step !== 'number' || !Array.isArray(p.blocksBefore) || !p.blocksBefore.length)
    FAIL(`${id}: no step position, so a consumer cannot know the hit loop is skipped`);
  else PASS(`${id.padEnd(11)} ${JSON.stringify(p.condition)}`);
}
console.log('');

/* ------------------------------------------------------------------ 3. THE PREDICATE ----------- */
/* ONE READER FOR THE DERIVED CONDITION. It is deliberately total: an unknown `pass` THROWS rather
 * than defaulting to "not immune", because a silent default here reproduces the exact bug — a move
 * whose gate is unknown being treated as a move with no gate. */
function passes(cond, ctx) {
  const who = k => (k === 'target' ? ctx.target : k === 'user' ? ctx.user : null);
  switch (cond.pass) {
    case 'lacksType':    return !cond.types.some(t => who(cond.who).hasType(t));
    case 'lacksAbility': return !cond.abilities.some(a => norm(who(cond.who).ability) === norm(a));
    case 'hpCompare': {
      const L = who(cond.left).hp, R = who(cond.right).hp;
      if (cond.op === '<') return L < R;
      if (cond.op === '<=') return L <= R;
      if (cond.op === '>') return L > R;
      if (cond.op === '>=') return L >= R;
      throw new Error('unknown comparison ' + cond.op);
    }
    case 'genderPairs':  return cond.anyOf.some(pair => pair.every(t => who(t.who).gender === t.gender));
    default: throw new Error('unmodelled immunity condition "' + cond.pass + '" — refusing to guess');
  }
}

/* ---- FIXTURES, DERIVED ---- */
const legalSpecies = s => s && s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const SPECIES = dex.species.all().filter(legalSpecies);
function firstWithAbility(id) {
  const s = SPECIES.find(sp => Object.values(sp.abilities || {}).some(a => norm(a) === norm(id)));
  if (!s) throw new Error(`no legal Reg M-B species carries ${id} — the fixture cannot be built`);
  return s.name;
}
function firstWhere(pred, why) {
  const s = SPECIES.find(pred);
  if (!s) throw new Error(`no legal Reg M-B species satisfies ${why}`);
  return s.name;
}
/* A BODY THAT CAN BE STAGED AT ALL: no mega/battle-only forme, no required item (Trick must be able
 * to move the item), and no ability that is itself one of the gates under test. */
const stageable = s => !s.battleOnly && !s.requiredItem && !s.forme.includes('Mega');
const OFF_LIMITS = new Set(['stickyhold', 'insomnia', 'truant']);
const STICKY = firstWithAbility('stickyhold');
const INSOMNIA = firstWithAbility('insomnia');
const GRASSY = firstWhere(s => stageable(s) && s.types.includes('Grass'), 'a Grass type');
const PLAIN = firstWhere(s => stageable(s) && !s.types.includes('Grass') && s.gender !== 'N' &&
  !Object.values(s.abilities).some(a => OFF_LIMITS.has(norm(a))), 'a plain non-Grass body');
const MALE = firstWhere(s => stageable(s) && s.gender === 'M', 'a guaranteed-male species');
const FEMALE = firstWhere(s => stageable(s) && s.gender === 'F', 'a guaranteed-female species');
console.log('FIXTURES (derived from the format on this run)');
console.log(`  sticky hold ${STICKY}   insomnia ${INSOMNIA}   grass ${GRASSY}   plain ${PLAIN}`);
console.log(`  male ${MALE}   female ${FEMALE}`);
console.log('');

/* EVERY SLOT THAT IS NOT THE ONE UNDER TEST IS SILENCED WITH `CS.INERT_MOVE`, and the reason it is
 * that move and not "whatever this species can learn" is in champions_sim's own header: Recycle FAILS
 * OUTRIGHT with no consumed item, so it cannot damage, heal, boost, switch or touch the field. A
 * filler clicking a real attack would change the HP that Endeavor's gate is read from. */
const INERT = () => CS.INERT_MOVE;
function mkSet(species, move, opts) {
  const sp = dex.species.get(species);
  return { name: species, species, item: (opts && opts.item) || '',
           ability: (opts && opts.ability) || sp.abilities[0],
           moves: [move], nature: 'Serious',
           evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 };
}
const FILLER = ['Ditto', 'Ditto', 'Ditto'];

/* ONE STAGED TURN IN THE OFFICIAL SIMULATOR. p1 slot a clicks `move`; everything else is inert. The
 * `-immune` line is read off the log and attributed to the defender's slot, so an unrelated immunity
 * elsewhere on the field cannot be mistaken for this one. */
function stage(o) {
  const teamA = [mkSet(o.att, o.move, o.attOpts), ...FILLER.map(f => mkSet(f, INERT(f)))];
  const teamB = [mkSet(o.def, INERT(o.def), o.defOpts), ...FILLER.map(f => mkSet(f, INERT(f)))];
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  const user = battle.p1.active[0], target = battle.p2.active[0];
  if (o.prep) o.prep(user, target);
  /* THE GATE IS EVALUATED ON THE STATE THE AUTHORITY EVALUATED IT ON — BEFORE THE MOVE.
   *
   * This file got it wrong first, in the direction that flatters the tag: it read the LIVE Pokemon
   * objects after the turn. Endeavor had already equalised the HP, so `user.hp < target.hp` was false
   * and the tag "predicted" an immunity that never happened; Worry Seed had already written Insomnia,
   * so the ability gate closed retroactively. Both would have read as ENGINE defects. A snapshot taken
   * before the choice is the only honest input. */
  const snap = p => ({ hp: p.hp, ability: p.ability, gender: p.gender,
                       types: p.getTypes(), hasType(t) { return this.types.includes(t); } });
  const gateCtx = { user: snap(user), target: snap(target) };
  const before = { targetHp: target.hp, targetItem: target.item, userItem: user.item,
                   targetAbility: target.ability, seeded: !!target.volatiles['leechseed'],
                   attracted: !!target.volatiles['attract'] };
  const logFrom = battle.log.length;
  /* DOUBLES: BOTH ACTIVE SLOTS MUST CHOOSE. A one-action string is REJECTED, the turn never runs, and
   * every arm would then report `immune=false` for the same reason — the silent-zero shape, which is
   * why `battle.turn` is asserted below rather than trusted. The silencer is `target: 'self'`, so it
   * takes NO target index; giving it one is itself a rejected choice. */
  if (!battle.choose('p1', 'move 1 1, move 1')) throw new Error('p1 choice rejected');
  if (!battle.choose('p2', 'move 1, move 1')) throw new Error('p2 choice rejected');
  if (battle.turn < 2) throw new Error('the staged turn never resolved (battle.turn=' + battle.turn + ')');
  const log = battle.log.slice(logFrom);
  const tgtTag = target.getSlot ? target.getSlot() : 'p2a';
  const immune = log.some(l => l.startsWith('|-immune|') && l.includes(tgtTag));
  const after = { targetHp: target.hp, targetItem: target.item, userItem: user.item,
                  targetAbility: target.ability, seeded: !!target.volatiles['leechseed'],
                  attracted: !!target.volatiles['attract'], userHp: user.hp };
  return { immune, log, before, after, user, target, gateCtx };
}

/* ---- THE ARMS. `gateShouldPass` is NOT typed: it is computed from the artifact's own condition
 *      against the same two bodies, inside `check`. What each arm declares is only the STAGING and,
 *      for the open arm, the EFFECT that must be visible — which is a different claim from the gate
 *      and is what stops an always-refusing engine passing. ---- */
const ARMS = [
  { why: 'Endeavor, user ABOVE target HP — the gate is `pokemon.hp < target.hp`',
    move: 'Endeavor', att: PLAIN, def: PLAIN,
    prep: (u, t) => { t.hp = Math.floor(t.maxhp / 2); } },
  { why: 'Endeavor, user EQUAL to target HP — the strict `<`, and the case the card was written about',
    move: 'Endeavor', att: PLAIN, def: PLAIN, prep: () => {} },
  { why: 'Endeavor, user BELOW target HP — it WORKS, and the target must land on the user\'s HP',
    move: 'Endeavor', att: PLAIN, def: PLAIN,
    prep: (u) => { u.hp = Math.floor(u.maxhp / 2); },
    effect: r => r.after.targetHp === r.user.hp
      ? null : `target is ${r.after.targetHp}, user is ${r.user.hp} — Endeavor did not equalise` },
  { why: 'Leech Seed into a GRASS body', move: 'Leech Seed', att: PLAIN, def: GRASSY, prep: () => {} },
  { why: 'Leech Seed into a non-Grass body — it plants',
    move: 'Leech Seed', att: PLAIN, def: PLAIN, prep: () => {},
    effect: r => r.after.seeded ? null : 'no leechseed volatile on the target' },
  { why: 'Trick into STICKY HOLD', move: 'Trick', att: PLAIN, def: STICKY,
    attOpts: { item: 'Life Orb' }, defOpts: { ability: 'Sticky Hold', item: 'Leftovers' }, prep: () => {} },
  { why: 'Trick into a body without Sticky Hold — the items swap',
    move: 'Trick', att: PLAIN, def: PLAIN,
    attOpts: { item: 'Life Orb' }, defOpts: { item: 'Leftovers' }, prep: () => {},
    effect: r => (r.after.targetItem === 'lifeorb' && r.after.userItem === 'leftovers')
      ? null : `items did not swap: user ${r.after.userItem}, target ${r.after.targetItem}` },
  { why: 'Switcheroo into STICKY HOLD', move: 'Switcheroo', att: PLAIN, def: STICKY,
    attOpts: { item: 'Life Orb' }, defOpts: { ability: 'Sticky Hold', item: 'Leftovers' }, prep: () => {} },
  { why: 'Worry Seed into INSOMNIA — the ability is already what the move would write',
    move: 'Worry Seed', att: PLAIN, def: INSOMNIA, defOpts: { ability: 'Insomnia' }, prep: () => {} },
  { why: 'Worry Seed into an ordinary ability — it rewrites',
    move: 'Worry Seed', att: PLAIN, def: PLAIN, prep: () => {},
    effect: r => r.after.targetAbility === 'insomnia' ? null : `ability is ${r.after.targetAbility}` },
  { why: 'Attract, SAME gender', move: 'Attract', att: MALE, def: MALE, prep: () => {} },
  { why: 'Attract, OPPOSITE genders — it attracts',
    move: 'Attract', att: MALE, def: FEMALE, prep: () => {},
    effect: r => r.after.attracted ? null : 'no attract volatile on the target' },
];

console.log('THE ORACLE — Showdown plays the turn, the tag predicts it');
/* THE BREAK. A comparator never shown catching anything is not evidence. `--red` inverts the artifact's
 * condition in memory (never on disk) and the run must go RED on it. */
const RED = process.argv.includes('--red');
if (RED) console.log('  --red: every derived condition is INVERTED in memory. This run MUST fail.');

for (const arm of ARMS) {
  let r;
  try { r = stage(arm); } catch (e) { FAIL(`${arm.why} :: THREW while staging — ${e.message}`); continue; }
  const id = norm(arm.move);
  const p = TAGS.moves[id] && TAGS.moves[id].params && TAGS.moves[id].params.immunityGate;
  if (!p || !p.condition) { FAIL(`${arm.why} :: no readable immunityGate for ${id}`); continue; }
  let predictedImmune;
  try { predictedImmune = !passes(p.condition, r.gateCtx); }
  catch (e) { FAIL(`${arm.why} :: ${e.message}`); continue; }
  if (RED) predictedImmune = !predictedImmune;
  if (predictedImmune !== r.immune) {
    FAIL(`${arm.why} :: authority immune=${r.immune}, tag says immune=${predictedImmune}`);
    continue;
  }
  if (!r.immune && arm.effect) {
    const bad = arm.effect(r);
    if (bad) { FAIL(`${arm.why} :: the gate opened and the move did NOT land — ${bad}`); continue; }
  }
  PASS(`${arm.why} :: immune=${r.immune}${arm.effect && !r.immune ? ', effect landed' : ''}`);
}

console.log('');
if (RED) {
  if (fails) { console.log(`RED DEMONSTRATION OK — ${fails} arm(s) failed under the inverted condition.`); process.exit(0); }
  console.log('RED DEMONSTRATION FAILED — inverting every condition changed nothing, so this file is asserting nothing.');
  process.exit(1);
}
if (fails) { console.log(`FAIL — ${fails} problem(s).`); process.exit(1); }
console.log(`PASS — ${AUTHORITY.size} gates derived, ${ARMS.length} arms agree with the authority.`);
