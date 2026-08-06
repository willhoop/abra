/* IS MEDICHAM WIRED ON THE THINGS PEOPLE ACTUALLY CLICK?   node tests/test-medicham-coverage.js
 *
 * Will set the bar on 2026-08-06: *"i still want medicham to be fully wired and tested on every move
 * and ability and item in the regulation (with any usage at all) before we start taking its output
 * and using them."* Then he approved a target for this session: **99% OF USAGE**, plus a **CARVE-OUT**
 * for anything that can turn a CERTAINTY into a FAILURE regardless of usage.
 *
 * A THRESHOLD IS A LIST. A COVERAGE TARGET IS A MECHANISM. That distinction is the entire reason he
 * picked a target, and it is why nothing in this file names a Pokemon, a move, an ability or an item.
 * The 99% set is DERIVED at runtime from data/games.ladder.jsonl (tests/regulation_usage.js): sort
 * everything by the usage the corpus recorded, take the smallest prefix that adds up to 99% of it.
 * When the meta moves the set re-derives; a hand-kept list would go stale and nobody would notice,
 * which is the failure this repo has had four separate times.
 *
 * IT IS THE UNION OF THE RAW AND THE CLEAN CORPUS, and that is measured rather than assumed — the
 * comfortable story ("raw is conservative, bot spam only adds junk") is wrong in one of the two
 * directions. The raw store sees MORE distinct entities and demands a SMALLER 99% prefix, because
 * repeated bot clicks concentrate the distribution; engine/quality.js's 8,193 clean games see fewer
 * entities and demand a LARGER prefix. Neither dominates, so picking one would have quietly relaxed
 * the bar. The numbers are in the header of tests/regulation_usage.js.
 *
 * WHAT IT ASSERTS, and each is a different question:
 *   a. every entity in the 99% set HAS A TAG            -- can the engine know anything about it
 *   b. every tag those entities carry HAS A PROBE       -- has anybody ever asked
 *   c. that probe is LIVE                               -- does the engine do the thing
 *   d. the CARVE-OUT set is covered regardless of usage -- Queenly Majesty is rank 50 at 0.361% and
 *      it blocked a real Sucker Punch in a real game on 2026-08-06
 *   e. the USAGE-WEIGHTED figure is printed beside the count, because they are wildly different
 *      numbers and only one of them is the true state: 33% of abilities armed reads respectably
 *      while 3.7% of ability USAGE armed does not.
 *
 * "NO PROBE" IS A WORSE STATE THAN "UNARMED" AND IS REPORTED SEPARATELY. An unarmed probe is a
 * probe somebody wrote and did not declare arms for; a tag with no probe at all is a mechanic nobody
 * has ever asked about. Folding them into one number hides the second inside the first.
 *
 * IT IS A RATCHET, NOT A PASS/FAIL BAR AT 100%. The counts below are not zero today and pretending
 * otherwise would produce a permanently red gate, which this project has already learned gets
 * reported as a "known failure" and then ignored (CLAUDE.md). So: the numbers may fall and may never
 * rise, the baseline lives in data/medicham-coverage.json, and it is re-stamped with `--stamp` by a
 * human who has looked at why it moved. A RISE IS WORK OWED WHETHER IT CAME FROM A REGRESSION OR
 * FROM A NEW METAGAME ENTRY -- both mean something high-usage is unprobed -- so both fail, and the
 * report says which tags are new since the baseline so the reader can tell them apart.
 *
 *   node tests/test-medicham-coverage.js            check against the baseline
 *   node tests/test-medicham-coverage.js --stamp    write the baseline (after looking at the diff)
 *   node tests/test-medicham-coverage.js --selftest plant a fault and prove the gate rejects it
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const U = require('./regulation_usage.js');

const SECTIONS = [['moves', 'move'], ['abilities', 'ability'], ['items', 'item']];
const COVER = 0.99;
const BASELINE = D('data', 'medicham-coverage.json');

/* ---- THE CARVE-OUT ------------------------------------------------------------------------------
 *
 * Will's rule: *anything that can turn a CERTAINTY into a FAILURE, regardless of usage.* A damage
 * multiplier being 10% wrong costs a little on every turn it fires. A refusal being absent costs the
 * whole game on the one turn it fires, and the search cannot price around it because the search
 * believes the click works.
 *
 * IT IS A SET OF TAGS, NOT A SET OF ENTITIES, AND THAT IS THE WHOLE POINT. Naming Queenly Majesty
 * would leave Dazzling and Armor Tail out, and an ability released next generation out of everything.
 * Naming `blocksMove` picks up all three today and the fourth for free. Every tag below is asserted to
 * EXIST in data/tags.json, so a rename upstream fails this file loudly instead of silently emptying
 * the carve-out -- which is the exact shape of every silent-default bug in docs/LESSONS.md.
 *
 * A tag with NO CARRIER that has any usage is excluded and PRINTED with its reason: Safety Goggles
 * (`blocksPowder`) and Covert Cloak (`blocksSecondary`) are banned in this format, so they carry a
 * rule the engine cannot be wrong about because it can never be asked. */
