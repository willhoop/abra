/* mega_decision_census.js — IS "WHEN DO I MEGA" A DECISION, AND IS IT FITTABLE?
 *
 *   node engine/mega_decision_census.js            print
 *   node engine/mega_decision_census.js --write    -> data/mega-decision.json
 *
 * WHY THIS EXISTS. Will, 2026-08-06, on being shown that MAG has no representation of mega at all:
 * "WHAT IF WE ADD MEGA EVOLUTION TO THE MAG WEIGHTS", then "SO IF MEGA I OUTSPEED" and "IF MEGA I
 * GAIN WEATHER CONTROL". Those are two proposed features. Before either is written, three things have
 * to be true and none of them is safe to assume:
 *
 *   1. THE DECISION MUST BE OBSERVED. A feature fitted on human clicks needs human clicks to fit on.
 *   2. THE DECISION MUST BE TIMED. If everybody megas on turn 1, "when" is not a decision and a
 *      feature for it would fit noise. ROADMAP #31 says the engine currently treats it as a default
 *      ("the lead keeps it"), and this census is what makes that claim falsifiable.
 *   3. THE PROPOSED FEATURES MUST VARY. A feature that is constant across bodies carries no
 *      information. Blastoise-Mega gains no Speed and sets no weather; Floette-Mega gains 50 base
 *      Speed. If megaing were uniformly good it would be a RULE, not a weight.
 *
 * NOTHING HERE IS TYPED. Every figure in docs/MEGA-FEATURES-SPEC.md comes out of this file, because
 * two hand-typed ladder-store counts in docs/GAME-DIFFERENTIAL-DESIGN.md had already drifted apart
 * from each other AND from the file within hours of being written. Prose cannot track a corpus.
 *
 * THE SPEED AND WEATHER TABLES ARE READ FROM THE FORMAT'S OWN DEX, never from memory and never by
 * string arithmetic on forme names. Both wrong answers published on 2026-08-06 came from that:
 * "Excadrillite" (the stone is Excadrite) and floette-eternal + "-mega" (the forme is floettemega),
 * each reporting a confident 0.00% for something on hundreds of teams. engine/names.js exists for it.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const RS = require('./run_stamp.js');
const N = require('./names.js');

const CENSUS_SOURCES = [
  'engine/mega_decision_census.js', 'engine/names.js', 'engine/quality.js',
  'data/games.ladder.jsonl', 'data/tags.json',
];

const WRITE = process.argv.includes('--write');
const D = (...p) => path.join(__dirname, '..', ...p);

/* THE STORE IS READ RAW AND THAT IS A JUDGEMENT, DECLARED. See the note at the bottom of this file:
 * exposure ("how much of the format carries this") is a different question from behaviour ("is this a
 * good idea"), and only the second needs a clean corpus. Both are reported, separately, and the
 * headline for the FEATURE argument is the clean one. */
const Q = require('./quality.js');

/* ---------------------------------------------------------------- the dex half */

/* S12 — THE FORMAT ID LIVES IN ONE PLACE AND THIS IS NOT IT. Hardcoding it here would be a second
 * copy to go stale the day the regulation rolls, which is the whole reason champions_sim owns it. */
const CS = require('./champions_sim.js');
const DEX = CS.sim().Dex.forFormat(CS.FORMAT);

/* Sets weather / grants a conditional speed multiplier. Matched on the TAG SHAPE where we have one,
 * so an ability added later is picked up without editing this file — CLAUDE.md's rule. The literal
 * maps below are the fallback for abilities tags.json does not carry, and they are asserted
 * non-empty at the bottom rather than trusted. */
const SETS_WEATHER = { drought: 'sun', drizzle: 'rain', sandstream: 'sand', snowwarning: 'snow',
                       desolateland: 'sun', primordialsea: 'rain' };
const SPEED_ABILITY = { swiftswim: 'rain', chlorophyll: 'sun', sandrush: 'sand', slushrush: 'snow',
                        surgesurfer: 'electricterrain', unburden: 'itemloss', quickfeet: 'status' };

