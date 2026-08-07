/* diff_swarm.js — TEAM SELECTION FOR THE WHOLE-GAME DIFFERENTIAL. ROADMAP #68, docs/GAME-DIFFERENTIAL-DESIGN.md §3.
 *
 *   node engine/diff_swarm.js                 print the swarm's composition
 *   node engine/diff_swarm.js --n 1000        target that many teams
 *   node engine/diff_swarm.js --write         also write data/diff-swarm.json
 *   node engine/diff_swarm.js --selftest      drive the config logic on synthetic teams
 *
 * WHY THIS IS NOT `pick 1000 teams at random`
 * -------------------------------------------
 * Swarm Testing (Groce, Zhang, Eide, Chen, Regehr, ISSTA 2012): a population of configurations that
 * each OMIT some features finds dramatically more than one configuration that enables everything —
 * 42% more distinct compiler crashes in a week than a hand-tuned default. The mechanism is that some
 * features actively suppress the behaviour you are trying to reach, and that features compete for
 * space so a uniform sample explores each one shallowly.
 *
 * OUR SUPPRESSING FEATURE IS PROTECT. Measured here: it is on 99.30% of declared teams and it is the
 * most common click in the format. A Protect turn resolves no damage, no secondary, no contact
 * ability and no field interaction. A uniform draw spends an enormous share of its turns testing
 * nothing at all.
 *
 * BUT OMISSION IS NOT THE ONLY AXIS, and Will named the case that proves it: *"some moves hit thru
 * protect, like feint or unseen fist."* A mechanic that exists only as an INTERACTION WITH a feature
 * cannot be reached by removing that feature. Drop Protect everywhere and Feint and Phantom Force
 * become untestable. So the swarm carries PAIRING configurations too — a feature concentrated WITH
 * its counters — and omission buys DEPTH while pairing buys the INTERACTION surface.
 *
 * TEAMS COME FROM THE STORE, NEVER FROM A GENERATOR, and the strongest evidence is Will's read that
 * *"quash is used on prankster mons like sableye specifically to get prio"*: 252 of 252 declared
 * Quash carriers in this corpus are Sableye with Prankster. 100%. Quash is priority 0 and fails if
 * the target already moved, so Prankster's +1 is the entire reason it is playable. A generator would
 * have scattered Quash across random bodies and produced only the version nobody has ever brought.
 *
 * IT READS THE OPEN-SHEET CORPUS, because those games carry `sheets` — the DECLARED team of six,
 * which is what a team actually is. The closed-sheet ladder store only reveals what was clicked.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const WRITE = process.argv.includes('--write');
const N = (() => { const i = process.argv.indexOf('--n'); return i > 0 ? +process.argv[i + 1] : 1000; })();
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
/* Nothing here fails quietly — tests/test-no-silent-failure.js is a ratchet and a skip that says
 * nothing turns a missing corpus into an empty swarm that looks like a successful one. */
const SKIPS = []; let UNREADABLE = 0;

/* ---- THE STARVATION RESULT, AND WHY OMISSION BELONGS ON THE DRIVER --------------------------------
 * First real run, 7,256 distinct declared teams:
 *
 *     omit-protect      84 available  (1.16%)   STARVED
 *     omit-priority      7 available  (0.10%)   STARVED
 *
 * SEVEN teams in seven thousand carry no priority move. You cannot build a Protect-free or
 * priority-free swarm out of real teams because real teams do not do that.
 *
 * Swarm Testing omits features FROM THE GENERATOR; we sample a fixed corpus and cannot. But the
 * omission does not have to happen to the TEAM — it can happen to the DRIVER. Keep the real team,
 * bundles and all, and in that configuration simply forbid the driver from CLICKING the feature.
 * Full benefit (turns stop being consumed by nothing), no cost (teams stay real, Sableye+Prankster
 * stays intact), and it works for every axis. It also matches the split the design already draws:
 * the swarm picks WHICH TEAMS take the field, the driver picks WHICH CLICKS happen.
 *
 * AND THE OMISSION MUST BE SCOPED PER CONFIGURATION, NEVER GLOBAL. Will: "but if we ban protect we
 * ban feint and piercing drill." Exactly — `omit-protect` forbids the click, `pair-protect-bust`
 * REQUIRES it and then clicks the buster into it. Both configs run in the same swarm. A global
 * "ban Protect" driver flag would silently destroy every pairing config while looking like it worked.
 *
 * The team-side predicates below stay, because they still select the POOL correctly for the pairing
 * configs and they cost nothing for the omit ones. The driver-side ban is what makes the omit configs
 * actually bite, and it is not this file's job.
 */

