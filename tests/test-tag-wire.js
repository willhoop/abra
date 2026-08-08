/* test-tag-wire.js — does each WIRED tag actually change a damage number?
 *
 *   node tests/test-tag-wire.js
 *
 * WHY THIS IS SEPARATE FROM test-wiring.js. That file proves a capability RAN. This one proves a
 * wired tag CHANGED THE ANSWER, which is stricter: 65 of the 172 tags were reported "read" purely
 * because their probe string appeared somewhere in the engine, and every one of those turned out to
 * be an independent hardcode rather than anything driven by the artifact. Life Orb read as wired
 * because `att.item==='lifeorb'` contains the word.
 *
 * THE BAR. Build the same attacker twice, differing only in the thing the tag describes, and assert
 * the damage moves by the factor THE TAG ITSELF declares. Not a factor typed here -- the expected
 * value is read from data/tags.json, so the test cannot drift from the artifact and cannot be
 * quietly satisfied by a number someone hardcoded to match.
 *
 * The first version of this file passed while proving nothing: it checked the tag existed in the
 * artifact and never called the damage engine, because MC was not in scope. A vacuous check inside
 * the file written to prevent vacuous checks. Loading engine-data.js is what fixed it.
 *
 * Tags are added here ONE AT A TIME as they are wired. The mechanics batch shipped ~20 mechanics
 * together, measured +0.0, and nobody could say which of the 20 was wrong.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));          // sets globalThis.MC and mcEff
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const TAGS = require(path.join(ROOT, 'engine', 'tags.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); c ? pass++ : fail++; };

const FIELD = { terrain: '', weather: '', twA: 0, twB: 0 };

/* Max damage of `attacker` holding `item` into `defender` with `moveId`. Max, not min, because it
 * is a single deterministic roll and avoids floor() noise at the bottom of the range. */
function dmg(attacker, defender, moveId, item) {
  const a = M.buildMon(attacker, { [attacker]: item });
  const d = M.buildMon(defender, { [defender]: '' });
  const mv = MC.moves[moveId];
  if (!a || !d || !mv) return null;
  const r = M.dmgRange(a, d, mv, FIELD, false);
  return r ? r.max : null;
}

/* Ratio of damage with the item against damage with no item at all. */
function ratio(attacker, defender, moveId, item) {
  const with_ = dmg(attacker, defender, moveId, item);
  const without = dmg(attacker, defender, moveId, '');
  if (!with_ || !without) return null;
  return with_ / without;
}

console.log('TAG WIRE — does the artifact actually move the number?\n');

/* ---- WIRE 1: damageMultAll (Life Orb) -------------------------------------------------------- */
console.log('wire 1 — damageMultAll');
{
  const p = TAGS.param('item', 'lifeorb', 'damageMultAll');
  if (!p) ok(false, 'Life Orb carries damageMultAll in the artifact');
  else {
    const r = ratio('garchomp', 'incineroar', 'earthquake', 'lifeorb');
    if (r == null) ok(false, 'could not build the Garchomp/Incineroar pair');
    else ok(Math.abs(r - p.mult) < 0.03,
      `Life Orb moves damage by x${r.toFixed(3)}, artifact declares x${p.mult}`);
    /* The cost IS applied, as a hardcode in the battle loop (`m.curHP-=Math.floor(m.st.hp*0.1)`),
     * not from the tag. So the behaviour is right and the wire is half done -- worth stating
     * precisely rather than claiming the cost is missing, which is what I said first. */
    console.log(`        note: ${p.costsPerAttack} is applied in the battle loop as a hardcode, not from this tag`);
  }
}

/* ---- WIRE 2: damageMultType (18 type-boost items, previously ABSENT) ------------------------- */
console.log('\nwire 2 — damageMultType');
{
  const db = require(path.join(ROOT, 'data', 'tags.json'));
  const members = Object.entries(db.items).filter(([, r]) => (r.tags || []).includes('damageMultType'));
  ok(members.length >= 15, `${members.length} type-boost items derived from handlers (was a 24-name regex)`);

  /* Black Glasses on a Dark move must move; on a non-Dark move it must NOT. Both directions,
   * because a wire that multiplies everything would pass a one-sided check. */
  const p = TAGS.param('item', 'blackglasses', 'damageMultType');
  if (!p) ok(false, 'Black Glasses carries damageMultType');
  else {
    const onType = ratio('kingambit', 'incineroar', 'knockoff', 'blackglasses');
    if (onType == null) ok(false, 'could not build the Kingambit/Incineroar pair');
    else ok(Math.abs(onType - p.mult) < 0.03,
      `Black Glasses on a ${p.onType} move: x${onType.toFixed(3)}, artifact declares x${p.mult}`);

    const offType = ratio('kingambit', 'incineroar', 'ironhead', 'blackglasses');
    if (offType != null)
      ok(Math.abs(offType - 1) < 0.03,
        `Black Glasses on a NON-${p.onType} move leaves damage alone (x${offType.toFixed(3)})`);
  }

  /* A second item, different type, to prove the wire reads the tag rather than one special case. */
  const c = TAGS.param('item', 'charcoal', 'damageMultType');
  if (c) {
    const r = ratio('incineroar', 'garchomp', 'flareblitz', 'charcoal');
    if (r != null) ok(Math.abs(r - c.mult) < 0.03,
      `Charcoal on a ${c.onType} move: x${r.toFixed(3)}, artifact declares x${c.mult}`);
  }
}

/* ---- WIRE 3: resistBerry (6,479 holders, previously ABSENT) ---------------------------------- */
console.log('\nwire 3 — resistBerry');
{
  const db = require(path.join(ROOT, 'data', 'tags.json'));
  const members = Object.entries(db.items).filter(([, r]) => (r.tags || []).includes('resistBerry'));
  ok(members.length >= 15, `${members.length} resist berries, each carrying its own type`);

  /* Defender-side, so the ratio is measured by giving the DEFENDER the berry. */
  function defRatio(attacker, defender, moveId, item) {
    const a = M.buildMon(attacker, { [attacker]: '' });
    const dBare = M.buildMon(defender, { [defender]: '' });
    const dHeld = M.buildMon(defender, { [defender]: item });
    const mv = MC.moves[moveId];
    if (!a || !dBare || !dHeld || !mv) return null;
    const x = M.dmgRange(a, dBare, mv, FIELD, false);
    const y = M.dmgRange(a, dHeld, mv, FIELD, false);
    if (!x || !x.max) return null;
    return { ratio: y.max / x.max, eff: x.eff };
  }

  /* Colbur halves DARK, so the pair needs a DARK-WEAK defender. The first attempt used Knock Off
   * into Incineroar, which is Dark into Dark and RESISTS at 0.5x -- the test refused to pass on it
   * rather than quietly reporting a wire as dead, which is the behaviour worth keeping. Gholdengo
   * is Steel/Ghost and takes Dark at 2x. */
  const p = TAGS.param('item', 'colburberry', 'resistBerry');
  if (!p) ok(false, 'Colbur Berry carries resistBerry');
  else {
    const r = defRatio('incineroar', 'gholdengo', 'crunch', 'colburberry');
    if (!r) ok(false, 'could not build the pair for Colbur');
    else if (r.eff <= 1) ok(false, `the test move is not super effective (eff ${r.eff}) — pick another pair`);
    else ok(Math.abs(r.ratio - p.mult) < 0.03,
      `Colbur halves a super-effective ${p.onType} hit: x${r.ratio.toFixed(3)}, artifact declares x${p.mult}`);

    /* And it must NOT touch a move of another type — a wire that halved everything would pass above. */
    const off = defRatio('incineroar', 'gholdengo', 'flareblitz', 'colburberry');
    if (off) ok(Math.abs(off.ratio - 1) < 0.03,
      `Colbur leaves a non-${p.onType} move alone (x${off.ratio.toFixed(3)})`);
  }

  /* PURITY: scoring a move must not eat the berry. dmgRange runs on hypothetical moves dozens of
   * times a turn, and a mutation there would consume it during attacks that never happen. */
  const d = M.buildMon('gholdengo', { gholdengo: 'colburberry' });
  const a2 = M.buildMon('incineroar', { incineroar: '' });
  for (let i = 0; i < 5; i++) M.dmgRange(a2, d, MC.moves.crunch, FIELD, false);
  ok(d.item === 'colburberry', 'calling dmgRange five times does NOT consume the berry');
}

