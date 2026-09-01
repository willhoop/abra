/* probe_punish_side_and_sky.js — THE TWO `punishesAttacker` EFFECT KINDS THAT ARE NOT A TOLL, PLAYED
 * AGAINST THE OFFICIAL SIMULATOR.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_punish_side_and_sky.js
 *   ... --arm bottom-tie-first        (the default; the corner that pins randomChance TRUE)
 *
 *   MEDI_HAZARD_ON_ATTACKER_SIDE=1   puts the E1 defect back
 *   MEDI_PUNISH_WEATHER_IF_CLEAR=1   puts the E2 defect back
 *
 * ================= THE TWO CARDS, AND WHY THEY ARE TWO AND NOT ONE ==============================
 *
 * Empirical cards E1 and E2 (docs/_reports/2026-08-29-empirical-divergence-cards.md) were handed over
 * as ONE HYPOTHESIS: that `punishesAttacker`'s payload could not carry a side condition or a sky, so
 * one member wanted a hazard and the other a weather and the tag modelled neither. THAT IS REFUTED,
 * and it was refuted by reading rather than by running: `engine/tag_dex.js` derives `hazard`,
 * `maxLayers` AND `setsWeather`, and `engine/medicham2-browser.js` consumes all three. Both defects
 * are downstream of the payload, in two separate statements, and a 2x2 over the two revert knobs
 * moves each arm under its own knob and neither arm under the other.
 *
 * ================= THE MEMBERSHIP, PRINTED OVER THE FORMAT BEFORE ANYTHING WAS WIRED ============
 *
 * Thirteen `punishesAttacker` rows in `data/tags.json`, EVERY ONE with at least one legal carrier —
 * spicyspray (Scovillain-Mega), aftermath (Garbodor), cursedbody (6), cutecharm (4), effectspore
 * (Vileplume), flamebody (3), gooey (2), innardsout (Victreebel-Mega), poisonpoint (5), roughskin
 * (2), sandspit (Sandaconda), static (7), toxicdebris (Glimmora). Not one member was ruled out for
 * having no carrier. Exactly ONE carries `hazard` and exactly ONE carries `setsWeather`, so neither
 * arm below can be satisfied by a sibling, and Rough Skin is here as the member that is ALREADY
 * CORRECT — the arm that catches a fix that fires the whole family.
 *
 * ================= E1 — THE SIDE ================================================================
 *
 *     data/abilities.ts:5096   (toxicdebris is NOT overridden in data/mods/champions/)
 *     const side = source.isAlly(target) ? source.side.foe : source.side;
 *
 * In a two-side game BOTH branches name the side OPPOSITE THE HOLDER. This engine passed the
 * ATTACKER's side field, which is the same answer for a foe and the WRONG one for an ally. So the
 * defect is reachable only through an ALLY's physical hit, which is why every fixture in this
 * repository — all of which hit Glimmora from across the field — agreed.
 *
 *     showdown   |-sidestart|p2|move: Toxic Spikes        <- the side that is NOT the holder's
 *     medicham   |-sidestart|p1|move: toxicspikes         <- the attacker's, i.e. its OWN
 *
 * ================= E2 — THE SKY =================================================================
 *
 *     data/abilities.ts:3978   sandspit.onDamagingHit() { this.field.setWeather('sandstorm'); }
 *     sim/field.ts:45-52       refuses ONLY when `this.weather === status.id` (gen 9 > 5)
 *
 * So a standing sandstorm refuses and a standing SUN, RAIN or SNOW is OVERWRITTEN. This engine
 * guarded on `!field.weather` and carried on in the old sky — and a Sandaconda is brought INTO
 * weather, so the broken branch is the common one.
 *
 * ================= WHAT THIS PROBE ASSERTS, AND WHAT IT REFUSES TO TYPE =========================
 *
 * NOTHING about which side or which sky is typed as an expectation. Both engines play the identical
 * scripted turns under the identical pinned dice and each turn's protocol is compared as a SEQUENCE,
 * and the CONSEQUENCE (layers per side, the sky) is read out of each engine's own state at the same
 * instant.
 *
 * EVERY ARM CLEARS ITS KNOB EXPLICITLY — the same body under one of its OWN other legal abilities
 * (Glimmora/Corrosion, Sandaconda/Shed Skin), so cast, clicks, dice and damage are identical and only
 * the ability varies. The probe FAILS if the AUTHORITY's own layer count or sky does not move across
 * that knob: identical output across a varied knob means the fixture is unwired, not that the knob
 * does not matter.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * Toxic Debris is 2,115 corpus uses but the ALLY-HIT path needs a partner clicking a physical spread
 * move into its own Glimmora, so its pool reach is thin. Sand Spit is 34 uses on one carrier. The LAB
 * must move for both; the pinned pool is expected to move by at most the two games the cards name.
 *
 * IT WRITES NOTHING. No artifact is touched.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

if (!process.argv.includes('--state')) process.argv.push('--state');

const CS = require(D('engine', 'champions_sim.js'));
const G = require(D('engine', 'game_differential.js'));
const M = require(D('engine', 'medicham2-browser.js'));

const ARM_ID = (() => {
  const i = process.argv.indexOf('--arm');
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : 'bottom-tie-first';
})();
const ARM = (G.ARM_BY_ID && G.ARM_BY_ID.get) ? G.ARM_BY_ID.get(ARM_ID) : null;

const mon = (species, ability, moves) => ({ species, item: '', ability, moves });

/* ---- THE CAST ---------------------------------------------------------------------------------
 * EARTHQUAKE is the hit for E1: PHYSICAL (Toxic Debris' derived trigger) and `allAdjacent`, so ONE
 * click reaches the holder from its OWN partner, which is the only road to the defect. CRUNCH is the
 * hit for E2 and for Rough Skin: physical, contact, and neither Fire nor Water, so a sky change
 * cannot move its damage and a board difference cannot be laundered as weather arithmetic.
 * x6 HP everywhere: nothing may faint, because a faint forces a switch and the replacement becomes
 * the thing under test. */
