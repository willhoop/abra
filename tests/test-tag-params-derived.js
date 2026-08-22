/* test-tag-params-derived.js — IS A TAG'S PARAMETER A NUMBER A CONSUMER CAN USE, OR A SENTENCE?
 *
 *   SHOWDOWN_PATH=... node tests/test-tag-params-derived.js
 *   SHOWDOWN_PATH=... node tests/test-tag-params-derived.js --tags <file>   (point it at an older copy)
 *
 * ================= THE SHAPE OF DEFECT THIS FILE IS FOR =========================================
 *
 * A fact that lives in a HANDLER rather than a declarative field does not reach `data/tags.json` by
 * itself. When it half-arrives — the multiplier machine-readable, the cost written out in English —
 * the tag LOOKS complete, the roster credits the entity clean, and no consumer can act on it. Three
 * instances were filed together and two of them are checked here.
 *
 * A. LIFE ORB'S COST WAS PROSE. `damageMultAll` on `lifeorb` read
 *        { "mult": 1.3, "costsPerAttack": "1/10 max HP" }
 *    The divisor was already being READ off `onAfterMoveSecondarySelf` and then formatted away into a
 *    sentence on the last line of the deriver. `tests/mutation_harness.js` had already measured the
 *    consequence exactly: mutating that string to "ZZ-MUTANT-ZZ" changed 0 of 40 games —
 *    READ-AND-IGNORED, DEFECT-CANDIDATE — because the recoil branches on `m.item === 'lifeorb'` by
 *    NAME. Life Orb is in 17,168 of 19,401 bo3 games.
 *
 * B. A DRAIN'S SCHEDULE WAS ABSENT. `drain` carried a fraction and nothing that said WHEN it applies,
 *    so a consumer is free to sum a spread move's damage and heal once. The authority heals INSIDE
 *    the per-target loop and rounds each time (`sim/battle.ts:2168`), and
 *        round(a/2) + round(b/2)  !=  round((a+b)/2)   whenever a and b are both odd.
 *    Matcha Gotcha is 8,182 corpus uses and hits both foes.
 *
 * C. GUARD DOG WAS REPORTED AS A THIRD INSTANCE AND IS NOT ONE. Its absence is the legality filter
 *    (ROADMAP #175, Will: "if no legal species, then toss it man"), not a missing derivation — see
 *    the third block below, which proves the two handlers are the same shape so any rule matching one
 *    matches the other.
 *
 * ================= NOTHING HERE TYPES AN EXPECTED NUMBER ========================================
 *
 * Each numeric claim is played out in the OFFICIAL simulator and the tag's own parameters are used to
 * PREDICT what it did. The HP Life Orb takes is read off the battle, not asserted; the HP a drain
 * returns is read off the battle, not asserted. The tag is the hypothesis and Showdown is the answer.
 *
 * The drain block additionally SEARCHES for a turn on which the two candidate models disagree, and
 * FAILS if it cannot find one — a demonstration that could not be staged is a claim about the fixture,
 * never a pass.
 *
 * This file loads NO part of `engine/medicham2-browser.js` and does not require
 * `engine/game_differential.js`.
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
const fnsrc = h => String(h == null ? '' : h).replace(/\s+/g, ' ');

const tagsArg = process.argv.indexOf('--tags');
const TAGS_PATH = tagsArg >= 0 ? process.argv[tagsArg + 1] : D('data', 'tags.json');
const TAGS = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));

let fails = 0;
const FAIL = (msg) => { console.log('  FAIL  ' + msg); fails++; };
const PASS = (msg) => console.log('  ok    ' + msg);

console.log('DERIVED TAG PARAMETERS — a number a consumer can use, or a sentence');
console.log('  tags       ' + TAGS_PATH);
console.log('  generated  ' + TAGS.generated);
console.log('');

/* ---- SHARED STAGING ------------------------------------------------------------------------- */
const legalSpecies = s => s && s.exists && !s.isNonstandard && s.tier !== 'Illegal'
  && !s.battleOnly && !s.requiredItem && !s.forme.includes('Mega');
