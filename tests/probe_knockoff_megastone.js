/* probe_knockoff_megastone.js — THE GUARD KEYS ON A BASE SPECIES, AND MEGA EVOLUTION REWRITES IT.
 *
 *   SHOWDOWN_PATH=... node tests/probe_knockoff_megastone.js
 *   ... --arm middle          (the default; any id in game_differential's ARMS)
 *
 * ================= THE RULE, READ OFF THE FORMAT ================================================
 *
 * Every mega stone in this regulation — 75 of them, and they are the ONLY legal items that declare an
 * `onTakeItem` at all — carries the identical handler (`data/items.ts`):
 *
 *     onTakeItem(item, source) { return !!item.megaStone?.[source.baseSpecies.baseSpecies]; }   (negated)
 *
 * Knock Off runs that SAME event twice and reads it for two different purposes (`data/moves.ts:9971`):
 *
 *     onBasePower: const item = target.getItem();
 *                  if (!this.singleEvent('TakeItem', ...)) return;   <- NO x1.5 when it is refused
 *                  if (item.id) return this.chainModify(1.5);
 *     onAfterHit:  const item = target.takeItem();                   <- and NO removal
 *
 * So into a body holding its OWN stone, Knock Off is a bare 65-power Dark move: no boost, no
 * `-enditem`. THE DAMAGE IS THE ASSERTION, not the absence of a line — an engine that skipped the
 * removal and kept the boost passes any check that only looks for `-enditem`.
 *
 * ================= THE EDGE, DERIVED AND NOT ASSUMED ============================================
 *
 * The guard keys on `source.baseSpecies.baseSpecies`, and `Pokemon#formeChange(..., isPermanent)` —
 * which is how mega evolution lands — REWRITES `pokemon.baseSpecies`. For 74 of the 75 stones the
 * mega forme's own `baseSpecies` string is the same key the stone names, so the guard still matches
 * and the stone stays welded on. This file walks all 75 at run time and prints the ones where it
 * STOPS matching. It does not name them here, because a name typed in a comment is the thing this
 * repository keeps paying for.
 *
 * ================= THE FIVE ARMS ================================================================
 *
 *   plain        an ordinary item on the generic body.        removal happens, x1.5 applies.  CONTROL
 *   stone        that body's own stone, un-evolved.           no removal, no boost.
 *   stone-mega   that body's own stone, AFTER it megas.       the general case.
 *   edge-plain   the derived exception's stone, un-evolved.   no removal, no boost.           CONTROL
 *   edge-mega    the derived exception's stone, AFTER it megas.  THE ARM.
 *
 * `plain` and `stone` differ in ONE thing and are the same species and the same forme, so the damage
 * gap between them IS the boost. If they came back equal the knob would be unwired.
 *
 * ================= WHICH SCOREBOARD =============================================================
 *
 * NOT the obscure tail. The exception's stone is in 3,762 of the 13,214 pinned-pool games and Knock
 * Off is 3,834 corpus uses — but the co-occurrence needs the body to have MEGA'D first, which is
 * rarer. Predicted before the run: the census gains the probe; the pinned pool does not move on this
 * pass, because this pass STAGES ONLY and lands no fix.
 *
 * IT WRITES NOTHING. No artifact is touched. It asserts and exits non-zero on a failure.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
require(D('tests', '_live_release.js'));

if (!process.argv.includes('--state')) process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
require(D('data', 'engine-data.js'));
const { mcKey } = require(D('engine', 'mc_key.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));

const ARM_ID = (() => { const i = process.argv.indexOf('--arm');
                        return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : 'middle'; })();
const ARM = (G.ARM_BY_ID && G.ARM_BY_ID.get) ? G.ARM_BY_ID.get(ARM_ID) : null;

const mon = (species, ability, moves, item) => ({ species, item: item || '', ability, moves });
/* HP IS NOT INFLATED HERE, AND THAT IS A MEASURED DECISION RATHER THAN A DEFAULT.
 *
 * The other probes in this family run `hpBoost` so a staged body cannot die mid-arm. IT CANNOT BE
 * USED IN AN ARM THAT MEGA EVOLVES. Showdown's `formeChange` RECOMPUTES `maxhp` from the species,
 * and the harness's multiplier is not part of that recomputation — so at x8 the authority's body
 * dropped 1320 -> 165 the instant it evolved while ours stayed at 1320, and every mega arm reported
 * a four-leaf board divergence that was the INSTRUMENT. Measured, not guessed: the mismatch was
 * exactly `maxhp` and exactly the factor 8, on both mega arms and neither un-evolved one.
 *
 * At x1 the 65-power hit takes roughly an eighth of the target, so nothing dies and no berry fires;
 * the fixture asserts both of those rather than trusting this paragraph. */