const CARVE_OUT = {
  /* THE ACTION DOES NOT HAPPEN AT ALL. */
  refusal: [
    ['ability', 'blocksMove'],          // Queenly Majesty / Dazzling / Armor Tail -- priority refused
    ['ability', 'immuneToMoveClass'],   // Bulletproof, Soundproof, Overcoat, Wind Rider
    ['ability', 'typeImmunity'],        // Levitate, Volt Absorb, Flash Fire, Sap Sipper...
    ['ability', 'refusesStatusMoves'],  // Good as Gold
    ['ability', 'statusImmune'],        // Insomnia, Limber, Purifying Salt
    ['ability', 'blocksBerries'],       // Unnerve -- the Sitrus that was going to save it does not
    ['ability', 'blocksExplosion'],     // Damp
    ['ability', 'preventsSwitch'],      // Shadow Tag / Arena Trap -- "I can leave" becomes false
    ['move', 'oneTurnGuard'],           // Protect and family
    ['move', 'preTurnShield'],
    ['move', 'forbidsStatusMoves'],     // Taunt
    ['move', 'sealsMoves'],             // Disable
    ['move', 'blocksSoundMoves'],       // Throat Chop
    ['move', 'ignoresProtect'],         // the other side of the same certainty
    ['move', 'powder'],                 // a Grass type / Overcoat ignores it
    ['item', 'blocksPowder'],
    ['item', 'blocksSecondary'],
  ],
  /* THE ACTION HAPPENS SOMEWHERE ELSE. Aiming is a certainty right up until it is not. */
  redirection: [
    ['ability', 'redirectsType'],       // Lightning Rod, Storm Drain
    ['ability', 'reflectsStatusMoves'], // Magic Bounce
    ['move', 'redirects'],              // Follow Me, Rage Powder
  ],
};

function load() {
  const usage = U.load();
  const tags = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));
  const census = JSON.parse(fs.readFileSync(D('data', 'mechanics-census.json'), 'utf8'));
  return { usage, tags, census };
}

/* (kind|tag) -> what the census knows about it. `live` is "at least one probe of this tag executed
 * and showed the mechanic"; `armed` additionally requires that probe to declare {control, test}. */
function probeIndex(census) {
  const ix = new Map();
  for (const r of census.results) {
    const k = r.kind + '|' + r.tag;
    const e = ix.get(k) || { n: 0, live: 0, armed: 0, labels: [] };
    e.n++; if (r.live) e.live++; if (r.live && r.armed) e.armed++;
    if (e.labels.length < 2) e.labels.push(r.label);
    ix.set(k, e);
  }
  return ix;
}

