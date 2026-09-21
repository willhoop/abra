/* tests/regmc_probe_kit.js — the shared scaffolding of the Reg M-C item probes (abra/regmc 0.18.0).
 *
 * Every Reg M-C staged probe does the same five things before it asks its own question: select the regulation,
 * open the NEWEST Reg M-C release and refuse (exit 2) when it does not hold the live engine bytes, derive a cast
 * from the M-C dex, play scripted turns through BOTH engines (`tests/staged_board.js` -> `playGame`), and assert
 * that every staged set is legal under the Reg M-C `TeamValidator` (buildPair's own fixture check). This file is
 * that scaffolding once, so each probe is its arms and its assertions and nothing else. It asserts NOTHING about
 * any mechanic itself.
 *
 *   const K = require('./regmc_probe_kit.js').open('probe_regmc_air_balloon', ['MEDI_AIR_BALLOON_SILENT', ...]);
 *
 * `--medi <path>` compiles THOSE engine bytes under the release (the pre-fix engine, for the RED proof).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

/* THE CENSUS A SCRIPTED PROBE DOES NOT READ, AND WHY IT STILL HAS TO NAME ONE -- 2026-09-21 (abra/regmc 0.18.0).
 *
 * `engine/game_differential.js` resolves its steering at LOAD (`STEERING.resolve`, engine/steering.js), and the
 * steering REFUSES without a census. Since abra/regmc 0.17.0 (MEASURE, engine/regulation.js `artifactFor`) a Reg M-C
 * run reads `data/mechanics-census-regmc.json` in place of Reg M-B's, and no Reg M-C census exists yet -- so every
 * staged Reg M-C probe died at `require`, the 0.16.0 seeds probe included. A staged probe's games are SCRIPTED
 * (`playGame(..., 'directed', ..., { script })`): the census selects nothing and credits nothing that is asserted.
 * So the probe pins a one-row STUB outside `data/`, says so on stdout, and never pretends it is a census. A caller
 * that passes its own `--census` is left alone. */
function scriptedCensusPin(name) {
  if (process.argv.includes('--census')) return null;
  const os = require('os');
  const p = path.join(os.tmpdir(), 'abra-scripted-probe-census-' + process.pid + '.json');
  fs.writeFileSync(p, JSON.stringify({ generated: 'STUB -- ' + name + ' is scripted; no row of this file is read for a verdict',
    by: 'tests/regmc_probe_kit.js scriptedCensusPin', results: [{ kind: 'item', tag: 'flingable', label: 'stub row' }] }));
  process.on('exit', () => { try { fs.unlinkSync(p); } catch (e) { console.error('  census stub: could not remove ' + p + ' (' + e.message + ')'); } });
  process.argv.push('--census', p);
  console.log('  census: a ONE-ROW STUB at ' + p + ' -- the steering module will not load without one, and this'
    + ' probe games are scripted, so it selects nothing (no Reg M-C census exists yet)');
  return p;
}