/* ---- WIRES 4+5: buffsHolderOnHit and punishesAttacker, one `contact` dispatch ---------------- */
console.log('\nwires 4+5 — buffsHolderOnHit / punishesAttacker  (THE BELLIBOLT TURN)');
{
  const b = TAGS.param('ability', 'stamina', 'buffsHolderOnHit');
  ok(b && b.boosts && b.boosts.def === 1,
    `Stamina's boost is derived from its handler: ${JSON.stringify(b && b.boosts)}`);
  const j = TAGS.param('ability', 'justified', 'buffsHolderOnHit');
  ok(j && j.boosts && j.boosts.atk === 1,
    `Justified is a DIFFERENT stat, proving the wire reads the tag: ${JSON.stringify(j && j.boosts)}`);

  const p = TAGS.param('ability', 'roughskin', 'punishesAttacker');
  ok(p && +p.fraction === 8, `Rough Skin charges 1/${p && p.fraction} of the attacker's max HP`);

  /* Contact must come from the move's own flag, not a list. Both directions. */
  ok(TAGS.has('move', 'knockoff', 'contact') && !TAGS.has('move', 'earthquake', 'contact'),
    'contact is read per-move from the artifact (Knock Off yes, Earthquake no)');

  /* The two tags must be DISJOINT in what they imply: one compounds, one does not. If a single
   * ability carried both flags with the same meaning the split Will asked for would be pointless. */
  ok(b.compounds === true && p.compounds === false,
    'the split holds: buffsHolderOnHit compounds, punishesAttacker does not');

  /* END TO END, and this is the check that actually matters. Everything above reads the artifact;
   * none of it proves the battle loop executes the wire. The same gap let the first version of this
   * file pass while calling no engine code at all.
   *
   * Mudsdale carries Stamina and is the Pokemon from Will's own losing turn. Play real battles and
   * assert its Defense stage rises at least once -- a boost NOBODY CLICKED, which is precisely what
   * the bot could not previously see. */
  if (MC.mons.mudsdale && typeof M.battle === 'function') {
    let sawBoost = false, ran = 0;
    /* 40 SEEDS WAS UNDERPOWERED FOR A RARE EVENT, and the rebuild from real sheets exposed it.
     * Stamina needs Mudsdale to SURVIVE a qualifying hit and still be on the field afterwards. With
     * the old fictional sets that happened within 4 seeds; with the real ones Mudsdale is knocked out
     * faster and the measured rate is 4 in 300 (1.3%) — the wire is fine, the sample was not. The
     * seed sequence is deterministic, so this is reproducible rather than flaky, but the margin is
     * now large enough that an ordinary shift in battle dynamics will not break it again. */
    for (let seed = 0; seed < 300 && !sawBoost; seed++) {
      /* Math.imul, not naked multiplication — the float LCG idiom loses low bits past 2^53 and is
       * exactly what tests/test-prng.js bans; it caught this file using it. */
      let s = (seed * 2654435761 + 12345) >>> 0;
      const rng = () => (((s = (Math.imul(s, 1103515245) + 12345) >>> 0) & 0x7fffffff) / 0x80000000);
      const mk = names => names.map(n => M.buildMon(n, {})).filter(Boolean);
      const A = mk(['mudsdale', 'incineroar', 'garchomp', 'gholdengo']);
      /* FORCE THE ABILITY. This check exists to prove the Stamina TAG is wired into the battle loop,
       * not to observe what the metagame happens to run. It used to pass only because the old
       * engine-data table asserted Mudsdale had Stamina; the real sheets say Inner Focus in all of
       * its top three sets (61 observations), so rebuilding from real data silently deleted the only
       * coverage this wire had. Setting it here makes the test about the engine again. */
      if (A[0]) { A[0].ability = 'stamina'; A[0].baseAbility = 'stamina'; }
      const B = mk(['kingambit', 'incineroar', 'garchomp', 'whimsicott']);
      if (A.length < 2 || B.length < 2) break;
      ran++;
      try { M.battle(A, B, {}, rng); } catch (e) { break; }
      if (A[0] && A[0].boosts && A[0].boosts.df > 0) sawBoost = true;
    }
    ok(sawBoost, `Stamina raised Mudsdale's Defense in a real battle without anyone clicking a boost (${ran} games)`);
  }
}