const SPECIES = dex.species.all().filter(legalSpecies);
const legalMove = m => m && m.exists && !m.isNonstandard;

function mkSet(species, move, opts) {
  const sp = dex.species.get(species);
  return { name: species, species, item: (opts && opts.item) || '',
           ability: (opts && opts.ability) || sp.abilities[0],
           moves: [move], nature: 'Serious',
           evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 };
}
const FILLER = ['Ditto', 'Ditto', 'Ditto'];
/* Recycle: legal, present, and FAILS with no consumed item — see champions_sim's own header. */
const SILENCE = CS.INERT_MOVE;

/* p1 slot a acts. Every other slot is silenced. Returns the log slice plus before/after HP. */
function playTurn(o) {
  const teamA = [mkSet(o.att, o.move, o.attOpts), ...FILLER.map(f => mkSet(f, SILENCE))];
  const teamB = [mkSet(o.defA, SILENCE, o.defOpts), mkSet(o.defB || o.defA, SILENCE),
                 ...FILLER.slice(0, 2).map(f => mkSet(f, SILENCE))];
  const battle = new Battle({ formatid: CS.FORMAT, seed: o.seed || [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  const user = battle.p1.active[0];
  const foes = [battle.p2.active[0], battle.p2.active[1]];
  if (o.prep) o.prep(user, foes);
  const before = { user: user.hp, foes: foes.map(f => f.hp) };
  const from = battle.log.length;
  const aim = dex.moves.get(o.move).target === 'normal' ? 'move 1 1' : 'move 1';
  if (!battle.choose('p1', aim + ', move 1')) throw new Error('p1 choice rejected for ' + o.move);
  if (!battle.choose('p2', 'move 1, move 1')) throw new Error('p2 choice rejected');
  if (battle.turn < 2) throw new Error('the staged turn never resolved');
  return { log: battle.log.slice(from), user, foes, before,
           after: { user: user.hp, foes: foes.map(f => f.hp) } };
}

/* =============================================================== A. LIFE ORB'S COST ============ */
console.log('A. LIFE ORB — the recoil as a number');
const LO = TAGS.items.lifeorb && TAGS.items.lifeorb.params && TAGS.items.lifeorb.params.damageMultAll;
if (!LO) FAIL('no damageMultAll param on lifeorb at all');
else if (!LO.cost) {
  FAIL('damageMultAll carries no machine-readable `cost` — only ' + JSON.stringify(LO.costsPerAttack)
     + ', which is a sentence. Nothing can derive the recoil from it.');
} else {
  for (const k of ['of', 'divisor', 'fraction', 'rounding', 'min', 'hook']) {
    if (LO.cost[k] === undefined) FAIL(`cost.${k} is missing`);
  }
  if (typeof LO.cost.divisor !== 'number') FAIL('cost.divisor is not a number: ' + JSON.stringify(LO.cost.divisor));
  if (!Array.isArray(LO.cost.onlyWhen) || !LO.cost.onlyWhen.length)
    FAIL('cost.onlyWhen is empty — the handler\'s guard conjuncts were not read');
  else PASS('cost = ' + JSON.stringify(LO.cost));

  /* THE ORACLE. A damaging click, and the HP the holder loses is READ off the battle. */
  const ATTACKER = SPECIES.find(s => s.baseStats.hp >= 60 && s.gender !== 'N').name;
  const HITTER = dex.moves.all().find(m => legalMove(m) && m.category !== 'Status' && m.target === 'normal'
    && m.basePower >= 40 && m.basePower <= 100 && !m.drain && !m.recoil && !m.multihit
    && !m.secondary && !m.secondaries && m.accuracy === true);
  /* A SELF-BOOST THAT COSTS NOTHING. The first pick here was Clangorous Soul, which pays 1/3 of its
   * own max HP, and the run read that as Life Orb charging for a Status click — a fixture defect that
   * would have been reported as a tag defect. Anything carrying a handler is excluded: the whole point
   * of this arm is a click with NO HP consequence except the one under test. */
  const BOOSTER = dex.moves.all().find(m => legalMove(m) && m.category === 'Status' && m.target === 'self'
    && m.boosts && Object.values(m.boosts).every(v => v > 0)
    && !m.onHit && !m.onTry && !m.onTryHit && !m.onTryMove && !m.onModifyMove && !m.condition);
  if (!HITTER || !BOOSTER) FAIL('could not derive a plain attack and a self-boost from the format');
  else {
    console.log(`  staged with ${ATTACKER} + ${HITTER.name} (attack) and ${BOOSTER.name} (status)`);
    const hit = playTurn({ att: ATTACKER, move: HITTER.name, attOpts: { item: 'Life Orb' },
      defA: ATTACKER, prep: (u) => { u.hp = u.maxhp; } });
    const orbLines = hit.log.filter(l => /\|-damage\|/.test(l) && /item: Life Orb/.test(l));
    const lost = hit.before.user - hit.after.user;
    const predicted = Math.max(LO.cost.min, Math.trunc(hit.user.baseMaxhp / LO.cost.divisor));
    if (!orbLines.length) FAIL('the authority charged NO Life Orb recoil on a damaging click — the fixture is wrong');
    else if (lost !== predicted) FAIL(`the holder lost ${lost} HP; the tag's parameters predict ${predicted}`);
    else PASS(`damaging click: holder lost ${lost} HP, tag predicts trunc(${hit.user.baseMaxhp}/${LO.cost.divisor}) = ${predicted}`);
    if (LO.cost.of !== 'baseMaxhp' && LO.cost.of !== 'maxhp') FAIL('cost.of names no HP field: ' + LO.cost.of);

    /* THE GATE. `move.category !== "Status"` is one of the conjuncts read off the handler; a consumer
     * that ignored it would charge the holder for clicking a boost. */
    const st = playTurn({ att: ATTACKER, move: BOOSTER.name, attOpts: { item: 'Life Orb' }, defA: ATTACKER });
    const stLost = st.before.user - st.after.user;
    const gateSaysStatusIsFree = LO.cost.onlyWhen.some(c => /category\s*!==?\s*["']Status["']/.test(c));
    if (stLost !== 0) FAIL(`a STATUS click cost the holder ${stLost} HP — the staging is wrong, not the tag`);
    else if (!gateSaysStatusIsFree) FAIL('the authority charges nothing for a Status click and no conjunct in '
      + 'cost.onlyWhen says so: ' + JSON.stringify(LO.cost.onlyWhen));
    else PASS('status click: holder lost 0 HP, and cost.onlyWhen carries the category conjunct');
  }
}
console.log('');

/* =============================================================== B. THE DRAIN SCHEDULE ========= */
console.log('B. SPREAD DRAIN — per target, or merged');
const SPREAD_DRAIN = dex.moves.all().filter(m => legalMove(m) && m.drain &&
  (m.target === 'allAdjacentFoes' || m.target === 'allAdjacent'));
console.log('  legal spread-drain moves, derived: '
  + SPREAD_DRAIN.map(m => `${m.name} (${(TAGS.moves[m.id] || {}).uses || 0} uses)`).join(', '));
if (!SPREAD_DRAIN.length) FAIL('no legal spread-drain move — the fixture cannot be built');

for (const mv of SPREAD_DRAIN) {
  const p = TAGS.moves[mv.id] && TAGS.moves[mv.id].params && TAGS.moves[mv.id].params.drain;
  if (!p) { FAIL(`${mv.id}: no drain param`); continue; }
  if (p.perTarget === undefined) {
    FAIL(`${mv.id}: the drain param says nothing about WHEN the heal applies — ${JSON.stringify(p)}. `
       + 'A consumer is free to sum the spread and heal once, which is 1 HP short whenever both hits are odd.');
    continue;
  }
  if (p.perTarget !== true) { FAIL(`${mv.id}: perTarget is ${p.perTarget}; the authority heals inside the loop`); continue; }
  if (typeof p.num !== 'number' || typeof p.den !== 'number')
    { FAIL(`${mv.id}: the fraction is not carried as a rational (num/den), so a consumer must round a pre-divided float`); continue; }
  if (p.rounding !== 'round') { FAIL(`${mv.id}: rounding is ${p.rounding}; the authority uses Math.round`); continue; }
  PASS(`${mv.id.padEnd(15)} ${JSON.stringify({ perTarget: p.perTarget, num: p.num, den: p.den, rounding: p.rounding, over: p.over })}`);
}

/* THE ORACLE, plus the search for a turn where the two models part.
 *
 * THE DAMAGE IS READ OFF THE MOVE'S OWN `-damage` LINES, NOT OFF before/after HP. This file got that
 * wrong first, and in a way that produced a plausible number rather than an error: Matcha Gotcha
 * carries a 20% burn, so a burned target's END-OF-TURN residue was folded into "how much the move
 * dealt" and the per-target model was compared against 21 damage where the move had dealt 12. The
 * per-target model then looked broken. Attributing that to the tag would have been the whole failure
 * this pass is about, pointed the other way.
 *
 * `|split|` DUPLICATES EVERY HP LINE — one exact, one as a percentage — so an undeduplicated count
 * reports FOUR drain heals for two targets and "per target" looks refuted. The line after a `|split|`
 * is the exact one; the line after that is the public copy and is dropped. */
const MG = SPREAD_DRAIN[0];
const P = MG ? (TAGS.moves[MG.id].params.drain || {}) : {};
if (MG && typeof P.num === 'number' && typeof P.den === 'number') {
  const num = P.num, den = P.den;
  const perTargetModel = ds => ds.reduce((a, d) => a + Math.round(d * num / den), 0);
  const mergedModel = ds => Math.round(ds.reduce((a, d) => a + d, 0) * num / den);
  const dedupe = (log) => {
    const out = []; let skip = false;
    for (const l of log) {
      if (l.startsWith('|split|')) { skip = false; out.push(l); continue; }
      if (out.length && out[out.length - 1].startsWith('|split|')) { out.push(l); skip = true; continue; }
      if (skip) { skip = false; continue; }
      out.push(l);
    }
    return out;
  };
  /* TWO DIFFERENT DEFENDERS so the two hits land for different amounts; the user is dropped to 1 HP so
   * the heal is never clamped at full and the whole amount is observable. */
  const A = SPECIES.find(s => s.baseStats.spa >= 90).name;
  let checked = 0, agreed = 0, parted = null, interleaved = 0;
  const pool = SPECIES.filter(s => s.baseStats.hp >= 60).slice(0, 16);
  for (let i = 0; i < pool.length && !parted; i++) {
    for (let j = i + 1; j < pool.length && !parted; j++) {
      let r;
      try {
        r = playTurn({ att: A, move: MG.name, defA: pool[i].name, defB: pool[j].name,
          seed: [i + 1, j + 1, 7, 9], prep: (u) => { u.hp = 1; } });
      } catch (e) { continue; }
      const log = dedupe(r.log);
      const dmgIx = [], ds = [];
      const healIx = [], healHp = [];
      log.forEach((l, ix) => {
        let m = /^\|-damage\|(p2[ab]): [^|]+\|(\d+)\/(\d+)$/.exec(l);   /* no `[from]`: the move itself */
        if (m) { dmgIx.push(ix); ds.push(+m[3] - +m[2]); return; }
        m = /^\|-heal\|p1a: [^|]+\|(\d+)\/\d+\|\[from\] drain\|\[of\] (p2[ab]):/.exec(l);
        if (m) { healIx.push(ix); healHp.push(+m[1]); }
      });
      if (ds.length < 2 || healHp.length < 1) continue;
      checked++;
      if (healHp.length !== ds.length)
        FAIL(`${MG.name}: ${healHp.length} drain heals for ${ds.length} damaged targets — "per target" is `
           + 'not what the stream shows');
      /* INTERLEAVED: the first target's heal lands BEFORE the second target's damage. A merged heal
       * cannot produce this ordering, so it is the schedule observed rather than inferred. */
      if (healIx[0] < dmgIx[1]) interleaved++;
      else FAIL(`${MG.name}: the first drain heal lands AFTER the second target's damage — not interleaved`);
      const healed = healHp[healHp.length - 1] - r.before.user;
      if (healed === perTargetModel(ds)) agreed++;
      else FAIL(`${MG.name}: authority healed ${healed}; per-target model says ${perTargetModel(ds)} (damages ${ds})`);
      if (perTargetModel(ds) !== mergedModel(ds)) parted = { ds, healed };
    }
  }
  if (!checked) FAIL(`${MG.name}: no two-target turn could be staged — this is a claim about the fixture, not a pass`);
  else if (!parted) FAIL(`${MG.name}: ${checked} two-target turns staged and the merged model never differed, so `
    + 'this run did not actually demonstrate the arithmetic. Not a pass.');
  else PASS(`${checked} two-target turns, ${agreed} matched the per-target model, ${interleaved} interleaved; the `
    + `merged model is WRONG on damages ${JSON.stringify(parted.ds)} — authority healed ${parted.healed}, merged `
    + `says ${mergedModel(parted.ds)}`);
} else if (MG) {
  console.log('  (the oracle is not run: the drain param carries no num/den, so there is no model to test)');
}
console.log('');

/* =============================================================== C. GUARD DOG =================== */
console.log('C. onDragOut — the artifact against the authority, and what the legality filter drops');
const carriersOf = id => SPECIES.filter(s => Object.values(s.abilities || {}).some(a => norm(a) === norm(id)))
  .map(s => s.name);
const DRAGOUT = dex.abilities.all().filter(a => a && a.exists && !a.isNonstandard && a.onDragOut);
console.log('  abilities with onDragOut in the whole authority: '
  + DRAGOUT.map(a => `${a.name} [${carriersOf(a.id).length} legal carrier(s)]`).join(', '));
const TAGGED = new Set(Object.entries(TAGS.abilities)
  .filter(([, r]) => (r.tags || []).includes('refusesForcedSwitch')).map(([id]) => id));
for (const a of DRAGOUT) {
  const has = carriersOf(a.id).length > 0;
  if (has && !TAGGED.has(a.id)) FAIL(`${a.name} has a legal carrier and NO refusesForcedSwitch row`);
  if (!has && TAGGED.has(a.id)) FAIL(`${a.name} has no legal carrier and IS tagged — the legality filter leaked`);
}
for (const id of TAGGED) {
  const a = dex.abilities.get(id);
  if (!a.onDragOut) FAIL(`${id} is tagged refusesForcedSwitch and the authority gives it NO onDragOut — OVER-MATCH`);
}
if (!DRAGOUT.length) FAIL('the authority reports ZERO onDragOut abilities — the probe is broken, not the format');
else PASS(`${TAGGED.size} tagged, ${DRAGOUT.filter(a => carriersOf(a.id).length).length} with a legal carrier — equal, both directions`);

/* THE CLAIM THAT GUARD DOG NEEDS NO EDIT. Not "the predicate matches it" — that would be a second copy
 * of the predicate living here. The two handlers are compared with their own ability NAME stripped: if
 * they are the same source, any shape rule that matches one matches the other, whatever the rule is. */
const GD = dex.abilities.get('guarddog'), SC = dex.abilities.get('suctioncups');
if (!GD.exists || !SC.exists) FAIL('one of the two onDragOut abilities is absent from this format');
else {
  const strip = a => fnsrc(a.onDragOut).replace(/["'][^"']*["']/g, '"NAME"');
  if (strip(GD) !== strip(SC))
    FAIL('Guard Dog and Suction Cups no longer share an onDragOut shape, so Guard Dog\'s absence can no '
       + `longer be attributed to the legality filter alone:\n      GD ${strip(GD)}\n      SC ${strip(SC)}`);
  else PASS('Guard Dog\'s onDragOut is byte-identical to Suction Cups\' once the name is stripped — so the '
    + `derivation already covers it, and its absence is the legality filter (${carriersOf('guarddog').length} legal carriers)`);
}

console.log('');
if (fails) { console.log(`FAIL — ${fails} problem(s).`); process.exit(1); }
console.log('PASS — every parameter above is a number the authority confirms.');