/* ---- THE CONFIGURATIONS ------------------------------------------------------------------------
 * A config is a PREDICATE over a team plus a stated reason. `omit` configs exclude a feature so the
 * turns it would have consumed go elsewhere; `pair` configs require a feature AND something that
 * interacts with it, because that interaction is the thing under test.
 *
 * The feature sets are read from data/tags.json by SHAPE, never typed as move names — a move added
 * to the format later joins the right family without editing this file. That is the same rule the
 * engine follows and the same one the hand-maintained ban list failed. */
function featureSets() {
  /* THROUGH engine/names.js, WHICH THROWS ON A TAG NAME THAT DOES NOT EXIST. Both of the vacuous
   * configs described below were a guessed tag name silently producing an empty set; names.byTag
   * makes that a crash at the call site instead of a confident zero in the report.
   * (It is names.js and not lookup.js because lookup.js already existed for a different job — see
   * that file's header, and names.js's, for why writing the second one over the first broke
   * self-play for an hour.) */
  const { byTag } = require('./names.js');
  const F = {
    protect:     byTag('moves', 'stalling', 'oneTurnGuard'),
    protectBust: byTag('moves', 'ignoresProtect'),
    priority:    byTag('moves', 'priority'),
    redirect:    byTag('moves', 'redirects'),
    weather:     byTag('moves', 'setsWeather'),
    weatherAb:   byTag('abilities', 'weatherSetter'),
    speedCtrl:   byTag('moves', 'reversesSpeed', 'doublesSideSpeed', 'reordersTurn'),
    intimidate:  byTag('abilities', 'onSwitchInDrop'),
    spread:      byTag('moves', 'spreadAll', 'spreadFoes'),
  };
  /* AN EMPTY FEATURE SET MAKES ITS CONFIG VACUOUS, AND THAT IS HOW THIS FILE WAS WRONG ON ITS FIRST
   * REAL RUN. `intimidate` was derived as /^lowersOnEntry$/, which matches nothing — the tag is
   * `onSwitchInDrop` — so the set came back empty, `!teamHas(team, emptySet)` was always true, and
   * `omit-intimidate` reported 100% of the pool while excluding NOTHING. It looked like the
   * best-covered configuration in the swarm and it was the only one doing no work.
   *
   * The selftest did not catch it because the selftest HAND-SUPPLIES these sets; only the production
   * path derives them from tags.json. That is the exact shape this project keeps finding — a check
   * that passes on synthetic input and is vacuous on real input — so the guard is here, at the
   * derivation, where the real names live. */
  const empty = Object.entries(F).filter(([, v]) => !v.size).map(([k]) => k);
  if (empty.length) {
    console.error('diff_swarm: these feature sets derived EMPTY, so every config using them would be vacuous: '
                  + empty.join(', '));
    console.error('  A tag name in featureSets() does not match data/tags.json. Fix the name, do not ignore this.');
    process.exit(1);
  }
  return F;
}

/* THE DECLARED EXCEPTION, per conformance S12b. Two Pokemon names appear in this file — `protect`
 * and `intimidate` — and neither is a lookup. They are CONFIGURATION IDENTIFIERS (`omit-protect`,
 * `pair-protect-bust`, `omit-intimidate`) and the prose that explains why each config exists. A
 * config needs a name a human can read in a report; "omit-cfg-3" would be worse in every way.
 *
 * EVERY ACTUAL MEMBERSHIP TEST GOES THROUGH `lookup.byTag`, which throws on a tag name that does not
 * exist. That is the distinction S12b is protecting: a typed name that DECIDES something is a
 * hardcode and rots silently; a typed name that LABELS something is documentation. If Protect were
 * renamed tomorrow the labels would read oddly and the behaviour would be unchanged, because the set
 * is derived from `stalling`/`oneTurnGuard`.
 *
 * This block is the declaration S12b asks for. If a THIRD name appears here, check it is a label
 * before adding it — a lookup hiding in this list is exactly what the check exists to catch. */
const GAME_RULES = {
  'move:protect':      'label only — config ids omit-protect / pair-protect-bust; the set comes from byTag(stalling, oneTurnGuard)',
  'ability:intimidate': 'label only — config id omit-intimidate; the set comes from byTag(onSwitchInDrop)',
};

/* A team is {species, ability, item, moves[]}. These read only what a sheet declares. */
const teamHas = (team, set, field) => team.some(p => {
  if (field === 'moves') return ((p && p.moves) || []).some(m => set.has(norm(m)));
  return set.has(norm((p && p[field]) || ''));
});