/* ---- WIRE 6: punishesAttacker COMPLETE — trigger, inflicts, boosts, faint gate --------------- */
console.log('\nwire 6 — punishesAttacker complete');
{
  /* One controlled 1v1: the attacker's move is fixed, the holder's move is chosen to be IMMUNE
   * against the attacker (Ground into a Flying body, Electric into a Ground body), so every HP
   * point and boost stage the attacker loses is the punishment and nothing else. rng is a constant,
   * which pins the damage roll, the crit roll and the status roll. */
  const one = (attacker, atkMove, holderAbility, holderMove, rngVal, holderHP) => {
    const a = M.buildMon(attacker, {}); const h = M.buildMon('incineroar', {});
    if (!a || !h) return null;
    a.moves = [atkMove]; a.item = '';
    h.moves = [holderMove]; h.item = ''; h.ability = holderAbility;
    h.st = Object.assign({}, h.st, { hp: holderHP }); h.curHP = holderHP;
    /* The behaviour clone samples what the SPECIES really clicks, ignoring me.moves -- correct in
     * play, fatal in a controlled experiment. Silence the priors for these two species so the only
     * moves in the battle are the two this test chose, then put them back. */
    const saved = {}; for (const n of [a.name, h.name]) { saved[n] = MC.priors[n]; MC.priors[n] = null; }
    try { M.battle([a], [h], {}, () => rngVal); }
    finally { for (const n in saved) MC.priors[n] = saved[n]; }
    return a;
  };

  /* Aftermath: the artifact must declare the faint gate the handler states, and the engine must
   * obey it — the first wire chipped 25% on EVERY contact hit into an Aftermath body. */
  const pAM = TAGS.param('ability', 'aftermath', 'punishesAttacker');
  ok(pAM && pAM.trigger === 'contact' && pAM.onFaintOnly === true,
    'Aftermath declares contact + onFaintOnly (was: fraction with no trigger at all)');
  const surv = one('corviknight', 'ironhead', 'aftermath', 'earthquake', 0.5, 99999);
  ok(surv && surv.curHP === surv.st.hp,
    `contact into a SURVIVING Aftermath body costs nothing (HP ${surv && surv.curHP}/${surv && surv.st.hp})`);
  const kill = one('corviknight', 'ironhead', 'aftermath', 'earthquake', 0.5, 1);
  const toll = kill && (kill.st.hp - kill.curHP);
  ok(kill && toll === Math.floor(kill.st.hp / +pAM.fraction),
    `KILLING it costs 1/${pAM && pAM.fraction} of max HP (paid ${toll})`);

  /* Effect Spore: the old artifact said "sleep, chance 1". The handler is one random(100) split
   * 11/10/9 — the entries must be there, and the total must be the real 30% proc rate. */
  const pES = TAGS.param('ability', 'effectspore', 'punishesAttacker');
  const tot = pES && pES.inflicts ? pES.inflicts.reduce((s, i) => s + i.chance, 0) : 0;
  ok(pES && pES.inflicts && pES.inflicts.length === 3 && Math.abs(tot - 0.30) < 1e-9,
    `Effect Spore carries ${pES && pES.inflicts && pES.inflicts.length} statuses totalling ${(tot * 100).toFixed(0)}% (was: 100% sleep)`);
  /* rng 0.15 lands in the paralysis band (0.11–0.21) and never wakes/full-paras out of it. */
  const es = one('garchomp', 'ironhead', 'effectspore', 'thunderbolt', 0.15, 99999);
  ok(es && es.status === 'par', `the 0.15 roll paralyses the attacker (band 2 of the split), got '${es && es.status}'`);

  /* Static at 30%: a 0.1 roll procs, and the artifact — not the engine — names paralysis. */
  const st = one('corviknight', 'ironhead', 'static', 'earthquake', 0.1, 99999);
  ok(st && st.status === 'par', `Static's 30% paralysis reaches a contact attacker, got '${st && st.status}'`);

  /* Gooey: 20 turns of contact into an immortal Gooey body must clamp speed at -6, read from the
   * artifact's own {spe:-1}. Before this wire Gooey carried NO parameter and did nothing. */
  const pGO = TAGS.param('ability', 'gooey', 'punishesAttacker');
  ok(pGO && pGO.boosts && pGO.boosts.spe === -1, 'Gooey carries {spe:-1} read from its own handler');
  const go = one('corviknight', 'ironhead', 'gooey', 'earthquake', 0.5, 99999);
  ok(go && go.boosts.sp === -6, `20 turns of contact drags the attacker to -6 speed (got ${go && go.boosts.sp})`);

  /* Spicy Spray: the hardcode it replaces burned only PHYSICAL attackers; the handler burns any
   * damaging hit. A special, non-contact move must now come back burned. */
  const sp = one('garchomp', 'dragonpulse', 'spicyspray', 'thunderbolt', 0.5, 99999);
  ok(sp && sp.status === 'brn', `a SPECIAL non-contact hit is burned back (got '${sp && sp.status}')`);

  /* Toxic Debris and the volatile inflicters: the artifact carries the full parameter, the engine
   * has no side-condition or volatile state to land them on. has() proves the carry. */
  const pTD = TAGS.param('ability', 'toxicdebris', 'punishesAttacker');
  ok(pTD && pTD.trigger === 'physical' && pTD.hazard === 'toxicspikes' && pTD.maxLayers === 2,
    'Toxic Debris declares physical-trigger toxicspikes, 2 layers (unconsumed: no side-condition state)');
  const pCB = TAGS.param('ability', 'cursedbody', 'punishesAttacker');
  ok(pCB && pCB.inflictsVolatile && pCB.inflictsVolatile.volatile === 'disable' && pCB.inflictsVolatile.chance === 0.3,
    'Cursed Body declares disable at 30% (unconsumed: no volatile state)');

  /* Gulp Missile must be SKIPPED: the punishment exists only in Surf/Dive formes this engine does
   * not model. A base-forme Cramorant that punishes would be a new wrong number. */
  const pGM = TAGS.param('ability', 'gulpmissile', 'punishesAttacker');
  ok(pGM && Array.isArray(pGM.requiresForme) && pGM.requiresForme.length === 2,
    'Gulp Missile carries its forme gate, so the engine skips it whole');
  const gm = one('corviknight', 'ironhead', 'gulpmissile', 'earthquake', 0.5, 99999);
  ok(gm && gm.curHP === gm.st.hp && gm.status === '',
    'a base-forme Gulp Missile body punishes nobody');
}

/* ---- WIRE 7: weatherScaled — the weather changes the move ------------------------------------ */
console.log('\nwire 7 — weatherScaled');
{
  const db = require(path.join(ROOT, 'data', 'tags.json'));
  const members = Object.keys(db.moves).filter(k => (db.moves[k].tags || []).includes('weatherScaled'));
  ok(members.length >= 10 && members.includes('solarbeam'),
    `${members.length} weather-scaled moves, and Solar Beam is finally a member (the old probe missed onBasePower)`);

  /* THE TARGET IS A PARAMETER, AND THE REASON IS A DEFECT THIS PROBE HAD. Incineroar is Fire/Dark,
   * so a Grass move into it is x0.5 and lands for 22 points at the top roll — where ONE damage point
   * is 4.5% and a 3% ratio tolerance cannot be met by any engine. Showdown's base-damage formula ends
   * `floor(...) + 2`, so halving the BASE POWER cannot halve the DAMAGE: the flat +2 survives. Before
   * ROADMAP #81 WIRE 4 this engine truncated a float and produced 11 (an exact 0.500) and the probe
   * passed on a rounding bug; WIRE 4 made it 12 (0.545) and the probe went red on a CORRECTED engine.
   * Verified against the frozen releases: `cf6a68fa412c` (pre-WIRE-4) 22 -> 11, `45485dee6a43`
   * (post) 22 -> 12. So the Solar Beam arm aims at a body that does not resist it, where the +2 is
   * 1.4% instead of 4.5% and the unchanged tolerance is meetable. The tolerance was NOT widened. */
  const inWeather = (moveId, weather, foe) => {
    const a = M.buildMon('garchomp', {}); const d = M.buildMon(foe || 'incineroar', {});
    const r = M.dmgRange(a, d, MC.moves[moveId], { terrain: '', weather, twA: 0, twB: 0 }, false);
    return r;
  };

  /* Weather Ball in sand must BE a Rock move at double power — the artifact names both. The type
   * override is visible in eff itself: Normal into Fire/Dark is x1, Rock into Fire/Dark is x2. */
  const wb = TAGS.param('move', 'weatherball', 'weatherScaled');
  const clear = inWeather('weatherball', '');
  const sand = inWeather('weatherball', 'sand');
  ok(wb && wb.byWeather && wb.byWeather.sand && wb.byWeather.sand.type === 'Rock' && wb.byWeather.sand.bpMult === 2,
    'artifact: sand makes Weather Ball a Rock move at x2 power');
  ok(clear.eff === 1 && sand.eff === 2,
    `the type override reaches effectiveness (clear x${clear.eff}, sand x${sand.eff} into Fire/Dark)`);
  ok(sand.max > clear.max * 3,
    `sand Weather Ball hits ${(sand.max / clear.max).toFixed(1)}x the clear-sky number (type + power together)`);

  /* Solar Beam sheds half its power in rain — and rain ALSO does not halve it twice over: the
   * artifact's 0.5 is the whole rain penalty for a Grass move (rain halves Fire, not Grass). */
  const sb = TAGS.param('move', 'solarbeam', 'weatherScaled');
  const sbClear = inWeather('solarbeam', '', 'milotic'), sbRain = inWeather('solarbeam', 'rain', 'milotic');
  const sbRatio = sbRain.max / sbClear.max;
  ok(sb && sb.byWeather && sb.byWeather.rain && sb.byWeather.rain.bpMult === 0.5,
    'artifact: rain halves Solar Beam');
  ok(Math.abs(sbRatio - 0.5) < 0.03,
    `rain Solar Beam lands at x${sbRatio.toFixed(3)} of clear-sky (into a Milotic, ${sbClear.max} -> ${sbRain.max})`);
  ok(sb.byWeather.sun && sb.byWeather.sun.chargeSkip === true,
    'the sun charge-skip is carried (unconsumed: this engine has no charge state)');

  /* Thunder: 70 in clear skies, TRUE in rain, 50 in sun. The number must come from the artifact
   * through moveAccuracy, which both the to-hit roll and the move scorer read. */
  const th = TAGS.param('move', 'thunder', 'weatherScaled');
  ok(th && th.byWeather.rain && th.byWeather.rain.accuracy === 100 && th.byWeather.sun && th.byWeather.sun.accuracy === 50,
    'artifact: Thunder is 100 in rain, 50 in sun');
  const accs = [M.moveAccuracy('thunder', { weather: '' }), M.moveAccuracy('thunder', { weather: 'rain' }), M.moveAccuracy('thunder', { weather: 'sun' })];
  ok(accs[0] === 70 && accs[1] === 100 && accs[2] === 50,
    `moveAccuracy says ${accs.join('/')} for clear/rain/sun (was 70 in every sky)`);
  const bl = M.moveAccuracy('blizzard', { weather: 'snow' });
  ok(bl === 100, `Blizzard is ${bl} in snow (was 70)`);
}

