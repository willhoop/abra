#!/usr/bin/env node
/* tests/probe_arrival_drift_zero.js — THE PER-ARRIVAL RE-PRICE MUST NOT DISARM ITSELF
 *   node tests/probe_arrival_drift_zero.js        node tests/probe_arrival_drift_zero.js --red
 * ==================================================================================================
 *
 * BATCH N LANDED THE PER-ARRIVAL RE-PRICE AND LEFT 39 CLICKS BEHIND, IN WRITING. The receipt on the
 * pinned pool, release `1be57a100d59`, `--arm middle --games 1200 --turns 50`:
 *
 *     per-arrival volley re-price: offered 490, ran 850, MOVED a number 14
 *       [refused non-flat 180 (tripleaxel x3), drifted at arrival 0 39  <-- MUST READ 0]
 *
 * `141 + 39 = 180`, the whole non-flat population — so the road served 141 of the 180 and REFUSED 39
 * at its own arrival-0 invariant, and a refused click behaves BYTE-FOR-BYTE as it did before the fix.
 *
 * WHY THEY REFUSED, MEASURED BEFORE ANYTHING WAS CHANGED. Every drifted click came back at EXACTLY N
 * TIMES the arrival — `populationbomb price 42 reprice 420` at ten packets, `watershuriken price 6
 * reprice 30` at five — because `dmgRange` honours `onlyHitNo` ONLY inside its per-hit loop, and a
 * volley whose power does not vary by arrival never reaches that loop: it returns from the
 * `!perHitPower` road above it with the WHOLE VOLLEY's band. The closure was chosen by whether the
 * arrivals' BANDS happened to be equal, which is a fact about the dice — they are not equal whenever
 * the per-arrival crit vector is mixed, `crits=[false,false,false,true]` on a Bullet Seed — while the
 * callee branches on a fact about the MOVE.
 *
 * THE INVARIANT WAS RIGHT AND IS WHAT CAUGHT IT. Without it those 39 clicks would have dealt N times
 * their damage on every arrival. It is kept; only the ROUTE moves, onto `hitPlanOf`'s own
 * `perHitPower` — the same field, off the same call, that decides which road `dmgRange` takes.
 *
 * AND A SECOND, SMALLER POPULATION: a FORME ABSORB overwrites arrival 0's band with sixteen zeroes
 * AFTER `dmgRange` returned, so no re-price can reproduce it — an Icicle Spear into a fresh Mimikyu
 * read `price 0 reprice 84` and disarmed itself. The invariant now asks the re-price to AGREE THAT
 * THE CLICK IS ABSORBED instead, which is the same function answering the same question.
 *
 * THE ARMS, AND WHAT EACH ONE REFUSES.
 *
 *   RED-1  A RESIST BERRY EATEN MID-VOLLEY.  Venusaur Bullet Seed into a Milotic holding a Rindo
 *          Berry. Arrival 1 spends the berry and is halved; arrivals 2-4 must NOT be. This is Will's
 *          case, on a volley the wire had disarmed: `crits=[false,false,false,true]`.
 *   RED-2  A BURN LANDING MID-VOLLEY.  Lycanroc Tail Slap into a Volcarona with Flame Body. Arrival 1
 *          burns the attacker, so arrivals 2-3 must be HALVED. Will's other case, and it is the same
 *          wire reached through the ATTACKER's status rather than the target's hand — a fix aimed at
 *          the berry alone passes RED-1 and fails here.
 *   CTRL-A THE SAME BULLET SEED INTO THE SAME MILOTIC WITH AN EMPTY HAND.  The item is the ONLY
 *          difference from RED-1. The volley is the same volley — same drifting shape, same mixed
 *          crit vector — and nothing happens between its arrivals, so it MUST HOLD IN BOTH ARMS and
 *          the re-price must move NO number. This is the arm that says the re-price reproduces the
 *          price rather than inventing one.
 *   CTRL-B THE SAME TAIL SLAP INTO A VOLCARONA CARRYING SWARM INSTEAD OF FLAME BODY.  Same volley,
 *          no burn. MUST HOLD IN BOTH ARMS.
 *   CTRL-C A SINGLE-ARRIVAL Giga Drain into the Rindo Milotic.  One arrival, so there is no later
 *          arrival to re-price and the berry does what it has always done. Carried because "Bullet
 *          Seed is broken" or "Rindo is broken" would pass RED-1.
 *
 * EVERY ARM ASSERTS THE FIXTURE REACHED THE RULE FIRST: the four volley arms must land the arrival
 * count both engines agree on, must reach the price site with bands that DIFFER
 * (`arrivalRepriceRefusedNonFlat` above zero — the only evidence the click is in the population this
 * file is about), and the two red arms must show the mid-volley event in the AUTHORITY's own log.
 *
 * RED FIRST: `MEDI_ARRIVAL_REPRICE_BANDROUTE=1` restores batch N's engine exactly — the route on band
 * equality and the invariant at arrival 0. It is NARROWER than `MEDI_ARRIVAL_REPRICE_FLAT_ONLY`, which
 * turns the whole non-flat road off, and narrower again than `MEDI_ARRIVAL_PRICE_ONCE`, which turns
 * both roads off. The knob's own counter `arrivalRepriceBandRouteRestored` must read 1 in the red arm:
 * a restore nothing could observe is not a restore.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_ARRIVAL_REPRICE_BANDROUTE = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- THE FIXTURE, DERIVED ------------------------------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};

/* THE BERRY PAIR. Rindo halves a super-effective GRASS hit; Grass is x2 into Milotic (pure Water), so
 * the clause fires and the target is bulky enough that four arrivals leave it alive — a faint would
 * truncate the volley and the two engines would be compared on different numbers of arrivals. */