function analyse(o) {
  const ix = probeIndex(o.census);
  const out = { kinds: {}, noTag: [], noProbe: [], notLive: [], notArmed: [], carve: [], carveDead: [] };
  for (const [sec, kind] of SECTIONS) {
    const pre = U.coverUnion(o.usage, sec, COVER);
    const rows = o.tags[sec] || {};
    let usageTotal = 0, wTag = 0, wProbe = 0, wLive = 0, wArmed = 0;
    let nTag = 0, nProbe = 0, nLive = 0, nArmed = 0;
    const tagsSeen = new Map();
    for (const id of pre.ids) {
      const uses = U.usesOf(o.usage, sec, id);
      usageTotal += uses;
      const row = rows[id];
      const carried = (row && row.tags) ? row.tags.filter(t => t !== 'untagged') : [];
      /* `untagged` IS THE ARTIFACT SAYING "NO MECHANIC DERIVED", and what that means depends on the
       * kind. A MOVE with no mechanic is a vanilla attack -- Power Gem and Hydro Pump hit for damage
       * and do nothing else, and the generic damage path covers them completely, so counting them as
       * a gap would be counting the engine working. An ABILITY or an ITEM with no mechanic is a real
       * hole: every ability in the game does something, so `untagged` there means nobody has derived
       * what. The two are counted separately for exactly that reason, and only the second is a gap. */
      if (!carried.length) {
        out.noTag.push({ kind, id, uses, vanilla: kind === 'move' });
        continue;
      }
      nTag++; wTag += uses;
      let allProbed = true, allLive = true, allArmed = true;
      for (const t of carried) {
        const key = kind + '|' + t;
        const e = ix.get(key);
        if (!tagsSeen.has(key)) tagsSeen.set(key, 0);
        tagsSeen.set(key, tagsSeen.get(key) + uses);
        if (!e) { allProbed = allLive = allArmed = false; }
        else {
          if (!e.live) { allLive = false; allArmed = false; }
          else if (!e.armed) allArmed = false;
        }
      }
      if (allProbed) { nProbe++; wProbe += uses; }
      if (allLive) { nLive++; wLive += uses; }
      if (allArmed) { nArmed++; wArmed += uses; }
    }
    for (const [key, uses] of tagsSeen) {
      const e = ix.get(key);
      if (!e) out.noProbe.push({ key, uses });
      else if (!e.live) out.notLive.push({ key, uses, labels: e.labels });
      else if (!e.armed) out.notArmed.push({ key, uses });
    }
    out.kinds[kind] = { set: pre.ids.length, all: pre.all, fromRaw: pre.raw, fromClean: pre.clean,
                        usageTotal, nTag, nProbe, nLive, nArmed, wTag, wProbe, wLive, wArmed };
  }
  out.noProbe.sort((a, b) => b.uses - a.uses);
  out.notLive.sort((a, b) => b.uses - a.uses);
  out.notArmed.sort((a, b) => b.uses - a.uses);

  /* (d) THE CARVE-OUT, checked whatever the usage says. */
  const known = new Set(o.tags.tags.map(x => x.kind + '|' + x.tag));
  for (const [family, list] of Object.entries(CARVE_OUT)) {
    for (const [kind, tag] of list) {
      const key = kind + '|' + tag;
      if (!known.has(key)) { out.carve.push({ family, key, state: 'TAG-NOT-IN-ARTIFACT', uses: 0 }); continue; }
      const sec = { move: 'moves', ability: 'abilities', item: 'items' }[kind];
      let uses = 0;
      for (const [id, row] of Object.entries(o.tags[sec] || {}))
        if ((row.tags || []).includes(tag)) uses += U.usesOf(o.usage, sec, id);
      /* TWO DIFFERENT REASONS A CARVE-OUT TAG CAN BE OUT OF SCOPE, and collapsing them would hide the
       * one that matters. `no-carrier` means data/tags.json has NO ROW carrying the tag at all --
       * Safety Goggles and Covert Cloak are `isNonstandard: 'Past'` in this format and the artifact
       * does not carry them. `unused` means carriers exist and not one of them has been clicked or
       * declared: Arena Trap, Magnet Pull and Shadow Tag are all real rows at zero. The second could
       * become live tomorrow without any code changing, so it is named separately. */
      const carriers = Object.entries(o.tags[sec] || {}).filter(([, r]) => (r.tags || []).includes(tag)).length;
      if (uses === 0) { out.carveDead.push({ family, key, why: carriers ? 'unused' : 'no-carrier', carriers }); continue; }
      const e = ix.get(key);
      const state = !e ? 'NO PROBE' : !e.live ? 'NOT LIVE' : !e.armed ? 'UNARMED' : 'ok';
      out.carve.push({ family, key, state, uses });
    }
  }
  return out;
}

const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : 'n/a';