/* ---- WIRE 8: perTurnHP — Leech Seed's drain exists ------------------------------------------- */
console.log('\nwire 8 — perTurnHP');
{
  /* The artifact first: effect must be structured, not prose. The old param labelled Curse -- pure
   * damage -- as "created for the holder", which a consumer would have read as a 1/4-a-turn HEAL. */
  const pLS = TAGS.param('move', 'leechseed', 'perTurnHP');
  ok(pLS && pLS.effect === 'drain' && pLS.per === 8 && pLS.to === 'user' && pLS.immuneType === 'Grass',
    'Leech Seed: drain, 1/8 of the target, to the user, blocked by Grass — all from the handler');
  const pCU = TAGS.param('move', 'curse', 'perTurnHP');
  ok(pCU && pCU.effect === 'damage',
    `Curse is effect '${pCU && pCU.effect}' (the old artifact called it a heal for the holder)`);

  /* One controlled battle: the seeder ONLY clicks Leech Seed (forced through its priors, which is
   * the only path that clicks status moves), the victim cannot hurt it (Ground move into a Flying
   * body). Every HP point that moves is the seed. */
  const seedBattle = victimName => {
    const s = M.buildMon('corviknight', {}); const v = M.buildMon(victimName, {});
    if (!s || !v) return null;
    s.moves = ['leechseed']; s.item = '';
    v.moves = ['earthquake']; v.item = '';
    v.st = Object.assign({}, v.st, { hp: 99999 }); v.curHP = 99999;
    /* The seeder starts at 1 HP with a max too high to cap: whatever it ends with, minus the 1,
     * is exactly what the seed handed over. Conservation IS the amount check. */
    s.st = Object.assign({}, s.st, { hp: 200000 }); s.curHP = 1;
    const saved = { [s.name]: MC.priors[s.name], [v.name]: MC.priors[v.name] };
    MC.priors[s.name] = [['leechseed', 1, 'status']];
    MC.priors[v.name] = null;
    try { M.battle([s], [v], {}, () => 0.5); }
    finally { for (const n in saved) MC.priors[n] = saved[n]; }
    return { s, v };
  };
  const sb = seedBattle('garchomp');
  const lost = sb && (99999 - sb.v.curHP), gained = sb && (sb.s.curHP - 1);
  ok(sb && sb.v.fainted && lost === 99999,
    'the seed alone kills a victim that was never hit by an attack — the click was a no-op before');
  ok(sb && gained === lost,
    `every drained point reaches the seeder: victim -${lost}, seeder +${gained} (drain, not just chip)`);
  const gb = seedBattle('whimsicott');
  ok(gb && gb.v.curHP === 99999,
    `a ${pLS.immuneType}-type victim is immune, from the move's own onTryImmunity (${gb && (99999 - gb.v.curHP)} lost)`);
}

/* ---- WIRE 9: the death counter — Last Respects live, Supreme Overlord frozen ----------------- */
console.log('\nwire 9 — powerFromFallen / boostsFromFallen');
{
  const pLR = TAGS.param('move', 'lastrespects', 'powerFromFallen');
  ok(pLR && pLR.base === 50 && pLR.perFallen === 50 && pLR.counts === 'live',
    'Last Respects: 50 + 50 per death, read LIVE — was a flat 50 in the pool');
  const pSO = TAGS.param('ability', 'supremeoverlord', 'boostsFromFallen');
  ok(pSO && pSO.perFallen === 0.1 && pSO.max === 5 && pSO.countedAt === 'switch-in',
    'Supreme Overlord: +10% per fallen, max 5, SNAPSHOT at entry (Will: "then the status is tuck")');

  const F = { terrain: '', weather: '', twA: 0, twB: 0 };
  const att = M.buildMon('kingambit', {}), d0 = M.buildMon('garchomp', {});
  att.moves = ['lastrespects'];
  const fresh = M.dmgRange(att, d0, MC.moves.lastrespects, F, false).max;
  att._sf = { fainted: 3 };
  const grieving = M.dmgRange(att, d0, MC.moves.lastrespects, F, false).max;
  /* BP goes 50 -> 200 (x4) but damage is floor(floor(22*BP*A/D)/50)+2 — the +2 and the floors pull
   * the damage ratio a little under the BP ratio, so the bound is 3.5-4, not 4 exactly. */
  ok(grieving / fresh > 3.5 && grieving / fresh <= 4,
    `three dead allies make Last Respects x${(grieving / fresh).toFixed(2)} damage (BP 50 -> 200)`);

  att._sf = null; att.ability = 'supremeoverlord';
  const solo = M.dmgRange(att, d0, MC.moves.ironhead, F, false).max;
  att._fallenStuck = 5;
  const lord = M.dmgRange(att, d0, MC.moves.ironhead, F, false).max;
  ok(lord / solo > 1.42 && lord / solo < 1.58,
    `five fallen freeze Supreme Overlord at x${(lord / solo).toFixed(2)} (handler says x1.5)`);
}

/* ---- WIRE 10: on-entry field effects reach REPLACEMENTS -------------------------------------- */
console.log('\nwire 10 — entry effects on faint replacements');
{
  /* The bug Will's Solar Beam question exposed: a mid-game Drizzle entrant set no rain in any
   * rollout, because refill() applied only Intimidate. The helper is unit-tested directly, and the
   * setter members come from the artifact, not the old four-name list. */
  const f = { weather: null, weatherT: 0, terrain: '', terrainT: 0 };
  const pel = M.buildMon('pelipper', {});
  ok(pel && pel.ability === 'drizzle', `Pelipper carries Drizzle in the dataset (${pel && pel.ability})`);
  M.applyEntryEffects(pel, f);
  ok(f.weather === 'rain' && f.weatherT === 5, `a Drizzle entrant sets rain for 5 turns (got ${f.weather}/${f.weatherT})`);
  const tk = M.buildMon('torkoal', {});
  if (tk && tk.ability === 'drought') {
    M.applyEntryEffects(tk, f);
    ok(f.weather === 'sun', 'a Drought entrant OVERRIDES standing rain, as the real setWeather does');
  }
  const surge = Object.keys(MC.mons).map(n => M.buildMon(n, {})).find(m0 => m0 && /surge$/.test(m0.ability || ''));
  if (surge) {
    M.applyEntryEffects(surge, f);
    ok(!!f.terrain && f.terrainT === 5, `${surge.name}'s ${surge.ability} sets ${f.terrain} terrain — terrain now exists on the field`);
  }
  /* and the battle loop actually calls it for replacements: kill the lead in front of a benched
   * Pelipper and the rain must be visible in the game — a Water move's damage says whether it was. */
  const sfld = { weather: null, weatherT: 0, terrain: '', terrainT: 0, twA: 0, twB: 0 };
  const dry = M.dmgRange(M.buildMon('pelipper', {}), M.buildMon('garchomp', {}), MC.moves.hydropump, sfld, false).max;
  const wet = M.dmgRange(M.buildMon('pelipper', {}), M.buildMon('garchomp', {}), MC.moves.hydropump, Object.assign({}, sfld, { weather: 'rain' }), false).max;
  ok(wet > dry * 1.4, `rain is worth x${(wet / dry).toFixed(2)} on Hydro Pump — the stake the old bug forfeited`);
}