const IDLE = { glimmora: 'Acid Armor', sandaconda: 'Coil', garchomp: 'Swords Dance',
               torkoal: 'Iron Defense', milotic: 'Recover', clefable: 'Calm Mind',
               feraligatr: 'Crunch', hippowdon: 'Slack Off', corviknight: 'Iron Defense',
               pinsir: 'Swords Dance', toxapex: 'Iron Defense', alakazam: 'Calm Mind' };
const HP_BOOST = 6;

{ /* every carriage claim is TeamValidator's and is printed, per the standing rule */
  let bad = 0;
  const claims = [['glimmora', 'Acid Armor'], ['sandaconda', 'Coil'], ['garchomp', 'Earthquake'],
                  ['garchomp', 'Swords Dance'], ['torkoal', 'Iron Defense'], ['milotic', 'Recover'],
                  ['clefable', 'Calm Mind'], ['feraligatr', 'Crunch'], ['hippowdon', 'Earthquake'],
                  ['corviknight', 'Iron Defense'], ['pinsir', 'Swords Dance'],
                  ['toxapex', 'Iron Defense'], ['alakazam', 'Calm Mind']];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const BENCH = [['corviknight', 'Iron Defense'], ['pinsir', 'Swords Dance']];
const BENCH2 = [['toxapex', 'Iron Defense'], ['alakazam', 'Calm Mind']];

/* ---- THE SCENARIOS ----------------------------------------------------------------------------
 * `hazard` scenarios differ ONLY in who clicks the Earthquake and in the subject's ability.
 * `sky` scenarios differ ONLY in the partner's ability (Drought or not) and the subject's. */
const SC = {
  'E1 ally-hit': {
    kind: 'hazard',
    p1: sub => [mon('glimmora', sub, [IDLE.glimmora]), mon('garchomp', 'Sand Veil', ['Earthquake', IDLE.garchomp]),
                ...BENCH.map(([s, m]) => mon(s, '', [m]))],
    p2: () => [mon('milotic', 'Marvel Scale', [IDLE.milotic]), mon('clefable', 'Magic Guard', [IDLE.clefable]),
               ...BENCH2.map(([s, m]) => mon(s, '', [m]))],
    turn: { p1: [{ m: IDLE.glimmora }, { m: 'Earthquake' }], p2: [{ m: IDLE.milotic }, { m: IDLE.clefable }] },
  },
  'E1 foe-hit (CONTROL)': {
    kind: 'hazard',
    p1: sub => [mon('glimmora', sub, [IDLE.glimmora]), mon('garchomp', 'Sand Veil', [IDLE.garchomp]),
                ...BENCH.map(([s, m]) => mon(s, '', [m]))],
    p2: () => [mon('hippowdon', 'Sand Force', ['Earthquake']), mon('clefable', 'Magic Guard', [IDLE.clefable]),
               ...BENCH2.map(([s, m]) => mon(s, '', [m]))],
    turn: { p1: [{ m: IDLE.glimmora }, { m: IDLE.garchomp }], p2: [{ m: 'Earthquake' }, { m: IDLE.clefable }] },
  },
  'E2 under SUN': {
    kind: 'sky',
    p1: sub => [mon('sandaconda', sub, [IDLE.sandaconda]), mon('torkoal', 'Drought', [IDLE.torkoal]),
                ...BENCH.map(([s, m]) => mon(s, '', [m]))],
    p2: () => [mon('feraligatr', 'Torrent', ['Crunch']), mon('clefable', 'Magic Guard', [IDLE.clefable]),
               ...BENCH2.map(([s, m]) => mon(s, '', [m]))],
    turn: { p1: [{ m: IDLE.sandaconda }, { m: IDLE.torkoal }], p2: [{ m: 'Crunch', t: 0 }, { m: IDLE.clefable }] },
  },
  'E2 from a CLEAR sky (CONTROL)': {
    kind: 'sky',
    p1: sub => [mon('sandaconda', sub, [IDLE.sandaconda]), mon('milotic', 'Marvel Scale', [IDLE.milotic]),
                ...BENCH.map(([s, m]) => mon(s, '', [m]))],
    p2: () => [mon('feraligatr', 'Torrent', ['Crunch']), mon('clefable', 'Magic Guard', [IDLE.clefable]),
               ...BENCH2.map(([s, m]) => mon(s, '', [m]))],
    turn: { p1: [{ m: IDLE.sandaconda }, { m: IDLE.milotic }], p2: [{ m: 'Crunch', t: 0 }, { m: IDLE.clefable }] },
  },
  'ROUGH SKIN (FAMILY CONTROL)': {
    kind: 'toll',
    p1: sub => [mon('garchomp', sub === 'off' ? 'Sand Veil' : 'Rough Skin', [IDLE.garchomp]),
                mon('milotic', 'Marvel Scale', [IDLE.milotic]), ...BENCH.map(([s, m]) => mon(s, '', [m]))],
    p2: () => [mon('feraligatr', 'Torrent', ['Crunch']), mon('clefable', 'Magic Guard', [IDLE.clefable]),
               ...BENCH2.map(([s, m]) => mon(s, '', [m]))],
    turn: { p1: [{ m: IDLE.garchomp }, { m: IDLE.milotic }], p2: [{ m: 'Crunch', t: 0 }, { m: IDLE.clefable }] },
  },
};
/* THE KNOB, PER SCENARIO: the subject's own ability against one of its OWN other legal abilities. */
const SUBJECT = { hazard: ['Toxic Debris', 'Corrosion'], sky: ['Sand Spit', 'Shed Skin'],
                  toll: ['on', 'off'] };

const TURNS = [1, 2];

/* ---- THE COMPARATOR — lifted from tests/probe_punish_announce.js, with its reasoning ------------
 *
 * ONE CHARACTER IS ADDED TO THE HP PATTERN AND IT IS AN INSTRUMENT FIX, NOT A LOOSENING. Showdown's
 * `|split|` pairs write the SECRET half as `196/948` and the SHARED half as a PERCENTAGE CARRYING A
 * BAR COLOUR — `20/100y` at or below half, `…r` at or below a fifth (sim/pokemon.ts getHealth). The
 * ancestor's pattern had no place for that letter, so the shared half did not normalise to the same
 * string as the secret half, the `seen` dedupe did not collapse the twin, and a SECOND `-damage` line
 * appeared in the authority's stream and in nobody else's. It reads exactly like a missing event.
 *
 * IT WAS DIAGNOSED BY DUMPING THE RAW PROTOCOL, not by reasoning: the ancestor probe never drove a
 * body below half, so its fixtures could not reach the letter. The same latent hole is still in
 * `tests/probe_punish_announce.js` and is REPORTED rather than edited here — it can only ever produce
 * a false FAILURE, never a false pass. */
const norm = l => String(l)
  .replace(/(p[12][ab]?): ?[^|]*/g, '$1')
  .replace(/\|\d+\/\d+(\/\d+)?[yr]?( [a-z]+)?/g, '|H/H')
  .toLowerCase()
  .split('|').map((f, i) => {
    let x = f.trim();
    if (i >= 2) x = x.replace(/^(\[from\]\s*)?(move|ability|item):\s*/, '$1');
    return x.replace(/[^a-z0-9\[\]/-]/g, '');
  })
  .slice(0, (String(l).split('|')[1] === 'move') ? 4 : undefined).join('|');
const SKIP_EVENT = new Set(['', 'split', 't:']);
const turnSlice = (lines, n) => {
  const s = (lines || []).map(String);
  const i = s.findIndex(l => l === '|turn|' + n);
  if (i < 0) return [];
  let j = s.findIndex((l, k) => k > i && l.startsWith('|turn|'));
  if (j < 0) j = s.length;
  return s.slice(i + 1, j).filter(l => !SKIP_EVENT.has(l.split('|')[1] || ''));
};
const stream = (lines, n) => {
  const out = [], seen = new Set();
  for (const l of turnSlice(lines, n)) {
    const k = norm(l);
    if (seen.has(k)) continue;
    seen.add(k); out.push(k);
  }
  return out;
};

/* ---- THE CONSEQUENCE, read out of each engine's own state at the same instant ------------------- */
const lay = c => (c ? (c.layers | 0) : 0);
const sdWatch = battle => ({
  p1: lay(battle && battle.p1 && battle.p1.sideConditions && battle.p1.sideConditions['toxicspikes']),
  p2: lay(battle && battle.p2 && battle.p2.sideConditions && battle.p2.sideConditions['toxicspikes']),
  sky: M.weatherId((battle && battle.field && battle.field.weather) || '') || '-',
  hp: (() => { const p = battle && battle.p2 && battle.p2.active && battle.p2.active[0];
               return p ? (p.hp | 0) : null; })(),
});
const meWatch = S => ({
  p1: ((S && S.sfA && S.sfA.hz && S.sfA.hz.toxicspikes) | 0),
  p2: ((S && S.sfB && S.sfB.hz && S.sfB.hz.toxicspikes) | 0),
  sky: M.weatherId((S && S.field && S.field.weather) || '') || '-',
  hp: (() => { const m = S && S.actB && S.actB[0]; return m ? (m.curHP | 0) : null; })(),
});

function run(name, sub) {
  const sc = SC[name];
  const a = G.buildPair(sc.p1(sub), { hpBoost: HP_BOOST }),
        b = G.buildPair(sc.p2(sub), { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'punish-side-sky', name + ':' + sub, {
    script: TURNS.map(() => sc.turn), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical, sd: sdWatch(battle), me: meWatch(S),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  const out = { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen };
  for (const t of TURNS) { out['sd' + t] = stream(sd, t); out['me' + t] = stream(me, t); }
  return out;
}

console.log('\nTHE PUNISH SIDE AND THE PUNISH SKY — two effect kinds, measured apart\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  revert knobs  MEDI_HAZARD_ON_ATTACKER_SIDE=' + (process.env.MEDI_HAZARD_ON_ATTACKER_SIDE || '(off)')
          + '   MEDI_PUNISH_WEATHER_IF_CLEAR=' + (process.env.MEDI_PUNISH_WEATHER_IF_CLEAR || '(off)'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const R = {};
for (const name of Object.keys(SC)) {
  const [armAb, ctlAb] = SUBJECT[SC[name].kind];
  R[name + '|arm'] = run(name, armAb);
  R[name + '|ctl'] = run(name, ctlAb);
}

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const key of Object.keys(R)) {
  const x = R[key];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + key.toUpperCase());
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  for (const t of TURNS) {
    console.log(`  turn ${t}  showdown  ` + (x['sd' + t].join('  ') || '(none)'));
    console.log(`  turn ${t}  medicham  ` + (x['me' + t].join('  ') || '(none)'));
  }
  console.log('  toxicspikes [p1,p2]  showdown ' + x.seen.map(y => '[' + y.sd.p1 + ',' + y.sd.p2 + ']').join(' ')
    + '   medicham ' + x.seen.map(y => '[' + y.me.p1 + ',' + y.me.p2 + ']').join(' '));
  console.log('  sky                  showdown ' + x.seen.map(y => y.sd.sky).join(' ')
    + '   medicham ' + x.seen.map(y => y.me.sky).join(' '));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the CONSEQUENCE, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const last = key => (R[key].seen || [])[(R[key].seen || []).length - 1] || null;

/* -- 1. THE FIXTURE, read off the AUTHORITY's own state and never off ours. ---------------------- */
{
  const arm = last('E1 ally-hit|arm'), ctl = last('E1 ally-hit|ctl');
  ok(!!arm && arm.sd.p2 >= 1 && arm.sd.p1 === 0,
     'E1 — the AUTHORITY laid the layer on the side that is NOT the holder\'s, from an ALLY\'s hit',
     'sd [p1,p2] = [' + (arm && arm.sd.p1) + ',' + (arm && arm.sd.p2) + ']');
  ok(!!ctl && ctl.sd.p1 === 0 && ctl.sd.p2 === 0,
     'E1 — the AUTHORITY laid NOTHING with the ability cleared — IDENTICAL STATE ACROSS THE KNOB '
   + 'WOULD MEAN THE FIXTURE IS UNWIRED',
     'sd [p1,p2] = [' + (ctl && ctl.sd.p1) + ',' + (ctl && ctl.sd.p2) + ']');
}
{
  const arm = last('E1 foe-hit (CONTROL)|arm');
  ok(!!arm && arm.sd.p2 >= 1 && arm.sd.p1 === 0,
     'E1 CONTROL — the AUTHORITY puts a FOE-landed layer on the same side, so this arm is correct '
   + 'under BOTH readings and is the over-fire control',
     'sd [p1,p2] = [' + (arm && arm.sd.p1) + ',' + (arm && arm.sd.p2) + ']');
}
{
  const arm = last('E2 under SUN|arm'), ctl = last('E2 under SUN|ctl');
  const clr = last('E2 from a CLEAR sky (CONTROL)|arm');
  ok(!!arm && arm.sd.sky === 'sand',
     'E2 — the AUTHORITY OVERWROTE the standing sun with its sandstorm', 'sd sky = ' + (arm && arm.sd.sky));
  ok(!!ctl && ctl.sd.sky === 'sun',
     'E2 — the AUTHORITY left the sun standing with the ability cleared — the knob moves the '
   + 'authority, so the fixture is wired', 'sd sky = ' + (ctl && ctl.sd.sky));
  ok(!!clr && clr.sd.sky === 'sand',
     'E2 CONTROL — from a CLEAR sky the AUTHORITY sets the same sandstorm, which this engine already '
   + 'did: the over-fire control', 'sd sky = ' + (clr && clr.sd.sky));
}
for (const key of Object.keys(R)) {
  const x = R[key];
  ok(x.verdict === 'RAN' && x.turns >= TURNS.length,
     'all scripted turns were played — ' + key, 'turns ' + x.turns + ', boundaries ' + (x.seen || []).length);
}

/* -- 2. THE CONSEQUENCE agrees between the engines at every boundary. ---------------------------- */
for (const key of Object.keys(R)) {
  const bad = (R[key].seen || []).filter(y => y.sd.p1 !== y.me.p1 || y.sd.p2 !== y.me.p2
                                           || y.sd.sky !== y.me.sky);
  ok(bad.length === 0, 'CONSEQUENCE agrees at every boundary — ' + key,
     bad.map(y => 't' + y.turn + ' tspikes sd[' + y.sd.p1 + ',' + y.sd.p2 + '] me[' + y.me.p1 + ','
       + y.me.p2 + '] sky sd=' + y.sd.sky + ' me=' + y.me.sky).join(' ; '));
}

/* -- 3. THE BOARD. ------------------------------------------------------------------------------ */
for (const key of Object.keys(R)) {
  const bad = (R[key].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + key,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 4. THE NARRATION, per turn, compared as a SEQUENCE with no typed expectation. --------------- */
for (const key of Object.keys(R)) for (const t of TURNS) {
  const a = (R[key]['sd' + t] || []).join('  '), b = (R[key]['me' + t] || []).join('  ');
  ok(a === b, `NARRATION identical — ${key}, turn ${t}`,
     a === b ? '' : 'authority [' + a + ']\n          ours      [' + b + ']');
}

/* -- 5. THE DEFECTS, NAMED, without typing a side or a sky. -------------------------------------- */
const sideStarts = lines => (lines || []).filter(l => /^\|-sidestart\|/.test(l)).sort().join('  ');
for (const key of ['E1 ally-hit|arm', 'E1 foe-hit (CONTROL)|arm']) for (const t of TURNS) {
  const a = sideStarts(R[key]['sd' + t]), b = sideStarts(R[key]['me' + t]);
  ok(a === b, `the -sidestart lines name the same SIDE — ${key}, turn ${t}`,
     a === b ? '' : 'authority [' + (a || '(none)') + ']\n          ours      [' + (b || '(none)') + ']');
}
const weathers = lines => (lines || []).filter(l => /^\|-weather\|/.test(l)).join('  ');
for (const key of ['E2 under SUN|arm', 'E2 from a CLEAR sky (CONTROL)|arm', 'E2 under SUN|ctl']) for (const t of TURNS) {
  const a = weathers(R[key]['sd' + t]), b = weathers(R[key]['me' + t]);
  ok(a === b, `the -weather lines match — ${key}, turn ${t}`,
     a === b ? '' : 'authority [' + (a || '(none)') + ']\n          ours      [' + (b || '(none)') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