function report(o, a) {
  console.log('MEDICHAM COVERAGE — is the engine wired on what this regulation actually clicks?\n');
  console.log(`  RAW   corpus: ${o.usage.raw.games.toLocaleString()} games, `
    + `${o.usage.raw.sheetEntries.toLocaleString()} declared sheet entries, `
    + `${o.usage.raw.setEntries.toLocaleString()} inferred sets, `
    + `${o.usage.raw.clicks.toLocaleString()} clicks`);
  console.log(`  CLEAN corpus: ${o.usage.clean.games.toLocaleString()} games (engine/quality.js — `
    + `config, reason set and behavioural bot detector), `
    + `${o.usage.clean.clicks.toLocaleString()} clicks`);
  console.log(`  target: the UNION of the two ${(COVER * 100).toFixed(0)}%-of-usage sets, DERIVED on `
    + 'this run — never a hard-coded list, and never one corpus\n');
  console.log('  kind        99%-set / all     tagged   every tag probed   every probe LIVE   and ARMED');
  for (const [, kind] of SECTIONS) {
    const k = a.kinds[kind];
    console.log('  ' + kind.padEnd(10)
      + (k.set + ' / ' + k.all).padStart(12)
      + String(k.nTag).padStart(12) + String(k.nProbe).padStart(19)
      + String(k.nLive).padStart(19) + String(k.nArmed).padStart(11));
  }
  console.log('              (the union: ' + SECTIONS.map(([, kind]) =>
    kind + ' raw ' + a.kinds[kind].fromRaw + ' / clean ' + a.kinds[kind].fromClean).join(', ') + ')');
  /* (e) THE SAME FOUR COLUMNS, WEIGHTED BY USAGE. This is the pair of numbers the whole file exists
   * to put side by side: a count treats Protect and a 12-use gimmick as one row each. */
  console.log('\n  THE SAME THING WEIGHTED BY USAGE — the true state, and it is not the same number');
  console.log('  kind          usage in set     tagged   every tag probed   every probe LIVE   and ARMED');
  for (const [, kind] of SECTIONS) {
    const k = a.kinds[kind];
    console.log('  ' + kind.padEnd(10) + String(k.usageTotal).padStart(14)
      + pct(k.wTag, k.usageTotal).padStart(11)
      + pct(k.wProbe, k.usageTotal).padStart(19)
      + pct(k.wLive, k.usageTotal).padStart(19)
      + pct(k.wArmed, k.usageTotal).padStart(11));
  }

  const gapNoTag = a.noTag.filter(r => !r.vanilla), vanilla = a.noTag.filter(r => r.vanilla);
  console.log(`\n  (a) entities in the 99% set the artifact derived NO MECHANIC for: ${a.noTag.length}`);
  console.log(`      of those, ABILITIES and ITEMS — a real hole, because every one of them does `
    + `something: ${gapNoTag.length}`);
  for (const r of gapNoTag) console.log(`        ${r.kind} ${r.id}  (${r.uses} uses)`);
  console.log(`      of those, MOVES — a vanilla attack with no mechanic, which the generic damage `
    + `path covers: ${vanilla.length}`);
  for (const r of vanilla) console.log(`        ${r.kind} ${r.id}  (${r.uses} uses)`);
  console.log(`  (b) tags carried by that set with NO PROBE AT ALL: ${a.noProbe.length}`
    + '   — a worse state than "unarmed", and counted apart from it');
  for (const r of a.noProbe) console.log(`      ${r.key.padEnd(28)} ${r.uses} uses of carriers in the set`);
  console.log(`  (c) tags whose every probe reports MISSING: ${a.notLive.length}`);
  for (const r of a.notLive) console.log(`      ${r.key.padEnd(28)} ${r.uses}   ${r.labels.join(' | ')}`);
  console.log(`      tags probed and live but with no ARMED probe: ${a.notArmed.length}`);

  console.log(`\n  (d) THE CARVE-OUT — armed regardless of usage. ${a.carve.length} tags in scope, `
    + `${a.carveDead.length} excluded as unreachable in this format`);
  for (const r of a.carveDead) console.log(`      skipped  ${r.key.padEnd(28)} `
    + (r.why === 'no-carrier'
       ? 'no row in data/tags.json carries this tag at all (the item is isNonstandard in this format)'
       : `${r.carriers} carrier(s) in the artifact, none with any usage in the corpus`));
  for (const r of a.carve.filter(x => x.state !== 'ok'))
    console.log(`      ${r.state.padEnd(18)} ${r.key.padEnd(28)} ${r.uses} uses  (${r.family})`);
  console.log(`      ok: ${a.carve.filter(x => x.state === 'ok').length} of ${a.carve.length}`);
}