/* ---- WIRE 11: typeImmunity — the absorb is zero damage AND a gift ---------------------------- */
console.log('\nwire 11 — typeImmunity');
{
  const db = require(path.join(ROOT, 'data', 'tags.json'));
  const members = Object.keys(db.abilities).filter(k => (db.abilities[k].tags || []).includes('typeImmunity'));
  ok(members.length === 12, `${members.length} absorb/immunity abilities, matching the 12-name table this wire deletes`);
  ok(members.every(k => db.abilities[k].params.typeImmunity.type),
    'every member names its TYPE (was {immune:true} — a boolean in param\'s clothing)');

  /* THIS WIRE WAS STAGED ON A BODY THAT WAS ALREADY IMMUNE, and that is why it read dead for a whole
   * session while the engine was right the entire time.
   *
   * The absorber was a **Garchomp** — Dragon/GROUND — so an Electric move prices at zero off the TYPE
   * CHART with no ability at all. "an Electric hit into Volt Absorb prices at zero" was true of a
   * Garchomp with `ability: 'none'`, and the heal could not fire because nothing was ever absorbed.
   * It is the same shape as the redirection false alarm of 2026-08-04, which fired a Dragon move at a
   * Fairy type: the mechanic worked, the staging could not show it, and the engine got the blame.
   *
   * MILOTIC IS THE BODY: pure Water, so Electric is x2 into it and the control below LOSES hp. Every
   * arm now prints the ability-off number beside the ability-on one. */
  const F = { terrain: '', weather: '', twA: 0, twB: 0 };
  const att = M.buildMon('pelipper', {});
  const plain = M.buildMon('milotic', {}); plain.ability = 'none'; plain.item = '';
  const va = M.buildMon('milotic', {}); va.ability = 'voltabsorb'; va.item = '';
  const bolt = M.buildMon('pikachu', {}) || att;
  const openly = M.dmgRange(bolt, plain, MC.moves.thunderbolt || MC.moves.discharge, F, false).max;
  ok(openly > 0, `the CONTROL takes the Electric hit (${openly}) — without this the assertion below is vacuous`);
  ok(M.dmgRange(bolt, va, MC.moves.thunderbolt || MC.moves.discharge, F, false).max === 0,
    'an Electric hit into Volt Absorb prices at zero, from the tag');
  ok(M.dmgRange(att, va, MC.moves.hydropump, F, false).max > 0,
    'a Water hit into the same body lands — the immunity is per-TYPE, not per-name');

  /* the gain, in a real battle: a half-HP Volt Absorb body eats a forced Thunderbolt and HEALS 1/4 */
  /* Both tests strip ITEMS (a dataset Sitrus healed on top of the absorb and got blamed on the
   * wire) and roll 0.5 (0.9 made 80-accuracy Hydro Pump MISS — the engine was right both times). */
  const A = [M.buildMon('pikachu', {})].filter(Boolean);
  const holder = M.buildMon('milotic', {}); holder.ability = 'voltabsorb'; holder.item = '';
  if (A.length && holder && MC.moves.thunderbolt) {
    A[0].item = '';
    const S = M.battleInit(A, [holder]);
    /* HALF HP, NOT 1 HP. A quarter-max heal onto a full body is capped and reads as no heal at all;
     * 1 HP works too, but half makes the number printed below directly comparable to the quarter. */
    holder.curHP = Math.floor(holder.st.hp / 2);
    const before = holder.curHP;
    const saved = MC.priors[A[0].name]; MC.priors[A[0].name] = null;
    const savedH = MC.priors[holder.name]; MC.priors[holder.name] = null;
    A[0].moves = ['thunderbolt']; holder.moves = ['protect'];
    /* THE ABSORBER IS FORCED TO PASS. It was left free with `moves: ['protect']`, so the engine duly
     * chose Protect, the Thunderbolt was blocked and nothing was ever absorbed — a second reason this
     * arm could not have passed whatever the engine did. */
    try {
      M.battleTurn(S, () => 0.5,
        new Map([[S.actA[0], M.playerAction(S.actA[0], 'thunderbolt', holder, S.field)]]),
        new Map([[S.actB[0], { kind: 'pass' }]]));
    }
    finally { MC.priors[A[0].name] = saved; MC.priors[holder.name] = savedH; }
    ok(holder.curHP === before + Math.floor(holder.st.hp / 4),
      `the absorbed hit HEALS the absorber 1/4 (${before} -> ${holder.curHP}, a quarter is ${Math.floor(holder.st.hp / 4)}) — the old table priced this gift at nothing`);
  }

  /* Storm Drain banks +1 SpA instead */
  const sd = M.buildMon('garchomp', {}); sd.ability = 'stormdrain'; sd.item = '';
  const pel = M.buildMon('pelipper', {}); pel.item = '';
  const S2 = M.battleInit([pel], [sd]);
  const savedP = MC.priors.pelipper; MC.priors.pelipper = null;
  const savedG = MC.priors[sd.name]; MC.priors[sd.name] = null;
  S2.actA[0].moves = ['hydropump']; sd.moves = ['protect'];
  try { M.battleTurn(S2, () => 0.5, new Map([[S2.actA[0], M.playerAction(S2.actA[0], 'hydropump', sd, S2.field)]])); }
  finally { MC.priors.pelipper = savedP; MC.priors[sd.name] = savedG; }
  ok(sd.boosts.sa === 1 && sd.curHP === sd.st.hp,
    `Storm Drain banks +1 SpA off the absorbed Hydro Pump (sa ${sd.boosts.sa}, untouched HP)`);
}

/* ---- WIRE 12: survivesFromFull — the kill that is not a kill --------------------------------- */
console.log('\nwire 12 — survivesFromFull');
{
  const pSA = TAGS.param('item', 'focussash', 'survivesFromFull');
  ok(pSA && pSA.leavesHP === 1 && pSA.onlyFromFullHP === true && pSA.movesOnly === true && pSA.consumesItem === true,
    'Focus Sash: full-HP gate, Move-only, leaves 1, SPENT — all from the handler (was a name check)');
  const pST = TAGS.param('ability', 'sturdy', 'survivesFromFull');
  ok(pST && pST.leavesHP === 1 && pST.consumesItem === false,
    'Sturdy: the same idiom minus the consumption');

  /* a lethal forced hit into a FULL-HP sash body leaves exactly 1 and eats the sash */
  const battle1 = (hp, item, ability) => {
    const a = M.buildMon('garchomp', {}); a.item = ''; a.moves = ['earthquake'];
    const h = M.buildMon('pikachu', {}); h.item = item; if (ability) h.ability = ability;
    h.moves = ['protect']; h.st = Object.assign({}, h.st, {}); h.curHP = hp == null ? h.st.hp : hp;
    const sA = MC.priors[a.name], sH = MC.priors[h.name];
    MC.priors[a.name] = null; MC.priors[h.name] = null;
    const S = M.battleInit([a], [h]);
    try { M.battleTurn(S, () => 0.5, new Map([[S.actA[0], M.playerAction(S.actA[0], 'earthquake', h, S.field)]])); }
    finally { MC.priors[a.name] = sA; MC.priors[h.name] = sH; }
    return h;
  };
  const sash = battle1(null, 'focussash', null);
  ok(sash.curHP === 1 && !sash.fainted && sash.item === '',
    `full-HP sash body survives the lethal hit at exactly 1, sash spent (HP ${sash.curHP}, item '${sash.item}')`);
  const chipped = battle1(Math.floor(M.buildMon('pikachu', {}).st.hp * 0.9), 'focussash', null);
  ok(chipped.fainted, 'the SAME hit kills at 90% HP — the full-HP gate is real');
  const sturdy = battle1(null, '', 'sturdy');
  ok(sturdy.curHP === 1 && !sturdy.fainted && sturdy.ability === 'sturdy',
    'Sturdy survives the same way and is not consumed');
}