function configs(F) {
  return [
    { id: 'baseline',        why: 'a uniform draw, kept as the CONTROL — every other config is judged against what this reaches',
      ok: () => true },
    { id: 'omit-protect',    why: 'Protect is on 99.3% of teams and a Protect turn resolves nothing. Omitting it is the single largest source of turns that actually do something',
      ok: t => !teamHas(t, F.protect, 'moves') },
    { id: 'omit-priority',   why: 'frees the ordinary speed-order path and dynamic re-sorting (WIRE 118), which priority brackets otherwise short-circuit',
      ok: t => !teamHas(t, F.priority, 'moves') },
    { id: 'omit-weather',    why: 'reaches the no-weather damage path and lets terrain matter',
      ok: t => !teamHas(t, F.weather, 'moves') && !teamHas(t, F.weatherAb, 'ability') },
    { id: 'omit-intimidate', why: 'attack stages sit at their declared values, which is also the only way to see a crit ignoring a NEGATIVE offensive stage',
      ok: t => !teamHas(t, F.intimidate, 'ability') },
    { id: 'omit-spread',     why: 'single-target resolution, and the ally-damage path stops dominating',
      ok: t => !teamHas(t, F.spread, 'moves') },
    /* PAIRING — the interaction cannot be reached by omission, only by concentration. */
    { id: 'pair-protect-bust', why: 'Feint and Phantom Force need a Protect to punch THROUGH. Omitting Protect makes them untestable — Will named this case',
      ok: t => teamHas(t, F.protect, 'moves') && teamHas(t, F.protectBust, 'moves') },
    { id: 'pair-redirect-priority', why: 'redirection against a priority move is where the turn order and the target choice interact',
      ok: t => teamHas(t, F.redirect, 'moves') && teamHas(t, F.priority, 'moves') },
    { id: 'pair-speedctrl',  why: 'Trick Room is on 37.4% of teams and INVERTS every speed comparison for five turns, on top of dynamic re-sorting. Concentrating it with other speed control is the hardest ordering surface in the format',
      ok: t => teamHas(t, F.speedCtrl, 'moves') },
  ];
}

/* ---- SELFTEST ---------------------------------------------------------------------------------
 * Shown failing on known-bad input before it is committed, per the standing rule. The cases that
 * matter are the two directions: an omit config must REJECT a team carrying the feature, and a pair
 * config must REJECT a team carrying only one half. A config that accepts everything is not a
 * configuration, it is the baseline wearing a label. */