const HP_BOOST = 1;
const LEGAL = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const abilTags = a => ((TAGS.abilities || {})[id(a)] || {}).tags || [];

/* ================================================================================================
 * THE STONE TABLE, WALKED THIS RUN. Nothing below is typed, and the handler is EVALUATED rather
 * than PARAPHRASED — which is the whole finding of this pass.
 *
 * The first version of this block re-implemented the guard as `!!item.megaStone[megaSpecies.baseSpecies]`,
 * because 73 of the 75 stones really do read `source.baseSpecies.baseSpecies`. TWO DO NOT. They carry a
 * strictly stronger guard that reads `source.baseSpecies.NAME` and checks it against the megaStone map's
 * VALUES as well as its keys — so a mega FORME's own name matches and the stone stays welded on. Those
 * two are exactly the stones whose base has more than one forme; nothing else distinguishes them.
 *
 * The paraphrase declared one of them removable-after-mega and this file reported a divergence that did
 * not exist. Suspect the instrument before the engine: the ONLY safe reading of a handler is to CALL it.
 * ============================================================================================== */
console.log('\n  === THE STONE TABLE, WALKED THIS RUN ===');
const IDLES = ['Calm Mind', 'Swords Dance', 'Nasty Plot', 'Bulk Up', 'Iron Defense', 'Amnesia'];
/* ABILITIES THAT WOULD PUT A SECOND MECHANIC INSIDE THIS FIXTURE, NAMED BY TAG AND NEVER BY SPECIES.
 * Weather and terrain add a field line to every turn of the comparison; `passesItemToAlly` and
 * `copiesFoeAbility` MOVE THINGS — an item-moving ability inside a fixture about item removal is the
 * hole this whole file is built to avoid. The list is a set of TAGS, so an ability added to the format
 * later is caught without editing this file, and every exclusion it makes is printed below. */
const FIELD_TAGS = new Set(['weatherSetter', 'terrainSetter', 'passesItemToAlly', 'copiesFoeAbility']);
const clean = a => !abilTags(a).some(t => FIELD_TAGS.has(t));
/* The event Showdown itself raises is `singleEvent('TakeItem', item, itemState, target, target, move,
 * item)`, so the handler is called with (item, holder). It is invoked here with a minimal holder that
 * carries only what the handler reads — a Species object in `baseSpecies` — which is exactly the field
 * `Pokemon#formeChange(..., isPermanent)` rewrites when a body mega evolves. */
/* IT THROWS RATHER THAN ANSWERING null. A guard nobody could call is not a guard anybody can test,
 * and a `catch { return null }` here would hand the walk a third value that reads as "not removable"
 * at every call site downstream — a silent default wearing the shape of an answer. The message names
 * the stone and the forme, because a bare stack from inside a dex walk sends the next reader into
 * the engine looking for a fault that is in the format. */