/* ---- WIRE 13: boostsMoveClass × moveClass — the flag join ------------------------------------ */
console.log('\nwire 13 — boostsMoveClass');
{
  const db = require(path.join(ROOT, 'data', 'tags.json'));
  const members = Object.entries(db.abilities).filter(([, r]) => (r.tags || []).includes('boostsMoveClass'));
  ok(members.length >= 6 && members.every(([, r]) => r.params.boostsMoveClass.mult > 1),
    `${members.length} class-boost abilities, every one carrying its real multiplier (was flag-only)`);

  /* REWRITTEN 2026-08-07, ROADMAP #92, AND THE ENGINE WAS RIGHT WHILE THIS ASSERTION WAS WRONG.
   *
   * It used to divide the boosted damage by the unboosted damage and demand the quotient equal the
   * ability's multiplier within 0.04. That only holds while the multiplier is applied to the FINAL
   * DAMAGE, and `boostsMoveClass` is `onBasePower` — a base power passes through `tr(22*bp*A/D)` and
   * `tr(/50)` before it becomes damage, and neither floor commutes with a multiply. Moving these to
   * the right stage turned Mega Launcher's Dragon Pulse ratio into **1.444**, and the assertion went
   * red on a fix. It was checked against the authority before this file was touched: Garchomp Dragon
   * Pulse into Incineroar, flat bodies, Showdown reads **54 → 78** and so do we, on all sixteen
   * rolls — **the authority's own ratio is 1.4444.** A damage ratio is simply not the multiplier.
   *
   * SO IT ASSERTS THE STAGE INSTEAD, WHICH IS STRICTER AND IS THE THING THAT CHANGED: apply the
   * multiplier to the move's BASE POWER by hand, through the same fixed-point helper the authority
   * uses, and demand the ability produce exactly that damage. It is not circular — the hand path
   * never touches the ability, and it fails on any engine that applies the multiplier anywhere else.
   * `tests/test-damage-stages.js` carries the same family against Showdown itself. */
  const F = { terrain: '', weather: '', twA: 0, twB: 0 };
  const stageCheck = (ab, moveId) => {
    const a1 = M.buildMon('garchomp', {}); a1.ability = ab; a1.item = '';
    const a0 = M.buildMon('garchomp', {}); a0.ability = 'pressure'; a0.item = '';
    const d = M.buildMon('incineroar', {}); d.item = '';
    const mv = MC.moves[moveId];
    if (!mv) return null;
    const p = TAGS.param('ability', ab, 'boostsMoveClass');
    const mult = (M.CH_EXACT && M.CH_EXACT[ab]) || (p && p.mult);
    /* THE HAND PATH: the same move with its base power already multiplied, on a body with NO
     * ability. If the engine applies the boost at the base-power stage the two agree exactly. */
    const byHand = Object.assign({}, mv, { bp: Math.max(1, M.mdChain(mv.bp, M.ch4096(M.CH_ONE, mult))) });
    const withAbility = M.dmgRange(a1, d, mv, F, false).max;
    const handMade = M.dmgRange(a0, d, byHand, F, false).max;
    const plain = M.dmgRange(a0, d, mv, F, false).max;
    return { withAbility, handMade, plain };
  };
  const tc = stageCheck('toughclaws', 'ironhead');            // contact
  ok(tc && tc.withAbility === tc.handMade && tc.withAbility > tc.plain,
    `Tough Claws applies its ${db.abilities.toughclaws.params.boostsMoveClass.mult} to BASE POWER — `
    + `plain ${tc && tc.plain}, with the ability ${tc && tc.withAbility}, with the base power `
    + `multiplied by hand ${tc && tc.handMade} (the last two must be EQUAL)`);
  const tcRanged = stageCheck('toughclaws', 'earthquake');     // no contact
  ok(tcRanged && tcRanged.withAbility === tcRanged.plain,
    `and leaves Earthquake alone — ${tcRanged && tcRanged.plain} either way; the flag comes from the `
    + `move, not the ability's hopes`);
  const sj = stageCheck('strongjaw', 'crunch');               // bite
  ok(sj && sj.withAbility === sj.handMade && sj.withAbility > sj.plain,
    `Strong Jaw bites: plain ${sj && sj.plain}, ability ${sj && sj.withAbility}, hand ${sj && sj.handMade}`);
  const ml = stageCheck('megalauncher', 'dragonpulse');       // pulse
  ok(ml && ml.withAbility === ml.handMade && ml.withAbility > ml.plain,
    `Mega Launcher pulses: plain ${ml && ml.plain}, ability ${ml && ml.withAbility}, hand ${ml && ml.handMade} `
    + `(the DAMAGE ratio here is 1.444, not 1.5, and the authority agrees — see the comment above)`);
}

/* ---- WIRE 14: healsAtThreshold — the pinch berry reads its own label ------------------------- */
console.log('\nwire 14 — healsAtThreshold');
{
  const p = TAGS.param('item', 'sitrusberry', 'healsAtThreshold');
  ok(p && p.triggersBelow === '1/2' && p.restores === '1/4',
    'Sitrus declares its own threshold and restore (was a name check in the residual loop)');
  const run = hpFrac => {
    const a = M.buildMon('garchomp', {}); a.item = ''; a.moves = ['protect'];
    const h = M.buildMon('incineroar', {}); h.item = 'sitrusberry'; h.moves = ['protect'];
    h.curHP = Math.floor(h.st.hp * hpFrac);
    const sA = MC.priors[a.name], sH = MC.priors[h.name];
    MC.priors[a.name] = null; MC.priors[h.name] = null;
    const S = M.battleInit([a], [h]);
    try { M.battleTurn(S, () => 0.9); } finally { MC.priors[a.name] = sA; MC.priors[h.name] = sH; }
    return h;
  };
  const low = run(0.4);
  ok(low.curHP === Math.floor(low.st.hp * 0.4) + Math.floor(low.st.hp / 4) && low.item === '',
    `at 40% it eats the berry and heals exactly 1/4 (${low.curHP}/${low.st.hp}, item '${low.item}')`);
  const high = run(0.8);
  ok(high.item === 'sitrusberry' && high.curHP === Math.floor(high.st.hp * 0.8),
    'at 80% the berry stays in the pocket — the threshold is the tag\'s, not a vibe');
}

/* ---- WIRE 15: the spread table is derived, and Earthquake finally hits its own partner ------- */
console.log('\nwire 15 — spreadFoes / spreadAll');
{
  const db = require(path.join(ROOT, 'data', 'tags.json'));
  const foesOnly = Object.keys(db.moves).filter(k => (db.moves[k].tags || []).includes('spreadFoes'));
  const hitsAlly = Object.keys(db.moves).filter(k => (db.moves[k].tags || []).includes('spreadAll'));
  ok(foesOnly.includes('heatwave') && !foesOnly.includes('earthquake'),
    `spreadFoes (${foesOnly.length}) is the ally-safe family — Heat Wave in, Earthquake out`);
  ok(hitsAlly.includes('earthquake') && hitsAlly.includes('discharge'),
    `spreadAll (${hitsAlly.length}) hits the partner — Earthquake and Discharge where they belong`);

  /* one controlled 2v2: my Garchomp quakes; my own partner must eat it, the ally-safe Heat Wave
   * must not, and a partner that PROTECTED stays safe. rng 0.9: no crits, no procs. */
  const quake2 = (moveId, allyMove) => {
    const me = M.buildMon('garchomp', {}); me.item = ''; me.moves = [moveId];
    const ally = M.buildMon('kingambit', {}); ally.item = ''; ally.moves = [allyMove || 'ironhead', 'protect'];
    const f1 = M.buildMon('corviknight', {}); f1.item = ''; f1.moves = ['roost'];
    const f2 = M.buildMon('whimsicott', {}); f2.item = ''; f2.moves = ['protect'];
    [me, ally, f1, f2].forEach(x => { const s = MC.priors[x.name]; MC.priors[x.name] = null; x._sp = s; });
    const S = M.battleInit([me, ally], [f1, f2]);
    const acts = new Map([[S.actA[0], M.playerAction(S.actA[0], moveId, S.actB[0], S.field)],
                          [S.actA[1], M.playerAction(S.actA[1], allyMove || 'ironhead',
                            allyMove === 'protect' ? null : S.actB[1], S.field)]]);
    try { M.battleTurn(S, () => 0.9, acts); }
    finally { [me, ally, f1, f2].forEach(x => { MC.priors[x.name] = x._sp; delete x._sp; }); }
    return ally;
  };
  const allyEQ = quake2('earthquake');
  ok(allyEQ.curHP < allyEQ.st.hp,
    `Earthquake hits its own partner (kingambit ${allyEQ.curHP}/${allyEQ.st.hp}) — no rollout quake ever did before`);
  const allyHW = quake2('heatwave');
  ok(allyHW.curHP === allyHW.st.hp,
    'Heat Wave leaves the partner untouched — the ally-safe family stays safe');
  const allyProt = quake2('earthquake', 'protect');
  ok(allyProt.curHP === allyProt.st.hp,
    'and a partner that Protected eats nothing — the quake respects Protect like any hit');
}