function summary(a) {
  return {
    noTag: a.noTag.length,
    noTagNonMove: a.noTag.filter(r => !r.vanilla).length,
    noProbe: a.noProbe.length,
    notLive: a.notLive.length,
    notArmed: a.notArmed.length,
    carveNotOk: a.carve.filter(x => x.state !== 'ok').length,
    carveNoProbeOrDead: a.carve.filter(x => x.state === 'NO PROBE' || x.state === 'NOT LIVE'
                                            || x.state === 'TAG-NOT-IN-ARTIFACT').length,
    noProbeKeys: a.noProbe.map(x => x.key).sort(),
    carveNotOkKeys: a.carve.filter(x => x.state !== 'ok').map(x => x.key + '=' + x.state).sort(),
  };
}

function check(now, base) {
  const fails = [];
  const RATCHETS = [['noTagNonMove', '(a) abilities/items the artifact derived no mechanic for'],
                    ['noTag', '(a) entities with no derived mechanic, including vanilla moves'],
                    ['noProbe', '(b) tags with no probe at all'],
                    ['notLive', '(c) tags whose probes all report MISSING'],
                    ['notArmed', 'tags live but with no armed probe'],
                    ['carveNotOk', '(d) carve-out tags not fully covered']];
  for (const [k, label] of RATCHETS)
    if (now[k] > base[k]) fails.push(`${label}: ${base[k]} -> ${now[k]}`);
  /* WHICH ROWS ARE NEW, so a rise caused by the METAGAME moving can be told from a rise caused by a
   * probe being deleted. Both are work owed and both fail; only one is a regression. */
  const wasNoProbe = new Set(base.noProbeKeys || []);
  const fresh = (now.noProbeKeys || []).filter(k => !wasNoProbe.has(k));
  return { fails, fresh };
}

/* ---- THE SELFTEST -------------------------------------------------------------------------------
 *
 * A GATE THAT HAS NEVER FAILED HAS NEVER BEEN TESTED, which is the standing rule in docs/ENGINE.md
 * and the reason every probe in this repo gets shown red before it is trusted. This plants the exact
 * fault the gate exists to catch -- a high-usage entity carrying a tag nothing probes -- and asserts
 * the gate rejects it. It touches nothing on disk: the corpus, the tag artifact and the census are
 * all deep-copied in memory first.
 *
 * THE PLANT IS DERIVED, NOT NAMED. It takes the single highest-usage MOVE in the corpus and gives it
 * a tag that appears nowhere in the census, so the test cannot rot when the metagame moves and cannot
 * accidentally plant something already broken. */
function selftest() {
  const o = load();
  const clean = analyse(o);
  const cleanS = summary(clean);
  const top = Object.entries(o.usage.raw.moves).sort((x, y) => y[1] - x[1])[0];
  const planted = JSON.parse(JSON.stringify(o));
  planted.tags.moves[top[0]] = planted.tags.moves[top[0]] || { name: top[0], tags: [] };
  planted.tags.moves[top[0]].tags = (planted.tags.moves[top[0]].tags || [])
    .concat(['__selftest_unprobed_mechanic']);
  const dirty = analyse(planted);
  const dirtyS = summary(dirty);
  const res = check(dirtyS, cleanS);
  console.log('SELFTEST — plant a high-usage entity carrying a tag nothing probes\n');
  console.log(`  planted on the single most-used move in the corpus: ${top[0]} (${top[1]} uses)`);
  console.log(`  clean: noProbe ${cleanS.noProbe};  planted: noProbe ${dirtyS.noProbe}`);
  console.log(`  the gate reports ${res.fails.length} failure(s): ${res.fails.join('; ') || '(none)'}`);
  console.log(`  new-since-baseline rows named: ${res.fresh.join(', ') || '(none)'}`);

  /* THE SECOND FAULT, because "no probe" and "a probe that does not work" are different states and a
   * gate that only saw one of them would be half a gate. Every probe of a tag the top move carries is
   * marked MISSING, and (c) must catch it while (b) stays clean. */
  const planted2 = JSON.parse(JSON.stringify(o));
  const victimTag = (o.tags.moves[top[0]].tags || []).filter(t => t !== 'untagged')[0];
  let hit = 0;
  for (const r of planted2.census.results)
    if (r.kind === 'move' && r.tag === victimTag) { r.live = false; hit++; }
  const dead = summary(analyse(planted2));
  const res2 = check(dead, cleanS);
  console.log(`\n  killed every probe of move|${victimTag} (${hit} of them), which ${top[0]} carries`);
  console.log(`  clean: notLive ${cleanS.notLive};  killed: notLive ${dead.notLive}`);
  console.log(`  the gate reports ${res2.fails.length} failure(s): ${res2.fails.join('; ') || '(none)'}`);

  /* THE THIRD FAULT: the carve-out, which is the half that does NOT depend on usage. */
  const planted3 = JSON.parse(JSON.stringify(o));
  let hit3 = 0;
  for (const r of planted3.census.results)
    if (r.kind === 'ability' && r.tag === 'blocksMove') { r.live = false; hit3++; }
  const broke = summary(analyse(planted3));
  const res3 = check(broke, cleanS);
  console.log(`\n  killed every probe of ability|blocksMove (${hit3}) — Queenly Majesty, rank 50, 0.361%`);
  console.log(`  clean: carveNotOk ${cleanS.carveNotOk};  killed: carveNotOk ${broke.carveNotOk}`);
  console.log(`  the gate reports ${res3.fails.length} failure(s): ${res3.fails.join('; ') || '(none)'}`);

  const ok = res.fails.length > 0 && hit > 0 && res2.fails.length > 0
          && hit3 > 0 && res3.fails.length > 0;
  console.log(`\n  SELFTEST ${ok ? 'PASSED — the gate rejects all three planted faults'
    : 'FAILED — a planted fault did not fail the gate'}`);
  return ok ? 0 : 1;
}