const takeAllowed = (it, speciesObj) => {
  try { return it.onTakeItem.call({}, it, { baseSpecies: speciesObj }) !== false; }
  catch (e) {
    throw new Error('the TakeItem guard on ' + it.id + ' could not be evaluated against '
      + (speciesObj && speciesObj.name) + ' — it reads a field this probe does not supply. '
      + 'Widen the minimal holder rather than paraphrasing the handler; a paraphrase is what this '
      + 'file exists to stop. Underlying: ' + e.message);
  }
};
const SHAPES = new Map();
const CANDIDATES = [];
for (const it of dex.items.all().filter(i => LEGAL(i) && i.megaStone)) {
  const shape = String(it.onTakeItem).replace(/\s+/g, ' ');
  SHAPES.set(shape, (SHAPES.get(shape) || 0) + 1);
  for (const [baseKey, megaName] of Object.entries(it.megaStone)) {
    const bs = dex.species.get(baseKey), ms = dex.species.get(megaName);
    if (!bs.exists || !LEGAL(bs)) continue;
    const idle = IDLES.find(m => CS.canLearn(bs.name, m)) || null;
    const rowB = !!mcKey(bs.name, { mayMiss: 'a stone whose base this engine has no row for cannot be staged' });
    const rowM = !!mcKey(ms.name, { mayMiss: 'a stone whose mega forme this engine has no row for cannot be staged' });
    /* THE BASE ABILITY IS CHOSEN TO AVOID THE EXCLUDED TAGS FIRST AND ONLY THEN TO BE QUIET.
     * Sorting on tag COUNT alone picked a one-tag ability that was `passesItemToAlly` over a
     * three-tag one that was inert, and then the exclusion below threw the whole body out — so the
     * fixture lost its only minority-handler candidate to its own tidiness rule. */
    const baseAb = Object.values(bs.abilities || {})
      .slice().sort((x, y) => (clean(y) - clean(x)) || (abilTags(x).length - abilTags(y).length))[0];
    const megaTags = [].concat(...Object.values(ms.abilities || {}).map(abilTags));
    CANDIDATES.push({ item: it.id, base: bs.name, mega: ms.name, shape, idle, rowB, rowM, baseAb, megaTags,
                      allowedUnevolved: takeAllowed(it, bs), allowedAfterMega: takeAllowed(it, ms) });
  }
}
const byCount = [...SHAPES.entries()].sort((a, b) => b[1] - a[1]);
console.log('  legal stones walked                          : ' + CANDIDATES.length);
console.log('  DISTINCT onTakeItem handlers among them      : ' + SHAPES.size);
for (const [sh, n] of byCount) console.log('    x' + n + '   ' + sh);
const REMOVABLE_UNEVOLVED = CANDIDATES.filter(c => c.allowedUnevolved);
const REMOVABLE_AFTER = CANDIDATES.filter(c => c.allowedAfterMega);
console.log('  stones the handler lets go while UN-EVOLVED  : ' + REMOVABLE_UNEVOLVED.length
  + '  ' + JSON.stringify(REMOVABLE_UNEVOLVED.map(c => c.item + '@' + c.base)));
console.log('  stones the handler lets go AFTER MEGA        : ' + REMOVABLE_AFTER.length
  + '  ' + JSON.stringify(REMOVABLE_AFTER.map(c => c.item + '@' + c.mega)));
/* `takeAllowed` THROWS on a handler it cannot call, so there is no null to test for here. This block
 * used to guard against one and that guard was a lie in two directions: it could never fire, and its
 * existence implied the walk had a third answer. What is asserted instead is that every stone was
 * actually asked — an empty walk would print two clean zeros above and mean nothing. */
if (!CANDIDATES.length) {
  console.log('NOT RUN — no legal stone was walked at all, so the two counts above are vacuous. '
    + 'THIS IS A FAILED FIXTURE, NOT A PASS.');
  process.exit(2);
}
if (byCount.length < 2) {
  console.log('NOT RUN — the stones no longer carry two distinct handlers, so there is no minority '
    + 'code path left to stage. THIS IS A FAILED FIXTURE, NOT A PASS.');
  process.exit(2);
}
const MAJOR = byCount[0][0], MINOR = byCount[byCount.length - 1][0];

/* A FIELD-CHANGING ABILITY IS EXCLUDED BY ITS TAG, NOT BY ITS NAME. The first pick this made was a
 * body whose ability sets weather on entry, so every arm ran under snow and the `-weather` upkeep
 * line joined every turn of the comparison — a second mechanic inside a fixture about a first one.
 * `passesItemToAlly` goes with it: an ability that MOVES ITEMS has no business inside a fixture about
 * item removal. Both exclusions are the artifact's own shape and the excluded count is printed. */
const noField = c => !abilTags(c.baseAb).some(t => FIELD_TAGS.has(t)) && !c.megaTags.some(t => FIELD_TAGS.has(t));
const stageable = c => c.idle && c.rowB && c.rowM && c.baseAb;
const pick = shape => CANDIDATES.filter(c => c.shape === shape && stageable(c) && noField(c))
  .sort((a, b) => (abilTags(a.baseAb).length + a.megaTags.length)
                - (abilTags(b.baseAb).length + b.megaTags.length) || a.base.localeCompare(b.base))[0];
console.log('  stageable bodies on the MAJORITY handler     : '
  + CANDIDATES.filter(c => c.shape === MAJOR && stageable(c)).length
  + '   of which survive the ability exclusions: ' + CANDIDATES.filter(c => c.shape === MAJOR && stageable(c) && noField(c)).length);