/* ---- WIRE 16: secondary stat drops — Icy Wind is speed control at last ----------------------- */
console.log('\nwire 16 — secondary stat drops');
{
  const drop = (moveId, defAbility) => {
    const a = M.buildMon('pelipper', {}); a.item = ''; a.moves = [moveId];
    const d = M.buildMon('garchomp', {}); d.item = ''; d.moves = ['protect'];
    if (defAbility) d.ability = defAbility;
    d.st = Object.assign({}, d.st, { hp: 9999 }); d.curHP = 9999;
    const sA = MC.priors[a.name], sD = MC.priors[d.name];
    MC.priors[a.name] = null; MC.priors[d.name] = null;
    const S = M.battleInit([a], [d]);
    try { M.battleTurn(S, () => 0.9, new Map([[S.actA[0], M.playerAction(S.actA[0], moveId, d, S.field)]])); }
    finally { MC.priors[a.name] = sA; MC.priors[d.name] = sD; }
    return d;
  };
  const iw = drop('icywind');
  ok(iw.boosts.sp === -1, `Icy Wind drops the target's Speed (${iw.boosts.sp}) — the format's speed control was a no-op secondary`);
  const sn = drop('snarl');
  ok(sn.boosts.sa === -1, `Snarl drops SpA (${sn.boosts.sa})`);
  const cb = drop('icywind', 'clearbody');
  ok(cb.boosts.sp === 0, 'Clear Body refuses the drop — the shared gate holds');
}

/* ---- WIRES 17+18: thaw on hit, and the Choice lock actually locks ---------------------------- */
console.log('\nwires 17+18 — thawsTarget / choiceLock');
{
  ok(TAGS.has('move', 'scald', 'thawsTarget') && !TAGS.has('move', 'ironhead', 'thawsTarget'),
    'Scald carries the thaw flag, Iron Head does not');
  /* frozen target eats a Fire hit and is no longer frozen */
  const a = M.buildMon('incineroar', {}); a.item = ''; a.moves = ['flareblitz'];
  const d = M.buildMon('garchomp', {}); d.item = ''; d.moves = ['protect'];
  d.status = 'frz'; d.st = Object.assign({}, d.st, { hp: 9999 }); d.curHP = 9999;
  const sA = MC.priors[a.name], sD = MC.priors[d.name];
  MC.priors[a.name] = null; MC.priors[d.name] = null;
  const S = M.battleInit([a], [d]);
  try { M.battleTurn(S, () => 0.9, new Map([[S.actA[0], M.playerAction(S.actA[0], 'flareblitz', d, S.field)]])); }
  finally { MC.priors[a.name] = sA; MC.priors[d.name] = sD; }
  ok(d.status === '' && d.curHP < 9999, `a Fire hit thaws the frozen target (status '${d.status}', took damage)`);

  /* the Scarf lock: after turn 1 the holder's chooseAction returns ONLY the locked move */
  ok(TAGS.has('item', 'choicescarf', 'choiceLock'), 'Choice Scarf carries choiceLock (4,159 sheets)');
  const c = M.buildMon('garchomp', {}); c.item = 'choicescarf'; c.moves = ['earthquake', 'ironhead', 'protect'];
  const foe = M.buildMon('corviknight', {}); foe.item = ''; foe.moves = ['roost'];
  foe.st = Object.assign({}, foe.st, { hp: 99999 }); foe.curHP = 99999;
  const sC = MC.priors[c.name], sF = MC.priors[foe.name];
  MC.priors[c.name] = null; MC.priors[foe.name] = null;
  const S2 = M.battleInit([c], [foe]);
  try {
    M.battleTurn(S2, () => 0.9, new Map([[S2.actA[0], M.playerAction(S2.actA[0], 'ironhead', foe, S2.field)]]));
    ok(c._lock === 'ironhead', `the lock engaged on the committed move (${c._lock})`);
    /* now let the ENGINE choose for it: with EQ immune vs corviknight it would love to re-pick —
     * the lock must hold it to Iron Head */
    const hp1 = foe.curHP;
    M.battleTurn(S2, () => 0.9);
    ok(foe.curHP < hp1, 'turn 2, engine-chosen: the locked Iron Head fired again (damage landed)');
    ok(c._lock === 'ironhead', 'and the lock is still ironhead — no quiet re-picking');
  } finally { MC.priors[c.name] = sC; MC.priors[foe.name] = sF; }
}

/* ---- WIRES 19+20: real setup boosts, and Encore rides the lock ------------------------------- */
console.log('\nwires 19+20 — setup boosts / Encore');
{
  const duel = (mySetup, ability) => {
    const a = M.buildMon('garchomp', {}); a.item = ''; a.moves = [mySetup]; if (ability) a.ability = ability;
    const d = M.buildMon('corviknight', {}); d.item = ''; d.moves = ['roost'];
    const sA = MC.priors[a.name], sD = MC.priors[d.name];
    MC.priors[a.name] = null; MC.priors[d.name] = null;
    const S = M.battleInit([a], [d]);
    try { M.battleTurn(S, () => 0.9, new Map([[S.actA[0], M.playerAction(S.actA[0], mySetup, null, S.field)]])); }
    finally { MC.priors[a.name] = sA; MC.priors[d.name] = sD; }
    return a;
  };
  const sd = duel('swordsdance');
  ok(sd.boosts.at === 2 && sd.boosts.sa === 0 && sd.boosts.sp === 0,
    `Swords Dance is +2 Attack and NOTHING else (${sd.boosts.at}/${sd.boosts.sa}/${sd.boosts.sp}) — was a generic +1/+1/+1`);
  const idf = duel('irondefense');
  ok(idf.boosts.df === 2 && idf.boosts.at === 0,
    `Iron Defense is +2 Defense (${idf.boosts.df}) — the old guess gave it zero Defense and three wrong stats`);
  const con = duel('swordsdance', 'contrary');
  ok(con.boosts.at === -2, `Contrary flips it to -2 (${con.boosts.at})`);

  /* Encore: pin the foe to its last move for the tag's own 3 turns */
  const pE = TAGS.param('move', 'encore', 'sealsMoves');
  ok(pE && +pE.turns === 3, 'Encore declares its 3 turns in the artifact');
  const a2 = M.buildMon('whimsicott', {}); a2.item = ''; a2.moves = ['encore'];
  const v2 = M.buildMon('garchomp', {}); v2.item = ''; v2.moves = ['ironhead', 'earthquake'];
  const sA2 = MC.priors[a2.name], sV2 = MC.priors[v2.name];
  MC.priors[a2.name] = null; MC.priors[v2.name] = null;
  const S2 = M.battleInit([a2], [v2]);
  a2.st = Object.assign({}, a2.st, { hp: 99999 }); a2.curHP = 99999;
  try {
    M.battleTurn(S2, () => 0.9, new Map([[S2.actA[0], M.playerAction(S2.actA[0], 'encore', v2, S2.field)]]));
    ok(!v2._lock, 'turn 1: a foe with NO last move cannot be Encored — the click honestly does nothing');
    M.battleTurn(S2, () => 0.9, new Map([[S2.actA[0], M.playerAction(S2.actA[0], 'encore', v2, S2.field)]]));
    ok(v2._lock === v2._lastMove && v2._lockT === 3,
      `turn 2: Encore pins the foe to its last move (${v2._lock}) for ${v2._lockT} turns`);
  } finally { MC.priors[a2.name] = sA2; MC.priors[v2.name] = sV2; }
}