function main() {
  if (process.argv.includes('--selftest')) return selftest();
  const o = load();
  const a = analyse(o);
  report(o, a);
  const now = summary(a);
  /* A MISSING BASELINE IS A LEGITIMATE STATE — the first run has nothing to hold — but "there is no
   * baseline yet" and "the baseline is corrupt" are different events, and a bare catch makes them one.
   * The reason is kept and PRINTED, so a ratchet that silently stopped ratcheting is readable rather
   * than inferred. Same correction the arms ratchet in tests/test-mechanics.js already carries. */
  let base = null, baseFail = '';
  try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).ratchet; }
  catch (e) { baseFail = String(e.message).slice(0, 120); }
  if (!base && baseFail && fs.existsSync(BASELINE))
    console.log('\n  NOTE: the coverage RATCHET could not read its baseline — ' + baseFail);

  if (process.argv.includes('--stamp')) {
    fs.writeFileSync(BASELINE, JSON.stringify({
      generated: new Date().toISOString(), by: 'tests/test-medicham-coverage.js',
      what: 'Will\'s 99%-of-usage coverage target plus the certainty-to-failure carve-out. Every '
          + 'number here is RATCHETED DOWNWARD: it may fall and may never rise. Re-stamp only after '
          + 'looking at why it moved — a rise is work owed whether it came from a regression or from '
          + 'the metagame bringing in something nobody has probed.',
      corpus: o.usage.corpus, coverFraction: COVER,
      weighted: Object.fromEntries(SECTIONS.map(([, k]) => [k, {
        usageInSet: a.kinds[k].usageTotal,
        tagged: a.kinds[k].wTag / (a.kinds[k].usageTotal || 1),
        probed: a.kinds[k].wProbe / (a.kinds[k].usageTotal || 1),
        live: a.kinds[k].wLive / (a.kinds[k].usageTotal || 1),
        armed: a.kinds[k].wArmed / (a.kinds[k].usageTotal || 1),
      }])),
      ratchet: now,
    }, null, 1) + '\n');
    console.log('\n  stamped data/medicham-coverage.json');
    return 0;
  }

  if (!base) {
    console.log('\n  NO BASELINE — data/medicham-coverage.json is absent or unreadable, so nothing is '
      + 'ratcheted this run. Stamp one with --stamp.');
    return 0;
  }
  const res = check(now, base);
  if (res.fresh.length)
    console.log('\n  NEW SINCE THE BASELINE (a tag that entered the 99% set, not necessarily a '
      + 'regression): ' + res.fresh.join(', '));
  if (res.fails.length) {
    console.log('\n  FAILED — coverage went backwards:');
    for (const f of res.fails) console.log('    ' + f);
    console.log('  Write the probe, or re-stamp with --stamp and say in docs/ENGINE.md why the rise '
      + 'is acceptable. Do not file it as a known failure.');
    return 1;
  }
  console.log('\n  COVERAGE RATCHET HELD — nothing went backwards against data/medicham-coverage.json');
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { analyse, summary, load, CARVE_OUT, COVER };