const GENERIC = pick(MAJOR), EDGE = pick(MINOR);
if (!GENERIC || !EDGE) {
  console.log('NOT RUN — no stageable body on one of the two handlers. THIS IS A FAILED FIXTURE, NOT A PASS.');
  process.exit(2);
}
console.log('  GENERIC : ' + GENERIC.base + ' @ ' + GENERIC.item + ' -> ' + GENERIC.mega
  + '   base ability ' + GENERIC.baseAb + ' (tags ' + JSON.stringify(abilTags(GENERIC.baseAb))
  + ')   mega ability tags ' + JSON.stringify(GENERIC.megaTags) + '   idle ' + GENERIC.idle);
console.log('  EDGE    : ' + EDGE.base + ' @ ' + EDGE.item + ' -> ' + EDGE.mega
  + '   base ability ' + EDGE.baseAb + ' (tags ' + JSON.stringify(abilTags(EDGE.baseAb))
  + ')   mega ability tags ' + JSON.stringify(EDGE.megaTags) + '   idle ' + EDGE.idle);

/* ---- THE REST OF THE CAST ---------------------------------------------------------------------- */
/* THE ATTACKER'S TURN-1 CLICK IS A SELF-ONLY MOVE THAT BOOSTS NOTHING, AND THAT IS MEASURED.
 * It was a Swords Dance, and at the honest (un-inflated) HP the +2 made the turn-2 Knock Off a KO:
 * the control arm's target FAINTED, a replacement came in, and every read after it was of a
 * DIFFERENT BODY while every clause stayed green. A fixture whose subject dies is green and empty. */
const ATTACKER = 'Weavile', ATT_ABIL = 'Pressure', KNOCK = 'Knock Off', ATT_IDLE = 'Protect';
const FILLER = 'Clefable', FILLER_ABIL = 'Magic Guard', FILLER_IDLE = 'Amnesia';
const ALLY = 'Alakazam', ALLY_ABIL = 'Synchronize', ALLY_IDLE = 'Calm Mind';
/* An ordinary item for the control arm. A BERRY, so the ONE thing that differs from the stone arm is
 * which item sits in the slot. Knock Off's `onAfterHit` strips before any update could eat it, and the
 * control arm's `-enditem ... [from] move: Knock Off` is what proves which of the two happened; every
 * arm also asserts the holder is ALIVE at the last boundary, because a fixture whose subject faints
 * reads a REPLACEMENT from then on and stays green. */
const PLAIN_ITEM = 'sitrusberry';
const BENCH_P1 = [['Toxapex', 'Iron Defense'], ['Milotic', 'Recover']];
const BENCH_P2 = [['Corviknight', 'Iron Defense'], ['Pinsir', 'Swords Dance']];

