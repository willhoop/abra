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
    for (let seed = 0; seed < 40 && !sawBoost; seed++) {
      let s = seed * 2654435761 + 12345;
      const rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const mk = names => names.map(n => M.buildMon(n, {})).filter(Boolean);
      const A = mk(['mudsdale', 'incineroar', 'garchomp', 'gholdengo']);
      const B = mk(['kingambit', 'incineroar', 'garchomp', 'whimsicott']);
      if (A.length < 2 || B.length < 2) break;
      ran++;
      try { M.battle(A, B, {}, rng); } catch (e) { break; }
      if (A[0] && A[0].boosts && A[0].boosts.df > 0) sawBoost = true;
    }
    ok(sawBoost, `Stamina raised Mudsdale's Defense in a real battle without anyone clicking a boost (${ran} games)`);
  }
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