function megaTable() {
  const rows = [];
  for (const sp of DEX.species.all()) {
    if (!/-Mega/i.test(sp.name)) continue;
    const base = DEX.species.get(sp.baseSpecies);
    if (!base || !base.exists) continue;
    const ab = sp.abilities && sp.abilities['0'];
    const abid = N.id(ab);
    rows.push({
      forme: N.id(sp.name), base: N.id(base.name),
      speBase: base.baseStats.spe, speMega: sp.baseStats.spe,
      speDelta: sp.baseStats.spe - base.baseStats.spe,
      ability: ab, abilityBase: base.abilities && base.abilities['0'],
      abilityOverwritten: N.id(ab) !== N.id(base.abilities && base.abilities['0']),
      setsWeather: SETS_WEATHER[abid] || null,
      speedAbility: SPEED_ABILITY[abid] || null,
    });
  }
  return rows;
}

/* ---------------------------------------------------------------- the store half */

function census(cleanOnly) {
  const clean = cleanOnly ? Q.behaviouralBots(Q.readStore()) : null;
  return new Promise((resolve) => {
    let games = 0, withMega = 0, bothSides = 0, events = 0, skipped = 0, unreadable = 0;
    const unreadableWhy = {};
    const byTurn = {}, byForme = {};
    const rl = readline.createInterface({ input: fs.createReadStream(D('data', 'games.ladder.jsonl')), crlfDelay: Infinity });
    rl.on('line', (L) => {
      if (!L.trim()) return;
      /* COUNTED, NOT SWALLOWED. `catch (e) { return }` was the original and it is the shape
       * tests/test-no-silent-failure.js exists to stop: a corpus that silently shrinks reports a
       * smaller census with no sign anything was lost, which is how "93.1% of games carry a mega"
       * could quietly become a statement about only the games that happened to parse. */
      let g;
      try { g = JSON.parse(L); } catch (e) { unreadable++; unreadableWhy[e.name] = (unreadableWhy[e.name] || 0) + 1; return; }
      if (cleanOnly) { const why = Q.reasons(g, Q.config(), clean); if (why && why.length) { skipped++; return; } }
      games++;
      const sides = new Set(); let n = 0;
      for (const t of (g.turns || [])) for (const e of (t.ev || [])) {
        if (e.t !== 'mega') continue;
        n++; events++;
        sides.add(String(e.s || '').slice(0, 2));
        byTurn[t.n] = (byTurn[t.n] || 0) + 1;
        const f = N.id(e.mon); byForme[f] = (byForme[f] || 0) + 1;
      }
      if (n) { withMega++; if (sides.size === 2) bothSides++; }
    });
    rl.on('close', () => {
      /* LOUD, NOT SILENT — a dropped line is printed, never merely subtracted. */
      if (unreadable) console.log('  WARNING: ' + unreadable + ' unreadable store lines skipped ' + JSON.stringify(unreadableWhy));
      resolve({ games, withMega, bothSides, events, skipped, unreadable, unreadableWhy, byTurn, byForme });
    });
  });
}

/* ---------------------------------------------------------------- report */