{
  let bad = 0;
  const claims = [[ATTACKER, KNOCK], [ATTACKER, ATT_IDLE], [FILLER, FILLER_IDLE], [ALLY, ALLY_IDLE],
                  [GENERIC.base, GENERIC.idle], [EDGE.base, EDGE.idle], ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset: ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  for (const sp of [ATTACKER, FILLER, ALLY, ...BENCH_P1.map(x => x[0]), ...BENCH_P2.map(x => x[0])]) {
    if (!mcKey(sp, { mayMiss: 'a probe cast must resolve; a miss is a FAILED fixture, never a substitution' })) {
      console.log('  NO ENGINE ROW for ' + sp); bad++;
    }
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

/* ---- THE PROTOCOL REDUCER, the same equivalences game_differential.js applies ------------------- */
const norm = l => String(l)
  .replace(/(p[12][ab]?): ?[^|]*/g, '$1')
  .replace(/\|\d+\/\d+(\/\d+)?( [a-z]+)?/g, '|H/H')
  .toLowerCase()
  .split('|').map((f, i) => {
    let x = f.trim();
    if (i >= 2) x = x.replace(/^(\[from\]\s*)?(move|ability|item):\s*/, '$1');
    return x.replace(/[^a-z0-9\[\]/-]/g, '');
  })
  .slice(0, (String(l).split('|')[1] === 'move') ? 4 : undefined).join('|');
/* `-ability` GOES WITH THE THREE SHAPES THIS ENGINE NEVER EMITS, AND IT IS NOT THIS FILE'S RULING.
 *
 * `engine/game_differential.js`'s EQUIV list carries `ability-announcement` verbatim: Showdown's
 * `|-ability|` is a COSMETIC announcement that an ability activated, every consequence of it is a
 * separate line, and those lines are kept and compared. It ships with a RED DEMONSTRATION either way
 * (`equal` collapses, `distinct` must not), so it is a normaliser rather than a silencer.
 *
 * IT MATTERS HERE BECAUSE A MEGA CHANGES THE ABILITY. One of the two arms evolves into an ability
 * that announces itself on start, so the authority writes an `-ability` line at the mega that this
 * engine does not — measured, one line, on one arm, with the boards identical at every boundary.
 * A PROBE STRICTER THAN THE INSTRUMENT IT FEEDS WOULD REPORT A DEFECT NOTHING ELSE IN THE REPOSITORY
 * AGREES IS ONE. The count it drops is printed per arm instead of being silently swallowed. */
const DROPPED_ABILITY = new Map();
const SKIP_EVENT = new Set(['', 'split', 't:', '-ability']);
const turnSlice = (lines, n) => {
  const s = (lines || []).map(String);
  const i = s.findIndex(l => l === '|turn|' + n);
  if (i < 0) return [];
  let j = s.findIndex((l, k) => k > i && l.startsWith('|turn|'));
  if (j < 0) j = s.length;
  return s.slice(i + 1, j).filter(l => !SKIP_EVENT.has(l.split('|')[1] || ''));
};
const stream = (lines, n, tag) => {
  const out = [], seen = new Set();
  for (const l of turnSlice(lines, n)) { const k = norm(l); if (seen.has(k)) continue; seen.add(k); out.push(k); }
  return out;
};
/* Counted BEFORE the filter drops them, so the drop is visible rather than assumed. */
const countAbilityLines = (lines, n) => (lines || []).map(String)
  .filter(l => l.startsWith('|-ability|')).length;

const sdT = b => (b && b.p2 && b.p2.active && b.p2.active[0]) || null;
const meT = S => (S && S.actB && S.actB[0]) || null;
const readSd = p => p ? { item: id(p.item || ''), hp: p.hp, name: id(p.species && p.species.name) } : null;
const readMe = m => m ? { item: id(m.item || ''), hp: m.curHP, name: id(m.name) } : null;

function run(cfg) {
  const p1 = [mon(FILLER, FILLER_ABIL, [FILLER_IDLE]),
              mon(ATTACKER, ATT_ABIL, [KNOCK, ATT_IDLE]),
              ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
  const p2 = [mon(cfg.base, cfg.ability, [cfg.idle], cfg.item),
              mon(ALLY, ALLY_ABIL, [ALLY_IDLE]),
              ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];
  const a = G.buildPair(p1, { hpBoost: HP_BOOST }), b = G.buildPair(p2, { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const script = [
    { p1: [{ m: FILLER_IDLE }, { m: ATT_IDLE }],
      p2: [cfg.mega ? { m: cfg.idle, mega: true } : { m: cfg.idle }, { m: ALLY_IDLE }] },
    { p1: [{ m: FILLER_IDLE }, { m: KNOCK, t: 0 }],
      p2: [{ m: cfg.idle }, { m: ALLY_IDLE }] },
  ];
  const seen = [];
  const r = G.playGame(a, b, 'knockoff-megastone', cfg.tag, {
    script, arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sd: readSd(sdT(battle)), me: readMe(meT(S)),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sc: G.scriptCounters ? G.scriptCounters() : null,
           sdMega: (sd || []).filter(l => /^\|(-mega|detailschange)\|/.test(String(l))).length,
           meMega: (me || []).filter(l => /^\|(-mega|detailschange)\|/.test(String(l))).length,
           sdAbilityLines: countAbilityLines(sd), meAbilityLines: countAbilityLines(me),
           sdS: [1, 2].map(t => stream(sd, t)), meS: [1, 2].map(t => stream(me, t)) };
}

console.log('\nKNOCK OFF INTO A MEGA STONE — no boost, no removal, and the guard reads a BASE SPECIES\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = [
  { key: 'plain',      label: 'PLAIN — an ordinary item on the generic body  (CONTROL: removal + x1.5)',
    base: GENERIC.base, ability: GENERIC.baseAb, idle: GENERIC.idle, item: PLAIN_ITEM, mega: false },
  { key: 'stone',      label: 'STONE — its own stone, UN-EVOLVED',
    base: GENERIC.base, ability: GENERIC.baseAb, idle: GENERIC.idle, item: GENERIC.item, mega: false },
  { key: 'stone-mega', label: 'STONE-MEGA — its own stone, AFTER it mega evolved',
    base: GENERIC.base, ability: GENERIC.baseAb, idle: GENERIC.idle, item: GENERIC.item, mega: true },
  { key: 'edge-plain', label: 'EDGE-PLAIN — the exception\'s stone, UN-EVOLVED  (CONTROL)',
    base: EDGE.base, ability: EDGE.baseAb, idle: EDGE.idle, item: EDGE.item, mega: false },
  { key: 'edge-mega',  label: 'EDGE-MEGA — the exception\'s stone, AFTER it mega evolved  (THE ARM)',
    base: EDGE.base, ability: EDGE.baseAb, idle: EDGE.idle, item: EDGE.item, mega: true },
  /* THE REFUSAL IS NOT "MEGA STONES ARE IMMUNE", AND THIS IS THE ARM THAT SAYS SO. A stone on a body
   * it does not belong to fails the guard's own key and comes off exactly like any other item — same
   * species and same forme as `plain`, so its damage must MATCH `plain` and not `stone`. Without this
   * arm an engine that simply refused every stone would pass every other clause in the file. */
  { key: 'foreign', label: 'FOREIGN — a stone that is NOT this body\'s, un-evolved  (CONTROL: the guard keys on the PAIRING)',
    base: GENERIC.base, ability: GENERIC.baseAb, idle: GENERIC.idle, item: EDGE.item, mega: false },
];
const R = {};
for (const a of ARMS) R[a.key] = run(Object.assign({ tag: a.key }, a));

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const a of ARMS) {
  const x = R[a.key];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + a.label);
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  for (let i = 0; i < 2; i++) {
    console.log('  turn ' + (i + 1) + ' sd ' + (x.sdS[i].join('  ') || '(none)'));
    console.log('  turn ' + (i + 1) + ' me ' + (x.meS[i].join('  ') || '(none)'));
  }
  console.log('  target sd ' + JSON.stringify(x.seen.map(y => y.sd)));
  console.log('  target me ' + JSON.stringify(x.seen.map(y => y.me)));
  console.log('  boards ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('  '));
  console.log('  `-ability` lines DROPPED by the `ability-announcement` equivalence: authority '
    + x.sdAbilityLines + ', ours ' + x.meAbilityLines
    + (x.sdAbilityLines !== x.meAbilityLines ? '   <- the two engines disagree, and the differential '
       + 'declares this cosmetic. It is reported, never asserted.' : ''));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const at = (k, t) => (R[k].seen || []).find(y => y.turn === t) || {};
/* THE HIT, isolated: HP at the boundary that closes turn 1 minus HP at the boundary that closes
 * turn 2. Turn 1 is idle on both sides, so the whole of this gap is the Knock Off. */
const hit = k => { const a = at(k, 1), b = at(k, 2);
                   return (a.sd && b.sd) ? a.sd.hp - b.sd.hp : null; };

/* -- 1. THE FIXTURE ----------------------------------------------------------------------------- */
for (const a of ARMS) {
  const x = R[a.key];
  ok(x.verdict === 'RAN' && x.turns >= 2, 'both scripted turns were played — ' + a.key, 'turns ' + x.turns);
  ok(x.sc && x.sc.moveNotOnRequest === 0 && x.sc.megaRefused === 0,
     'every scripted click reached the AUTHORITY\'s request, and no mega ask was refused — ' + a.key
     + ' (a refused ask is green and empty)', x.sc ? JSON.stringify(x.sc) : 'none');
  ok((x.sdS[1] || []).some(l => /^\|move\|/.test(l) && /knockoff/.test(l)),
     'the strip reached the AUTHORITY as ' + KNOCK + ' on turn 2 — ' + a.key);
  const wantMega = !!a.mega;
  ok((x.sdMega > 0) === wantMega,
     'the AUTHORITY ' + (wantMega ? 'DID' : 'did NOT') + ' mega evolve — ' + a.key,
     'sd mega lines ' + x.sdMega + '  ours ' + x.meMega);
  ok((x.meMega > 0) === wantMega, 'and so did WE — ' + a.key, 'ours ' + x.meMega);
  ok(at(a.key, 0).sd && at(a.key, 0).sd.item === id(a.item),
     'the ITEM knob reached the AUTHORITY\'s own body — ' + a.key,
     JSON.stringify(at(a.key, 0).sd));
}

/* THE BOOST KNOB, on ONE species and ONE forme, differing only in the item. */
ok(hit('plain') != null && hit('stone') != null && hit('plain') > hit('stone'),
   'the AUTHORITY\'s x1.5 is REAL: an ordinary item takes strictly more than the stone on the same '
   + 'body. IDENTICAL DAMAGE ACROSS THIS KNOB WOULD MEAN THE REFUSAL IS UNWIRED IN THE AUTHORITY '
   + 'AND THE FIXTURE PROVES NOTHING',
   'plain ' + hit('plain') + '  stone ' + hit('stone'));
ok(at('plain', 2).sd && at('plain', 2).sd.item === '',
   'and the ordinary item really came OFF — the control removal happened',
   JSON.stringify(at('plain', 2).sd));

/* NOBODY DIED AND NOTHING ELSE LEFT THE SLOT. A fainted subject is replaced and every read after it
 * is of a different body, which is green and empty; a berry that ate itself would put an `[eat]`
 * inside a fixture about a strip. Both are asserted rather than assumed. */
for (const a of ARMS) {
  const last = at(a.key, 2);
  ok(last.sd && last.sd.hp > 0 && last.me && last.me.hp > 0,
     'the subject was still standing at the last boundary — ' + a.key, JSON.stringify([last.sd, last.me]));
  ok(last.sd && last.sd.name === id(a.mega ? R[a.key].seen[1].sd.name : a.base),
     'and it is still the SAME body the arm staged — ' + a.key,
     'last ' + JSON.stringify(last.sd && last.sd.name));
}

/* THE FOUR STONE ARMS: the item NEVER leaves, in EITHER engine, evolved or not. This is the clause
 * Will's brief asks for, and it is asserted on the ITEM rather than on the absence of a line. */
for (const k of ['stone', 'stone-mega', 'edge-plain', 'edge-mega']) {
  const arm = ARMS.find(a => a.key === k), last = at(k, 2);
  ok(last.sd && last.sd.item === id(arm.item),
     'THE STONE IS STILL THERE in the AUTHORITY — ' + k, JSON.stringify(last.sd));
  ok(last.me && last.me.item === id(arm.item),
     'and in OURS — ' + k, JSON.stringify(last.me));
  ok(!(R[k].sdS[1] || []).some(l => /^\|-enditem\|/.test(l)) && !(R[k].meS[1] || []).some(l => /^\|-enditem\|/.test(l)),
     'and neither engine wrote an `-enditem` on the strip turn — ' + k);
}

/* THE PAIRING, NOT THE CLASS. Same body, same forme, a stone that is not its own. */
ok(hit('foreign') != null && hit('foreign') === hit('plain'),
   'a FOREIGN stone takes the SAME damage as an ordinary item on the same body — the refusal is keyed '
   + 'on (item, holder) and not on "this is a mega stone"',
   'foreign ' + hit('foreign') + '  plain ' + hit('plain') + '  own-stone ' + hit('stone'));
ok(at('foreign', 2).sd && at('foreign', 2).sd.item === '' && at('foreign', 2).me && at('foreign', 2).me.item === '',
   'and a FOREIGN stone really comes OFF, in both engines',
   JSON.stringify([at('foreign', 2).sd, at('foreign', 2).me]));

/* THE MEGA ARMS HAVE NO SAME-FORME BOOST CONTROL, AND THAT IS DECLARED RATHER THAN FAKED.
 * The `plain` / `stone` pair isolates the x1.5 on the UN-EVOLVED body because both are the same
 * species and the same forme. There is no equivalent for the evolved body: mega evolution REQUIRES
 * holding the matching stone, so "this mega forme holding an ordinary item" is a board the game
 * cannot produce. What the mega arms therefore assert is the removal and the two engines' damage
 * agreeing — not an isolated boost — and this file says so instead of comparing across formes,
 * which was the first draft and would have read a stat change as a base-power change. */
console.log('  note  the mega arms carry NO isolated boost control — see the block above. Their claim '
  + 'is the STRIP and engine agreement, nothing more.');

/* -- 2. THE BOARD — Will's bar. ----------------------------------------------------------------- */
for (const a of ARMS) {
  const bad = (R[a.key].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a.key,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
  const hp = (R[a.key].seen || []).filter(y => y.sd && y.me && y.sd.hp !== y.me.hp);
  ok(hp.length === 0, 'the two engines agree about the damage — ' + a.key,
     hp.map(y => 't' + y.turn + ' sd=' + y.sd.hp + ' me=' + y.me.hp).join(' ; '));
  const it = (R[a.key].seen || []).filter(y => y.sd && y.me && y.sd.item !== y.me.item);
  ok(it.length === 0, 'the two engines agree about the ITEM — ' + a.key,
     it.map(y => 't' + y.turn + ' sd=' + JSON.stringify(y.sd.item) + ' me=' + JSON.stringify(y.me.item)).join(' ; '));
}

/* -- 3. THE NARRATION, as a SEQUENCE, nothing typed about what it should say. -------------------- */
for (const a of ARMS) {
  for (let i = 0; i < 2; i++) {
    const p = R[a.key].sdS[i].join('  '), q = R[a.key].meS[i].join('  ');
    ok(p === q, 'NARRATION identical, turn ' + (i + 1) + ' — ' + a.key,
       p === q ? '' : 'authority [' + p + ']\n          ours      [' + q + ']');
  }
}

/* ================================================================================================
 * --red — THE KNOWN-BAD ENGINE, SO THE GREEN ABOVE MEANS SOMETHING.
 *
 * The known-bad input is the real engine with `removesItem` STRIPPED from the strip move in the
 * IN-MEMORY artifact, through the tags module THE DRIVER IS USING — `REL.require`, not a plain
 * `require`, because `game_differential.js` loads out of the frozen tree and a live-tree strip
 * reaches a different module instance and changes nothing while reporting that it did.
 *
 * WHAT IT DOES AND DOES NOT DEMONSTRATE, stated rather than implied. It proves this file WATCHES THE
 * STRIP: the two arms where an item is supposed to leave must part from the authority. It does NOT
 * prove the file watches the REFUSAL — no artifact knob turns that off, because `holdsMegaStone`
 * falls back on the item id's own suffix when the tag is gone. The refusal is instead held down by
 * the FOREIGN arm above, which is a board the game can really produce and which moves the damage
 * from 72 to 106 on the same body.
 * ============================================================================================== */
if (process.argv.includes('--red')) {
  const TAGSMOD = G.REL.require('engine/tags.js', { need: ['__setDB'] });
  const db = JSON.parse(G.REL.read('data/tags.json'));
  const rec = db.moves && db.moves[id(KNOCK)];
  if (!rec || !(rec.tags || []).includes('removesItem')) {
    console.log('\n--red COULD NOT STAGE — the artifact no longer carries the tag to strip.');
    process.exit(2);
  }
  rec.tags = rec.tags.filter(t => t !== 'removesItem');
  if (rec.params) delete rec.params.removesItem;
  TAGSMOD.__setDB(db);
  console.log('\n' + '='.repeat(98));
  console.log('  --red — `removesItem` STRIPPED from ' + KNOCK + ' in the in-memory artifact.');
  console.log('='.repeat(98));
  const RED = {};
  for (const a of ARMS) RED[a.key] = run(Object.assign({ tag: 'RED-' + a.key }, a));
  TAGSMOD.__setDB(null);
  let redSeen = 0;
  const red = (want, cond, label, detail) => {
    const good = (cond === want);
    console.log(`  ${good ? (want ? 'went RED' : 'held    ') : 'WRONG   '}  ${label}`
      + (detail ? '\n          ' + detail : ''));
    if (good) redSeen++; else fails++;
  };
  for (const k of ['plain', 'foreign']) {
    red(true, (RED[k].seen || []).some(y => !y.identical),
        k + ': the board parts from the authority once the strip is dead — this arm REMOVES an item',
        JSON.stringify((RED[k].seen || []).map(y => y.identical)) + '  item now '
        + JSON.stringify((RED[k].seen[2] || {}).me));
  }
  for (const k of ['stone', 'stone-mega', 'edge-plain', 'edge-mega']) {
    red(false, (RED[k].seen || []).some(y => !y.identical),
        k + ': and the stone arms are UNCHANGED by it — they were never removing anything, so a '
        + 'strip knob must not move them. A red here would mean the knob is hitting the wrong thing',
        JSON.stringify((RED[k].seen || []).map(y => y.identical)));
  }
  console.log('  ' + redSeen + ' of 6 --red clauses behaved as they must.');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