function open(name, knobNames) {
  if (!process.argv.includes('--regulation')) process.argv.push('--regulation', 'regmc');
  scriptedCensusPin(name);
  require(path.join(ROOT, 'engine', 'showdown_path.js'));
  const REGN = require(path.join(ROOT, 'engine', 'regulation.js'));
  const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
  const MEDI_SRC_PATH = argOf('--medi', null);
  const KNOBS = (knobNames || []).filter(k => process.env[k] === '1');
  let bad = 0;
  const ok = (cond, what, detail) => {
    console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
    if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
    if (!cond) bad++;
  };
  console.log('\ntests/' + name + '.js — regulation ' + REGN.ID);
  console.log('  knobs armed: ' + (KNOBS.length ? KNOBS.join(', ') + '   (the defect is RESTORED; this must exit 1)' : 'none'));
  if (REGN.ID !== 'regmc') { console.log('  NOT RUN — this probe is a Reg M-C probe and ' + REGN.ID + ' is selected.'); process.exit(2); }

  const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
  const G = SB.harness(MEDI_SRC_PATH ? fs.readFileSync(MEDI_SRC_PATH, 'utf8') : undefined);
  {
    const strip = s => String(s).replace(/\r/g, '');
    const relBytes = strip(G.REL.read('engine/medicham2-browser.js'));
    const live = strip(fs.readFileSync(path.join(ROOT, 'engine', 'medicham2-browser.js'), 'utf8'));
    console.log('  release ' + G.REL.id + (MEDI_SRC_PATH ? '   engine bytes: ' + MEDI_SRC_PATH : ''));
    if (!MEDI_SRC_PATH && relBytes !== live) {
      console.log('  NOT RUN — the newest Reg M-C release does not hold the live engine. Cut one:\n'
        + '    node engine/engine_release.js cut "<why>" --regulation regmc');
      process.exit(2);
    }
  }
  const ARM = G.ARM_BY_ID.get('bottom-tie-first');
  if (!ARM) { console.log('  NOT STAGED — the bottom arm is not in ARM_BY_ID.'); process.exit(1); }
  const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });

  const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
  const D = CS.sim().Dex.forFormat(CS.FORMAT);
  const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const SPEC = D.species.all().filter(s => legal(s) && !s.isMega && !s.battleOnly && !/['’]/.test(s.name));
  const learnset = s => ((D.species.getLearnsetData(s.id) || {}).learnset) || {};
  const learns = (s, mv) => !!learnset(s)[mv];
  const abil = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a).id);
  /* abilities that react to being hit, touch HP, items, stats, switching or the field -- a staged body carries none of
   * them unless the arm asks for it, so the only thing that can write a line is the mechanic under test */
  const LOUD = new Set(['intimidate', 'pressure', 'unnerve', 'frisk', 'moldbreaker', 'teravolt', 'turboblaze', 'klutz',
    'pickpocket', 'magician', 'stickyhold', 'unburden', 'symbiosis', 'harvest', 'cudchew', 'ripen', 'gluttony',
    'contrary', 'simple', 'defiant', 'competitive', 'justified', 'stamina', 'weakarmor', 'berserk', 'angerpoint',
    'rattled', 'steadfast', 'mummy', 'lingeringaroma', 'wanderingspirit', 'cursedbody', 'illusion', 'disguise',
    'trace', 'imposter', 'grassysurge', 'psychicsurge', 'electricsurge', 'mistysurge', 'seedsower', 'drought',
    'drizzle', 'sandstream', 'snowwarning', 'mimicry', 'protean', 'libero', 'roughskin', 'ironbarbs', 'flamebody',
    'static', 'poisonpoint', 'effectspore', 'cutecharm', 'gooey', 'tanglinghair', 'aftermath', 'innardsout',
    'perishbody', 'wonderguard', 'sturdy', 'multiscale', 'regenerator', 'emergencyexit', 'wimpout', 'moxie',
    'beastboost', 'soulheart', 'airlock', 'cloudnine', 'neutralizinggas', 'download', 'intrepidsword',
    'dauntlessshield', 'anticipation', 'forewarn', 'costar', 'commander', 'zerotohero', 'hospitality',
    'supersweetsyrup', 'toxicdebris', 'sandspit', 'windpower', 'windrider', 'electromorphosis', 'dancer',
    'flowerveil', 'sweetveil', 'pastelveil', 'healer', 'friendguard', 'telepathy', 'goodasgold', 'magicbounce',
    'prankster', 'galewings', 'triage', 'quickdraw', 'stall', 'mycelium', 'myceliummight', 'naturalcure',
    'shedskin', 'hydration', 'poisonheal', 'guts', 'marvelscale', 'quickfeet', 'grasspelt', 'surgesurfer',
    'levitate', 'sapsipper', 'lightningrod', 'stormdrain', 'voltabsorb', 'waterabsorb', 'flashfire', 'motordrive',
    'dryskin', 'wellbakedbody', 'eartheater', 'purifyingsalt', 'thermalexchange', 'longreach', 'noguard',
    'superluck', 'sniper', 'serenegrace', 'sheerforce', 'shielddust', 'infiltrator', 'screencleaner', 'owntempo',
    'oblivious', 'synchronize', 'innerfocus', 'insomnia', 'vitalspirit', 'comatose', 'leafguard', 'chlorophyll',
    'solarpower', 'swiftswim', 'sandrush', 'slushrush', 'speedboost', 'moody', 'slowstart', 'truant', 'zenmode',
    'stancechange', 'schooling', 'powerconstruct', 'battlebond', 'gulpmissile', 'iceface', 'hungerswitch',
    'protosynthesis', 'quarkdrive', 'orichalcumpulse', 'hadronengine', 'magicguard', 'overcoat', 'bulletproof',
    'soundproof', 'damp', 'liquidooze', 'colorchange', 'receiver', 'powerofalchemy', 'opportunist', 'terashell',
    'terashift', 'teraformzero', 'sharpness', 'toughclaws', 'ironfist', 'reckless', 'rockhead', 'technician',
    'parentalbond', 'skilllink', 'hustle', 'compoundeyes', 'fluffy', 'furcoat', 'thickfat', 'heatproof',
    'filter', 'solidrock', 'prismarmor', 'shadowshield', 'icescales', 'punkrock', 'waterbubble', 'suctioncups',
    'guarddog', 'shieldsdown', 'eelevate']);
  const quiet = s => abil(s).find(a => !LOUD.has(a)) || null;
  const sure = m => m.accuracy === true || m.accuracy === 100;
  /* a plain single-target damaging move: no secondary, no self effect, no priority, no charge, no custom power */
  const plain = m => legal(m) && m.category !== 'Status' && m.target === 'normal' && !m.secondary && !m.secondaries
    && !m.self && !m.recoil && !m.drain && !m.flags.charge && !m.flags.recharge && !m.priority && !m.selfSwitch
    && !m.basePowerCallback && !m.damageCallback && !m.ohko && !m.selfdestruct && !m.volatileStatus && !m.onHit
    && !m.onAfterHit && !m.onAfterMove && !m.onAfterMoveSecondary && !m.onAfterMoveSecondarySelf && !m.onTry && !m.onTryHit && !m.onBasePower && !m.onModifyMove && !m.onModifyType
    && !m.onModifyPriority && !m.onEffectiveness && !m.overrideOffensivePokemon && !m.overrideOffensiveStat
    && !m.overrideDefensiveStat && m.basePower >= 20 && !m.flags.futuremove;
  /* the weakest plain single-arrival 100%-accurate move `att` learns that `tgt` takes neutrally or resisted; `pred` narrows the pool */
  const hitFor = (att, tgt, pred) => D.moves.all().filter(m => plain(m) && !m.multihit && sure(m) && learns(att, m.id) && (!pred || pred(m))
    && D.getImmunity(m.type, tgt) && D.getEffectiveness(m.type, tgt) <= 0)
    .sort((a, b) => a.basePower - b.basePower)[0] || null;
  /* a click that neither protects nor touches HP and can be repeated turn after turn (Focus Energy last: a second use fails) */
  const idle = s => ['splash', 'celebrate', 'growl', 'tailwhip', 'leer', 'harden', 'defensecurl', 'withdraw', 'focusenergy']
    .map(x => D.moves.get(x)).find(m => legal(m) && learns(s, m.id) && m.target !== 'normal') || null;
  const bulk = s => s.baseStats.hp + s.baseStats.def + s.baseStats.spd;
  const mon = (s, item, mv, ab) => ({ species: s.id, item: item || '', ability: ab || quiet(s), moves: mv });
  const pickDistinct = (pool, used, n) => { const out = []; for (const s of pool) { if (used.has(s.baseSpecies) || used.has(s.id)) continue; out.push(s); used.add(s.baseSpecies); used.add(s.id); if (out.length === n) break; } return out; };
  const show = xs => xs.slice(0, 6).map(s => s.id).join(', ') + (xs.length > 6 ? ', …' : '');
  const canon = l => String(l).toLowerCase().replace(/[\s']/g, '');

  /* play one arm. `keep` selects the lines kept for display and comparison; `counters()` is read around the game. */
  function play(tag, A, B, script, keep, counters) {
    const a = G.buildPair(A), b = G.buildPair(B);
    if (!a || !b || a.length !== A.length || b.length !== B.length) return { staged: false, why: 'buildPair dropped a body' };
    if (G.resetScriptCounters) G.resetScriptCounters();
    const c0 = counters ? counters() : {};
    const boards = [];
    const r = G.playGame(a, b, 'directed', name + ' :: ' + tag, { script, arm: ARM,
      onBoundary: (snap, ti) => {
        boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
        snap.identical = true; snap.diffs = [];
      } });
    if (r.err) return { staged: false, why: 'THREW: ' + r.err };
    const SC = G.scriptCounters();
    if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
    if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
    const c1 = counters ? counters() : {};
    const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
    const d = {}; for (const k in c1) d[k] = c1[k] - (c0[k] || 0);
    return { staged: true, tag, turns: r.turns, sd, me, sdK: sd.filter(l => keep.test(l)).map(canon), meK: me.filter(l => keep.test(l)).map(canon),
      boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
      boardDetail: boards.filter(x => x.diffs.length).map(x => 't' + x.turn + ': ' + x.diffs.slice(0, 6).join(', ')).join(' | '),
      div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, counters: d };
  }
  function printArms(RUNS) {
    console.log('\n2. THE ARMS');
    for (const [tag, R] of RUNS) {
      if (!R || !R.staged) { console.log('  NOT STAGED (' + tag + ') — ' + (R ? R.why : 'no legal cast found')); process.exit(1); }
      console.log('  === ' + tag + ' ===' + (R.cast ? '   ' + R.cast : ''));
      console.log('    showdown : ' + R.sdK.join('  '));
      console.log('    medicham2: ' + R.meK.join('  '));
      console.log('    boards: ' + R.boardDiffs + ' diff(s)' + (R.boardDetail ? '   ' + R.boardDetail : ''));
      console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none'));
      console.log('    counters: ' + JSON.stringify(R.counters));
    }
    const ill = G.fixtureIllegal ? G.fixtureIllegal() : null;
    ok(Array.isArray(ill) && ill.length === 0, 'every staged set is legal under the ' + CS.FORMAT + ' TeamValidator (buildPair\'s fixture check)',
      Array.isArray(ill) ? (ill.length ? JSON.stringify(ill.slice(0, 3)) : null) : 'the fixture check is not exported');
  }
  /* each arm: the driver's first protocol divergence is NONE, the lines matching `own` agree in order, and the boards agree */
  function compareArms(RUNS, own, what) {
    console.log('\n4. MEDICHAM AGAINST THE AUTHORITY');
    for (const [tag, R] of RUNS) {
      /* a `[from]` names the same effect by its display name on the authority (`U-turn`) and by its id here (`uturn`);
       * the driver already declares that spelling, so the comparison folds it and nothing else */
      const fold = l => l.replace(/(\[from\])([^|]*)/g, (x, a, b) => a + b.replace(/-/g, ''));
      const sdO = R.sdK.filter(l => own.test(l)).map(fold), meO = R.meK.filter(l => own.test(l)).map(fold);
      const same = sdO.length === meO.length && sdO.every((l, i) => l === meO[i]);
      ok(!R.div && same, tag + ' — no protocol divergence, and every ' + what + ' line agrees in order',
        R.div ? JSON.stringify(R.div) : (same ? null : 'showdown  ' + sdO.join(' ') + '\nmedicham2 ' + meO.join(' ')));
      ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary', R.boardDiffs ? R.boardDetail : null);
    }
  }
  function finish() {
    console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
    process.exit(bad ? 1 : 0);
  }
  return { REGN, G, ARM, M, CS, D, KNOBS, MEDI_SRC_PATH, ok, legal, SPEC, learns, abil, LOUD, quiet, sure, plain, hitFor,
    idle, bulk, mon, pickDistinct, show, canon, play, printArms, compareArms, finish, P: { protect: { m: 'protect' } } };
}
module.exports = { open, scriptedCensusPin };