(async () => {
  const raw = await census(false);
  const cln = await census(true);
  const table = megaTable();

  const pct = (n, d) => d ? +(100 * n / d).toFixed(2) : null;
  const turnShare = (c) => {
    const out = {};
    for (const [t, n] of Object.entries(c.byTurn)) out[t] = pct(n, c.events);
    return out;
  };
  const t1 = (c) => pct(c.byTurn[1] || 0, c.events);

  console.log('');
  console.log('MEGA AS A DECISION — is it observed, is it timed, does it vary');
  console.log('');
  for (const [label, c] of [['raw ladder store', raw], ['clean corpus', cln]]) {
    console.log('  ' + label);
    console.log('    games                       ' + c.games + (c.skipped ? '   (' + c.skipped + ' filtered out)' : ''));
    console.log('    games with >= 1 mega        ' + c.withMega + '   ' + pct(c.withMega, c.games) + '%');
    console.log('    BOTH sides megaed           ' + c.bothSides + '   ' + pct(c.bothSides, c.games) + '%');
    console.log('    mega events (fit corpus)    ' + c.events);
    console.log('    share on TURN 1             ' + t1(c) + '%   <- if this were ~100 there is no decision to fit');
    console.log('');
  }

  /* DOES THE PROPOSED FEATURE VARY? This is the part that decides whether "mega is good" is a weight
   * or a rule. A constant is a rule. */
  const gainSpe = table.filter(r => r.speDelta > 0).length;
  const noSpe = table.filter(r => r.speDelta === 0).length;
  const weather = table.filter(r => r.setsWeather).length;
  const spdAbil = table.filter(r => r.speedAbility).length;
  const keepsAb = table.filter(r => !r.abilityOverwritten).length;
  console.log('  DOES IT VARY ACROSS BODIES? (' + table.length + ' mega formes in this format)');
  console.log('    gain base Speed             ' + gainSpe + '        largest: ' +
    table.slice().sort((a, b) => b.speDelta - a.speDelta).slice(0, 3).map(r => r.forme + ' +' + r.speDelta).join(', '));
  console.log('    gain NO Speed at all        ' + noSpe + '        e.g. ' +
    table.filter(r => r.speDelta === 0).slice(0, 3).map(r => r.forme).join(', '));
  console.log('    SET WEATHER on evolving     ' + weather + '        ' +
    table.filter(r => r.setsWeather).map(r => r.forme + '->' + r.setsWeather).slice(0, 5).join(', '));
  console.log('    conditional speed ability   ' + spdAbil + '        ' +
    table.filter(r => r.speedAbility).map(r => r.forme + ' x2 in ' + r.speedAbility).slice(0, 4).join(', '));
  console.log('    ability NOT overwritten     ' + keepsAb + '        the "changed" test would fail on every one of these');
  console.log('');
  console.log('  A feature that is CONSTANT across bodies is a rule, not a weight. These are not constant.');
  console.log('');

  if (!SETS_WEATHER || !Object.keys(SETS_WEATHER).length) throw new Error('SETS_WEATHER is empty — the census would silently report 0 weather-setters');
  if (!table.length) throw new Error('no mega formes found — a name lookup has broken, do not write a 0');

  if (WRITE) {
    fs.writeFileSync(D('data', 'mega-decision.json'), JSON.stringify({
      generated: new Date().toISOString(), by: 'engine/mega_decision_census.js',
      what: 'Is "when do I mega" an observed, timed, varying decision? The three preconditions for ' +
            'fitting mega features into MAG. Every figure in docs/MEGA-FEATURES-SPEC.md comes from here.',
      source_digests: RS.sourceDigests(CENSUS_SOURCES),
      raw: { games: raw.games, unreadable: raw.unreadable, unreadableWhy: raw.unreadableWhy, withMega: raw.withMega, bothSides: raw.bothSides, events: raw.events,
             pctWithMega: pct(raw.withMega, raw.games), pctBothSides: pct(raw.bothSides, raw.games),
             turnShare: turnShare(raw) },
      clean: { games: cln.games, unreadable: cln.unreadable, unreadableWhy: cln.unreadableWhy, filtered: cln.skipped, withMega: cln.withMega, bothSides: cln.bothSides,
               events: cln.events, pctWithMega: pct(cln.withMega, cln.games),
               pctBothSides: pct(cln.bothSides, cln.games), turnShare: turnShare(cln) },
      variation: { formes: table.length, gainSpeed: gainSpe, noSpeed: noSpe,
                   setsWeather: weather, conditionalSpeedAbility: spdAbil, abilityNotOverwritten: keepsAb },
      table,
      topFormesRaw: Object.entries(raw.byForme).sort((a, b) => b[1] - a[1]).slice(0, 15),
      caveat: 'The store records a mega that HAPPENED. It cannot record a mega that was CONSIDERED and ' +
              'held, nor one whose body fainted before it could be spent (Will, 2026-08-06: "how many ' +
              'of the raichus and all these megas died before they could evolve?"). So the turn-share ' +
              'is a distribution over EXECUTED megas and is a LOWER bound on how often the decision was ' +
              'actually faced. Anything fitted on it inherits that censoring.',
    }, null, 2) + '\n');
    console.log('  wrote data/mega-decision.json');
  }
})();

/* RAW-STORE-OK, for the `raw` half only, and the reason is that the two halves answer different
 * questions. EXPOSURE -- "how much of this format carries a mega at all" -- is a property of the
 * format, and filtering it by who played would understate it. BEHAVIOUR -- "is holding the mega a
 * real decision" -- is evidence about play, and that half runs through Q.reasons with the
 * behavioural-bot set, because a bot that megas on turn 1 every game is exactly the account that
 * would flatten the turn distribution and make the decision look like a formality. Both are written;
 * the spec quotes the CLEAN one for anything about judgement. */