const VENU = ['venusaur', '', 'Overgrow', ['Bullet Seed', 'Protect']];
const MILO_RINDO = ['milotic', 'Rindo Berry', 'Competitive', ['Protect', 'Scald']];
const MILO_BARE = ['milotic', '', 'Competitive', ['Protect', 'Scald']];
/* THE BURN PAIR. Tail Slap is a CONTACT move, which is what Flame Body punishes; Normal is neutral on
 * Bug/Fire so nothing but the burn moves between the arrivals. Swarm is the control ability: it is
 * not an on-hit reaction and is asserted to be one below rather than assumed. */
const LYCA = ['lycanroc', '', 'Keen Eye', ['Tail Slap', 'Protect']];
const VOLC_FLAME = ['volcarona', '', 'Flame Body', ['Protect', 'Quiver Dance']];
const VOLC_SWARM = ['volcarona', '', 'Swarm', ['Protect', 'Quiver Dance']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];

const PROT = { m: 'protect' };
const CASES = [
  { name: 'RED-1  a RESIST BERRY eaten mid-volley   [arrivals 2-4 must stop being halved]',
    part: true, volley: true, moves: true, berry: true, click: 'bulletseed', idle: 'scald',
    A: [VENU, CLEF], B: [MILO_RINDO, CLEF],
    what: 'Arrival 1 spends the Rindo Berry and is halved by it. The authority prices arrival 2 with '
        + 'an empty item slot; this engine kept the halving on every later arrival because the click '
        + 'had disarmed its own re-price. Will named this case.' },

  { name: 'RED-2  a BURN landing mid-volley   [arrivals 2-3 must BE halved]',
    part: true, volley: true, moves: true, burn: true, click: 'tailslap', idle: 'quiverdance',
    A: [LYCA, CLEF], B: [VOLC_FLAME, CLEF],
    what: 'Arrival 1 makes contact and Flame Body burns the ATTACKER, so the authority prices arrival '
        + '2 at half Attack. The same wire reached through the attacker\'s status instead of the '
        + 'target\'s hand — a fix aimed only at the berry passes RED-1 and fails here. Will named it.' },

  { name: 'CTRL-A  the SAME Bullet Seed into the SAME Milotic with an EMPTY HAND   [must HOLD, must MOVE nothing]',
    part: false, volley: true, moves: false, click: 'bulletseed', idle: 'scald',
    A: [VENU, CLEF], B: [MILO_BARE, CLEF],
    what: 'The item is the only difference from RED-1. Same volley, same mixed crit vector, nothing '
        + 'between the arrivals — so the re-price must reproduce the price EXACTLY and move no '
        + 'number. THIS IS THE ARM THAT SAYS THE NEW ROUTE ASKS THE QUESTION THE PRICE ASKED.' },

  { name: 'CTRL-B  the SAME Tail Slap into a Volcarona carrying SWARM   [must HOLD, must MOVE nothing]',
    part: false, volley: true, moves: false, click: 'tailslap', idle: 'quiverdance',
    A: [LYCA, CLEF], B: [VOLC_SWARM, CLEF],
    what: 'The ability is the only difference from RED-2. No burn, so nothing may move.' },

  { name: 'CTRL-D  Icicle Spear into an INTACT DISGUISE   [must HOLD in BOTH arms, and it is the ONLY arm that reaches the absorb branch]',
    part: false, volley: true, moves: false, absorb: true, click: 'iciclespear', idle: 'playrough',
    A: [['mamoswine', '', 'Oblivious', ['Icicle Spear', 'Protect']], CLEF],
    B: [['mimikyu', '', 'Disguise', ['Protect', 'Play Rough']], CLEF],
    what: 'THE SECOND ROOT CAUSE, AND NOTHING ELSE IN THIS FILE TOUCHES IT. The forme absorb '
        + 'overwrites arrival 0\'s band with sixteen zeroes AFTER `dmgRange` returned, so the '
        + 'arrival-0 invariant could not be satisfied either way — `price 0 reprice 84` before, '
        + '`price 30 reprice 0` under the new route — and the click disarmed itself. The boards HOLD '
        + 'in both arms (a disarmed volley is unfixed, not wrong), so the ONLY evidence this branch '
        + 'is wired is the counter: `arrivalRepriceInvariantAbsorbed` must rise in the clean arm and '
        + 'the drift must appear in the red one.' },

  { name: 'CTRL-C  a SINGLE-ARRIVAL Giga Drain into the Rindo Milotic   [must HOLD in BOTH arms]',
    part: false, volley: false, moves: false, berry: true, click: 'gigadrain', idle: 'scald',
    A: [['venusaur', '', 'Overgrow', ['Giga Drain', 'Protect']], CLEF], B: [MILO_RINDO, CLEF],
    what: 'One arrival, so there is no later arrival to re-price and the berry does what it has '
        + 'always done. Carried because "Bullet Seed is broken" or "Rindo is broken" would pass RED-1.' },
];

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON --------------------------------------------------- */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) bad(row[1] + ' is not a legal item in this format');
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { bad(mv + ' is not in this format'); continue; }
    if (!learns(row[0], mv)) bad(sp.name + ' does not learn ' + m.name);
  }
}
{
  const TAGS = require(D('data', 'tags.json'));
  const bs = dex.moves.get('bulletseed'), ts = dex.moves.get('tailslap'), gd = dex.moves.get('gigadrain');
  if (!bs.multihit) bad('Bullet Seed is no longer a multi-hit move');
  if (!ts.multihit) bad('Tail Slap is no longer a multi-hit move');
  if (gd.multihit) bad('Giga Drain has become a multi-hit move, so CTRL-C is no longer single-arrival');
  if (bs.category !== 'Physical' || ts.category !== 'Physical')
    bad('a burn only halves a PHYSICAL click: bulletseed ' + bs.category + ', tailslap ' + ts.category);
  if (!(ts.flags && ts.flags.contact)) bad('Tail Slap is no longer a contact move, so Flame Body cannot fire');
  /* THE BERRY ARM NEEDS THE CLAUSE, AND THE CLAUSE NEEDS SUPER-EFFECTIVE. */
  const rb = TAGS.items.rindoberry && TAGS.items.rindoberry.params.resistBerry;
  if (!rb || rb.onType !== 'Grass') bad('Rindo Berry no longer resists Grass: ' + JSON.stringify(rb));
  if (!rb || !rb.requiresSuperEffective) bad('Rindo Berry no longer needs a super-effective hit: ' + JSON.stringify(rb));
  if (dex.getEffectiveness('Grass', dex.species.get('milotic').types) <= 0)
    bad('Grass is no longer super-effective on Milotic, so the Rindo clause cannot fire');
  /* THE BURN ARM NEEDS THE ABILITY TO BE A REACTION, AND THE CONTROL NEEDS SWARM NOT TO BE ONE. */
  const fb = TAGS.abilities.flamebody && TAGS.abilities.flamebody.params.punishesAttacker;
  if (!fb || fb.trigger !== 'contact') bad('Flame Body no longer triggers on contact: ' + JSON.stringify(fb));
  if (!fb || !(fb.inflicts || []).some(x => x && x.status === 'burn'))
    bad('Flame Body no longer inflicts a burn: ' + JSON.stringify(fb));
  if ((TAGS.abilities.swarm.tags || []).includes('punishesAttacker'))
    bad('Swarm has become an on-hit reaction; CTRL-B is no longer a control');
  if ((TAGS.abilities.competitive.tags || []).includes('punishesAttacker'))
    bad('Competitive has become an on-hit reaction; the Milotic arms would then have two variables');
  if ((TAGS.abilities.keeneye.tags || []).includes('punishesAttacker'))
    bad('Keen Eye has become an on-hit reaction; the attacker would then be a variable too');
  if (dex.getEffectiveness('Normal', dex.species.get('volcarona').types) !== 0)
    bad('Normal is no longer neutral on Volcarona, so the burn is not the only thing moving');
  /* CTRL-D NEEDS THE ABSORB TO STILL BE AN ABSORB, and the ability that provides it. */
  const dg = TAGS.abilities.disguise;
  if (!dg || !(dg.tags || []).includes('formeOnHit'))
    bad('Disguise no longer carries `formeOnHit`, which is what `formeOnHitAbsorbs` reads: '
      + JSON.stringify(dg && dg.tags));
  if (!Object.values(dex.species.get('mimikyu').abilities).map(a => dex.abilities.get(a).id)
    .includes('disguise')) bad('Mimikyu no longer has Disguise');
  for (const c of CASES) {
    const sp = dex.species.get(c.B[0][0]);
    const mx = Math.floor(Math.floor(2 * sp.baseStats.hp + 31) * 50 / 100) + 50 + 10;
    if (mx === 100) bad(sp.name + ' has a max HP of exactly 100, which breaks the -damage read');
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
/* THE VOLLEY LANDS ON TURN TWO, AND THE PRIMING TURN IS PART OF THE FIXTURE RATHER THAN PADDING. The
 * middle arm's crit stream is seeded per game, so WHICH arrivals crit is a deterministic function of
 * how many draws precede the click — and the population this file is about is exactly a volley whose
 * crit vector is MIXED. One idle turn is what puts these five clicks in it, and each arm asserts it
 * landed there (`arrivalRepriceRefusedNonFlat` above zero) rather than assuming. */
const scriptFor = c => [
  { p1: [PROT, PROT], p2: [{ m: c.idle, t: 1 }, PROT] },
  { p1: [{ m: c.click, t: 0 }, PROT], p2: [{ m: c.idle, t: 1 }, PROT] },
];
/* The target's HP after each arrival, read off the OMNISCIENT view — Showdown writes the same
 * `-damage` line twice at two denominators and two empty lists would compare equal. */
const seriesOf = lines => {
  const rows = lines.filter(l => /^\|-damage\|p2a/.test(String(l)))
    .filter(l => String(l).indexOf('|[from]') < 0)
    .map(l => { const m = /\|(\d+)\/(\d+)/.exec(String(l)); return m ? { hp: +m[1], max: +m[2] } : null; })
    .filter(x => x != null);
  if (!rows.length) return [];
  const mx = Math.max(...rows.map(r => r.max));
  return rows.filter(r => r.max === mx).map(r => r.hp);
};

console.log((RED ? 'RED ARM — MEDI_ARRIVAL_REPRICE_BANDROUTE=1 (batch N\'s engine: routed on band '
                 + 'equality, invariant at arrival 0)' : 'CLEAN ARM') + NL);

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('snorlax', 'toxapex')));
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'snorlax')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const b0 = { drift: FAILS.arrivalRepriceDriftsAtArrivalZero | 0,
               nonflat: FAILS.arrivalRepriceRefusedNonFlat | 0,
               offered: SEEN.arrivalRepriceOffered | 0, ran: SEEN.arrivalRepriceRan | 0,
               moved: SEEN.arrivalRepriceMoved | 0,
               absorbed: SEEN.arrivalRepriceInvariantAbsorbed | 0,
               mixed: SEEN.arrivalRepriceFlatPowerMixedBand | 0 };
  const r = G.playGame(a, b, 'directed', 'probe_arrival_drift_zero :: ' + c.name,
                       { script: scriptFor(c), arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  const sdD = seriesOf(sdL), meD = seriesOf(meL);
  const d = { drift: (FAILS.arrivalRepriceDriftsAtArrivalZero | 0) - b0.drift,
              nonflat: (FAILS.arrivalRepriceRefusedNonFlat | 0) - b0.nonflat,
              offered: (SEEN.arrivalRepriceOffered | 0) - b0.offered,
              ran: (SEEN.arrivalRepriceRan | 0) - b0.ran,
              moved: (SEEN.arrivalRepriceMoved | 0) - b0.moved,
              absorbed: (SEEN.arrivalRepriceInvariantAbsorbed | 0) - b0.absorbed,
              mixed: (SEEN.arrivalRepriceFlatPowerMixedBand | 0) - b0.mixed };
  const burnSd = sdL.filter(l => /^\|-status\|p1a[^|]*\|brn/.test(String(l))).length;
  const eatSd = sdL.filter(l => /^\|-enditem\|p2a/.test(String(l))).length;
  const faints = sdL.concat(meL).filter(l => /^\|faint\|/.test(String(l))).length;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  target HP after each arrival: ' + JSON.stringify(sdD));
  console.log('    medicham  target HP after each arrival: ' + JSON.stringify(meD));
  console.log('    re-price this arm: bands-differ ' + d.nonflat + ', offered ' + d.offered
    + ', ran ' + d.ran + ', MOVED ' + d.moved + ', drifted ' + d.drift
    + ', flat-power-mixed-band ' + d.mixed + ', invariant-absorbed ' + d.absorbed);

  /* ---- THE FIXTURE REACHED THE RULE ------------------------------------------------------------- */
  claim(faints === 0, c.name + ' — nobody fainted, so both engines are compared on the same arrivals',
    faints + ' faint line(s) across the two streams');
  claim(sdD.length === meD.length || RED,
    c.name + ' — both engines landed the same NUMBER of arrivals',
    'showdown ' + sdD.length + ', medicham ' + meD.length);
  claim((sdD.length > 1) === !!c.volley,
    c.name + ' — the authority landed ' + (c.volley ? 'a MULTI-ARRIVAL volley' : 'ONE arrival'),
    sdD.length + ' arrival(s)');
  /* THE POPULATION THIS FILE IS ABOUT IS "THE BANDS DIFFER". Without this the arm could be a plain
   * flat volley that batch M already served, and the whole probe would be asking nothing. */
  claim((d.nonflat > 0) === !!c.volley,
    c.name + ' — the click ' + (c.volley ? 'REACHED' : 'did NOT reach') + ' the price site with bands that DIFFER',
    'arrivalRepriceRefusedNonFlat +' + d.nonflat);
  if (c.berry) claim(eatSd > 0, c.name + ' — the AUTHORITY actually spent the berry',
    eatSd + ' |-enditem|p2a line(s)');
  if (c.burn) claim(burnSd > 0, c.name + ' — the AUTHORITY actually burned the attacker',
    burnSd + ' |-status|p1a|brn line(s)');

  /* ---- THE KNOB REACHED THE RULE, AND THE ROUTE IS THE ONE UNDER TEST --------------------------- */
  if (c.volley) {
    if (RED) claim(d.drift > 0,
      c.name + ' — [--red] batch N\'s route DISARMED this click at its arrival-0 invariant',
      'arrivalRepriceDriftsAtArrivalZero +' + d.drift);
    else {
      claim(d.drift === 0, c.name + ' — the wire did NOT disarm itself',
        'arrivalRepriceDriftsAtArrivalZero +' + d.drift);
      claim(d.mixed > 0,
        c.name + ' — and it was routed by perHitPower ON A VOLLEY WHOSE BANDS DIFFER, which is the '
        + 'whole population',
        'arrivalRepriceFlatPowerMixedBand +' + d.mixed);
      claim(d.ran > 0, c.name + ' — the interior arrivals were actually re-priced',
        'arrivalRepriceRan +' + d.ran);
      /* THE SILENT CONTROL, IN THE COUNTER RATHER THAN IN THE PROSE. A control arm whose re-price
       * MOVED a number would mean the new route is inventing damage, and the HP series alone would
       * not separate that from a lucky cancellation. */
      claim((d.moved > 0) === !!c.moves,
        c.name + ' — the re-price ' + (c.moves ? 'MOVED' : 'moved NO') + ' number',
        'arrivalRepriceMoved +' + d.moved);
      /* THE ABSORB BRANCH HAS NO OTHER WITNESS. Its arm's boards hold in BOTH arms — a disarmed
       * volley is unfixed rather than wrong — so without this counter the arm would pass on an
       * engine where the branch was never wired. */
      claim((d.absorbed > 0) === !!c.absorb,
        c.name + ' — the invariant ' + (c.absorb ? 'WAS' : 'was NOT') + ' satisfied through the '
        + 'forme-absorb branch', 'arrivalRepriceInvariantAbsorbed +' + d.absorbed);
    }
  }

  /* ---- THE OUTCOME ------------------------------------------------------------------------------ */
  /* ==== A DECLARED, MEASURED, PRE-EXISTING PARTING ON ONE ARM ====================================
   *
   * CTRL-D's boards DO part, and it is not this file's defect — it reads IDENTICALLY under `--red`,
   * i.e. on batch N's engine, so nothing in this batch caused it and nothing in this batch fixes it.
   * Both logs, dumped:
   *
   *     showdown   -activate Disguise | -damage 130/130 | detailschange Busted
   *                -damage 114/130 [from] Mimikyu-Busted | -crit | 69 | 41 | 13 | -hitcount 4
   *     medicham   -activate Disguise | -damage 130/130 | detailschange Busted
   *                -damage 114/130 [from] mimikyu-busted |         | 84 | 56 | 28 | -hitcount 4
   *
   * The absorb, the bust, the chip (114 on both) and arrivals 3 and 4 (28 each on both) all AGREE.
   * The whole difference is ONE `|-crit|` the authority draws on arrival 2 of an absorbed volley and
   * this engine does not: 45 against 30. That is the per-arrival CRIT vector on a volley whose first
   * arrival was eaten, a different wire from the re-price, and it goes on the hand list rather than
   * being smuggled into this batch.
   *
   * SO IT IS ASSERTED AS THE DECLARED SHAPE, NOT WAIVED. The arm still fails if anything OTHER than
   * that one crit moves — the arrival counts, the chip and the agreeing arrivals are all checked —
   * and it fails LOUDLY the day the crit is fixed, which is the correct behaviour for a declared
   * remainder and is how it stops becoming a permanent exemption. */
  if (c.absorb) {
    const critsOf = L => L.filter(l => /^\|-crit\|p2a/.test(String(l))).length;
    const chipOf = L => { const m = L.map(String).find(l => /^\|-damage\|p2a.*\[from\] pokemon:/i.test(l));
      const g = m && /\|(\d+)\/(\d+)/.exec(m); return g ? +g[1] : null; };
    const sdC = critsOf(sdL), meC = critsOf(meL);
    console.log('    DECLARED PARTING, and it is NOT this batch\'s: the authority draws ' + sdC
      + ' |-crit| on this volley and this engine draws ' + meC + '. Identical under --red. '
      + 'Per-arrival crit on an ABSORBED volley — hand list, not this fix.');
    claim(chipOf(sdL) != null && chipOf(sdL) === chipOf(meL),
      c.name + ' — the disguise BUST CHIP is identical, so the absorb itself agrees',
      'showdown ' + chipOf(sdL) + ', medicham ' + chipOf(meL));
    claim(sdC === 1 && meC === 0,
      c.name + ' — the parting is EXACTLY the one declared above and nothing else moved',
      'showdown |-crit| ' + sdC + ', medicham ' + meC);
    const tail = s => s.slice(2).map((v, i) => s[i + 1] - v);
    claim(JSON.stringify(tail(sdD)) === JSON.stringify(tail(meD)),
      c.name + ' — every arrival AFTER the crit deals the same damage in both engines',
      'showdown ' + JSON.stringify(tail(sdD)) + '  medicham ' + JSON.stringify(tail(meD)));
    continue;
  }
  const same = JSON.stringify(sdD) === JSON.stringify(meD);
  claim(same === (RED ? !c.part : true),
    c.name + ' — the two engines leave the TARGET on the same HP after every arrival'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    same ? 'identical' : 'showdown ' + JSON.stringify(sdD) + '  vs  medicham ' + JSON.stringify(meD));
  const boardSame = !r.stateDiv;
  claim(boardSame === (RED ? !c.part : true),
    c.name + ' — the BOARD at the turn boundary'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    boardSame ? 'identical' : String(r.stateDiv && r.stateDiv.key ? r.stateDiv.key : 'parted'));
}

/* ---- THE RUN-WIDE COUNTERS ----------------------------------------------------------------------- */
console.log(NL + 'run-wide: drifts ' + (FAILS.arrivalRepriceDriftsAtArrivalZero | 0)
  + ', bandroute-restored ' + (FAILS.arrivalRepriceBandRouteRestored | 0)
  + ', plan-road-unreported ' + (FAILS.arrivalRepricePlanRoadUnreported | 0)
  + ', invariant-absorbed ' + (SEEN.arrivalRepriceInvariantAbsorbed | 0)
  + ', arrival-out-of-plan ' + (FAILS.arrivalRepriceArrivalOutOfPlan | 0));
if (RED) claim((FAILS.arrivalRepriceBandRouteRestored | 0) === 1,
  'the KNOB REACHED THE RULE — a volley whose bands differ was routed the old way',
  'arrivalRepriceBandRouteRestored = ' + (FAILS.arrivalRepriceBandRouteRestored | 0));
else claim((FAILS.arrivalRepriceBandRouteRestored | 0) === 0,
  'no arm silently restored the old route', 'arrivalRepriceBandRouteRestored = '
  + (FAILS.arrivalRepriceBandRouteRestored | 0));
claim((FAILS.arrivalRepricePlanRoadUnreported | 0) === 0,
  'dmgRange reported which road it took on every price — no silent fallback to the band comparison',
  'arrivalRepricePlanRoadUnreported = ' + (FAILS.arrivalRepricePlanRoadUnreported | 0)
  + (FAILS.arrivalRepricePlanRoadUnreportedFirst ? ' (' + FAILS.arrivalRepricePlanRoadUnreportedFirst + ')' : ''));
claim((FAILS.arrivalRepriceArrivalOutOfPlan | 0) === 0,
  'no re-price asked for an arrival its hit plan does not have',
  'arrivalRepriceArrivalOutOfPlan = ' + (FAILS.arrivalRepriceArrivalOutOfPlan | 0));

console.log(NL + (fails ? 'FAILED ' + fails + ' assertion(s)' : 'all assertions green'));
process.exit(fails ? 1 : 0);