if (process.argv.includes('--selftest')) {
  /* ABSTRACT FIXTURE NAMES ON PURPOSE. Naming real moves here would (a) trip conformance S12, which is
   * right to object — a Pokemon fact typed into code is a fact that can go stale — and (b) weaken the
   * test, because what is under test is the PREDICATE LOGIC, not whether Protect is spelled correctly.
   * The real names are asserted by engine/lookup.js's own selftest, which is where they belong. */
  const F = { protect: new Set(['feata']), protectBust: new Set(['featb']), priority: new Set(['featc']),
              redirect: new Set(['featd']), weather: new Set(['feate']), weatherAb: new Set(['featf']),
              speedCtrl: new Set(['featg']), intimidate: new Set(['feath']), spread: new Set(['feati']) };
  const C = Object.fromEntries(configs(F).map(c => [c.id, c]));
  const mon = (o = {}) => ({ species: o.s || 'x', ability: o.ab || '', item: '', moves: o.mv || [] });
  const cases = [
    ['omit-protect REJECTS a team with Protect',        'omit-protect', [mon({ mv: ['feata'] })], false],
    ['omit-protect ACCEPTS a team without it',          'omit-protect', [mon({ mv: ['feati'] })], true],
    ['omit-intimidate reads the ABILITY, not moves',    'omit-intimidate', [mon({ ab: 'feath' })], false],
    ['omit-weather rejects a weather ABILITY too',      'omit-weather', [mon({ ab: 'featf' })], false],
    ['pair-protect-bust REJECTS Protect alone',         'pair-protect-bust', [mon({ mv: ['feata'] })], false],
    ['pair-protect-bust REJECTS the buster alone',      'pair-protect-bust', [mon({ mv: ['featb'] })], false],
    ['pair-protect-bust ACCEPTS both together',         'pair-protect-bust', [mon({ mv: ['feata', 'featb'] })], true],
    ['pair-protect-bust ACCEPTS them on DIFFERENT mons','pair-protect-bust', [mon({ mv: ['feata'] }), mon({ mv: ['featb'] })], true],
    ['baseline accepts anything',                       'baseline', [mon()], true],
  ];
  let bad = 0;
  for (const [label, id, team, want] of cases) {
    const got = !!C[id].ok(team);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `   got ${got}`}`);
  }
  /* THE REGRESSION THAT WOULD MAKE THE WHOLE THING POINTLESS: a config that accepts every team is
   * the baseline with a different name, and would report coverage it never bought. */
  const trivial = configs(F).filter(c => c.id !== 'baseline')
    .filter(c => c.ok([mon({ mv: ['feata','featb','featc','featd','feate','featg','feati'], ab: 'feath' })])
              && c.ok([mon()]));
  if (trivial.length) { bad++; console.log('  FAIL these configs accept everything: ' + trivial.map(c => c.id).join(', ')); }
  else console.log('  ok   no config accepts every team — each one actually constrains');
  console.log(`\nDIFF-SWARM SELFTEST: ${cases.length + 1 - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ---- RUN --------------------------------------------------------------------------------------- */
const F = featureSets();
const CFG = configs(F);

const teams = [];
const seen = new Set();
for (const f of ['data/games.bo3.jsonl', 'data/games.ots.jsonl']) {
  let raw;
  try { raw = fs.readFileSync(D(f), 'utf8'); }
  catch (e) { SKIPS.push(`${f}: ${String((e && e.message) || e).slice(0, 80)}`); continue; }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let g; try { g = JSON.parse(line); } catch (e) { UNREADABLE++; continue; }
    const sh = g.sheets; if (!sh) continue;
    for (const side of ['p1', 'p2']) {
      const t = sh[side] || []; if (t.length < 4) continue;
      /* DEDUPE ON THE TEAM, not the game. The same team laddering ten times is one configuration
       * tested ten times, which inflates the swarm's apparent breadth without buying any. */
      const key = t.map(p => norm((p && p.species) || '') + ':' + ((p && p.moves) || []).map(norm).sort().join('.')).sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      teams.push({ key, team: t, id: g.id });
    }
  }
}

const per = Math.max(1, Math.floor(N / CFG.length));
const out = [];
for (const c of CFG) {
  /* COUNTED, NOT SWALLOWED. A predicate that throws on a malformed sheet drops that team from the
   * config, and a config quietly missing teams is exactly the starvation this file reports on. */
  let threw = 0;
  const matching = teams.filter(x => {
    try { return c.ok(x.team); }
    catch (e) { threw++; if (threw === 1) SKIPS.push(`config ${c.id}: predicate threw on a team (${String((e && e.message) || e).slice(0, 60)}) — counted, not hidden`); return false; }
  });
  if (threw) SKIPS.push(`config ${c.id}: ${threw} team(s) dropped because the predicate threw`);
  /* DETERMINISTIC STRIDE, not a random draw — this file must produce the same swarm twice or the
   * differential's inputs move under it, and a measurement whose inputs move is the 2026-08-04 void. */
  const step = Math.max(1, Math.floor(matching.length / per));
  const picked = [];
  for (let i = 0; i < matching.length && picked.length < per; i += step) picked.push(matching[i]);
  out.push({ config: c.id, why: c.why, available: matching.length, picked: picked.length,
             pct_of_pool: +(100 * matching.length / Math.max(teams.length, 1)).toFixed(2),
             teams: picked.map(p => p.id) });
}

console.log('');
console.log('DIFF SWARM — team selection for the whole-game differential (ROADMAP #68 §3)');
console.log('');
console.log(`  distinct teams in the open-sheet corpus: ${teams.length.toLocaleString()}`);
console.log(`  target ${N} teams over ${CFG.length} configurations, ${per} each`);
console.log('');
console.log('  config'.padEnd(26), 'available'.padStart(10), 'picked'.padStart(8), '% of pool'.padStart(10));
for (const r of out) {
  const starved = r.picked < per;
  console.log('  ' + r.config.padEnd(24), String(r.available).padStart(10), String(r.picked).padStart(8),
              String(r.pct_of_pool + '%').padStart(10), starved ? '  <-- STARVED, could not fill' : '');
}
console.log('');
const empty = out.filter(r => !r.picked);
if (empty.length) {
  console.log('  CONFIGURATIONS THAT PRODUCED NO TEAMS — these tested NOTHING and must not be read as covered:');
  for (const r of empty) console.log(`    ${r.config}`);
  console.log('');
}
if (UNREADABLE) console.log(`  ${UNREADABLE} store line(s) would not parse and were counted, not skipped silently.`);
for (const s of SKIPS) console.log('  NOTE: ' + s);
console.log('');
console.log('  Omission buys DEPTH in what remains; pairing buys the INTERACTION surface.');
console.log('  A config that could not be filled is a gap in the swarm, not a gap in the format.');
console.log('');

if (WRITE) {
  fs.writeFileSync(D('data', 'diff-swarm.json'), JSON.stringify({
    generated: new Date().toISOString(), by: 'engine/diff_swarm.js',
    corpus_distinct_teams: teams.length, target: N, per_config: per,
    unreadable_lines: UNREADABLE, skips: SKIPS,
    configs: out,
  }, null, 2) + '\n');
  console.log('  -> data/diff-swarm.json');
}