/* ---- Fake Out legality reaches PICK time ----------------------------------------------------- */
console.log('\nfake out — legal to click only when legal to land');
{
  /* Legality, not preference: with a stronger legal move the engine may skip Fake Out on turn 1
   * (the first draft asserted preference and failed honestly). The promise under test is only:
   * clickable when legal, refused when not. */
  const a = M.buildMon('incineroar', {}); a.item = ''; a.moves = ['fakeout'];
  const d = M.buildMon('corviknight', {}); d.item = ''; d.moves = ['roost'];
  d.st = Object.assign({}, d.st, { hp: 99999 }); d.curHP = 99999;
  const sA = MC.priors[a.name], sD = MC.priors[d.name];
  MC.priors[a.name] = null; MC.priors[d.name] = null;
  const S = M.battleInit([a], [d]);
  try {
    M.battleTurn(S, () => 0.9);                    // turn 1: Fake Out is the only move, and legal
    const t1 = (S.lastActs || []).find(x => x.side === 'A');
    ok(t1 && t1.move === 'fakeout', `turn 1 Fake Out is clickable (${t1 && t1.move})`);
    M.battleTurn(S, () => 0.9);                    // turn 2: the only move is now ILLEGAL to pick
    const t2 = (S.lastActs || []).find(x => x.side === 'A');
    ok(t2 && t2.kind === 'struggle',
      `turn 2 the illegal Fake Out is refused at pick time (${t2 && t2.kind}) — not a fake click`);
  } finally { MC.priors[a.name] = sA; MC.priors[d.name] = sD; }
}

/* ---- WIRE 21: variablePower — the power IS the calculation, and now the tag says which -------- */
console.log('\nwire 21 — variablePower');
{
  const db = require(path.join(ROOT, 'data', 'tags.json'));
  const p = db.moves.lowkick.params.variablePower;
  ok(p && p.kind === 'targetWeightKg' && p.brackets[0][0] === 200 && p.brackets[0][1] === 120,
    'Low Kick carries the handler\'s own weight table in kg (was {computed:true} on 2,055 uses)');
  ok(!!MC.moves.lowkick,
    'and Low Kick EXISTS in the move table now — it was absent entirely, not weak (backfilled from the artifact+dex)');

  const F = { terrain: '', weather: '', twA: 0, twB: 0 };
  const att = M.buildMon('garchomp', {}); att.item = '';
  const heavy = M.buildMon('hippowdon', {}); heavy.item = '';
  const light = M.buildMon('whimsicott', {}); light.item = '';
  const lkH = M.dmgRange(att, heavy, MC.moves.lowkick, F, false).max;
  const lkL = M.dmgRange(att, light, MC.moves.lowkick, F, false).max;
  ok(lkH > lkL * 4, `Low Kick: ${lkH} into 300kg, ${lkL} into 6.6kg — weight is the power`);

  const tor = M.buildMon('incineroar', {}); tor.item = '';
  const full = M.dmgRange(tor, light, MC.moves.eruption, F, false).max;
  tor.curHP = Math.floor(tor.st.hp * 0.1);
  const hurt = M.dmgRange(tor, light, MC.moves.eruption, F, false).max;
  /* A DIRECTION, NOT A MAGIC NUMBER. `> hurt * 8` is a typed constant with no derivation: Eruption
   * scales as 150 x currentHP/maxHP, so at 10% HP the POWER ratio is ~10x and the DAMAGE ratio lands
   * near 8x after rounding and the damage floor. The real claim is "much weaker when hurt", and
   * pinning it to 8 made the check fail on a legitimate stat-line change at a measured 8.00. This is
   * the assert-a-count-where-you-mean-a-direction pattern the 2026-07-31 audit named. */
  ok(full > hurt * 5, `a hurt Eruption is a weak Eruption (${full} at full, ${hurt} at 10%, ${(full/hurt).toFixed(1)}x)`);

  const burned = M.buildMon('incineroar', {}); burned.status = 'brn';
  const clean = M.buildMon('incineroar', {});
  const hexR = M.dmgRange(att, burned, MC.moves.hex, F, false).max / M.dmgRange(att, clean, MC.moves.hex, F, false).max;
  ok(Math.abs(hexR - 2) < 0.05, `Hex doubles on a statused target (x${hexR.toFixed(2)})`);

  const held = M.buildMon('incineroar', {}); held.item = 'sitrusberry';
  const bare = M.buildMon('incineroar', {}); bare.item = '';
  const koR = M.dmgRange(att, held, MC.moves.knockoff, F, false).max / M.dmgRange(att, bare, MC.moves.knockoff, F, false).max;
  ok(koR > 1.4 && koR < 1.55, `Knock Off is x${koR.toFixed(2)} only when they actually hold something — sheet-known`);
}

/* ---- the A/B switch: ABRA_TAGS_OFF_TREE ------------------------------------------------------ */
console.log('\nA/B switch — ABRA_TAGS_OFF_TREE scopes tags-off to one checkout');
{
  /* The paired head-to-head puts both arms in ONE process, so the control arm cannot use the
   * process-wide ABRA_TAGS_OFF. The tree-scoped variant must (a) kill the wires for the tree it
   * names, (b) leave every other tree alone, and (c) not treat ../ABRA as a prefix of ../ABRA-old.
   * Each case is a child process because the switch is read once, at module load. */
  const { execFileSync } = require('child_process');
  const probe = `
    require(${JSON.stringify(path.join(ROOT, 'data', 'engine-data.js'))});
    const M = require(${JSON.stringify(path.join(ROOT, 'engine', 'medicham2-browser.js'))});
    const a = M.buildMon('garchomp', { garchomp: 'lifeorb' });
    const b = M.buildMon('garchomp', { garchomp: '' });
    const d = M.buildMon('incineroar', { incineroar: '' });
    const mv = MC.moves['earthquake'];
    const F = { terrain: '', weather: '', twA: 0, twB: 0 };
    console.log(M.dmgRange(a, d, mv, F, false).max / M.dmgRange(b, d, mv, F, false).max);`;
  const ratioWith = tree => +execFileSync(process.execPath, ['-e', probe], {
    env: Object.assign({}, process.env, tree ? { ABRA_TAGS_OFF_TREE: tree } : {}), encoding: 'utf8'
  }).trim();
  const on = ratioWith(null);
  const off = ratioWith(ROOT);
  const other = ratioWith(ROOT + '-some-other-checkout');
  const prefix = ratioWith(ROOT.slice(0, -1));      // "…/ABR" must NOT switch off "…/ABRA"
  ok(on > 1.2, `without the env var Life Orb boosts damage (x${on.toFixed(3)})`);
  ok(off === 1, `naming THIS tree turns its tags off (x${off.toFixed(3)})`);
  ok(other === on, `naming a different tree leaves this one alone (x${other.toFixed(3)})`);
  ok(prefix === on, `a bare string prefix of the tree path does not match (x${prefix.toFixed(3)})`);
}

console.log('');
if (fail) {
  console.log(`${fail} wire(s) are dead — the tag exists, the run is clean, and the number did not move.`);
  process.exit(1);
}
console.log(`${pass} checks passed. The artifact is reaching the damage calculation.`);
