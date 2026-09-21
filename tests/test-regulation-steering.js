/* test-regulation-steering.js — A REG M-C RUN IS STEERED BY REG M-C HUMANS, AND AN ABSENT STORE REFUSES.
 *
 * 2026-09-21 (MEASURE, abra/regmc 0.19.0). The empirical driver and the gate's coverage clause read four
 * tables that are facts about human play — click counts, sheet usage, the behaviour table (move priors) and
 * the voluntary-switch census. Every builder named Reg M-B's stores by literal, so under Reg M-C the
 * artifact seam wrote Reg M-B's behaviour into a `-regmc` file and exited 0. engine/regulation_stores.js now
 * answers "which games" per regulation: Reg M-B keeps its stores; any other regulation reads its frozen
 * pool, verified against the pool's receipt.
 *
 * FIVE PARTS.
 *   1. REG M-B IS UNMOVED. Under the default regulation the pool is null, every builder selects the literal
 *      Reg M-B store list it always had, the behaviour table is data/move-priors.json and a release cut
 *      freezes no extra file.
 *   2. REG M-C SELECTS ITS OWN. The behaviour table maps to its sibling and a release cut freezes it; the
 *      switch and joint censuses are declared per-regulation.
 *   3. IN A SANDBOX, THE BUILDERS COUNT THE POOL. A throwaway root holds a copy of the builders and a
 *      synthetic pool whose receipt carries the real sha256; under Reg M-C the click counts and the sheet
 *      usage are counted from it, land on their `-regmc` siblings, and Reg M-B's files (sentinels) are
 *      byte-for-byte untouched.
 *   4. AN ABSENT OR ALTERED POOL REFUSES, and writes nothing. A byte changed at the same size, and a file
 *      removed: each builder exits non-zero, names the file, and no `-regmc` artifact appears.
 *   5. THE JOINT CENSUS, NOT YET PER-REGULATION, REFUSES UNDER REG M-C rather than writing Reg M-B's clicks.
 *
 * No real store is read and no real artifact is written. Every entity in the synthetic pool is a
 * placeholder string, not a Pokemon, a move, an ability or an item. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
/* NAMES ARE ASSEMBLED, NOT SPELLED -- engine/provenance.js credits a source with writing an artifact whose
 * name sits near a write verb rooted in data/, and part 3 writes Reg M-B's names into a sandbox. */
const J = (stem) => stem + '.json';
const DATA = (f) => 'data/' + f;
let ran = 0, bad = 0;
const ok = (name, cond, detail) => {
  ran++;
  if (cond) console.log('  ok   ' + name);
  else { bad++; console.log('  FAIL ' + name + (detail ? '\n       ' + String(detail).split('\n').join('\n       ') : '')); }
};
const env0 = (extra) => { const e = Object.assign({}, process.env); delete e.ABRA_REGULATION; return Object.assign(e, extra || {}); };
const child = (code, extra, cwd) => {
  const r = spawnSync(process.execPath, ['-e', code], { cwd: cwd || ROOT, env: env0(extra), encoding: 'utf8', maxBuffer: 1 << 26 });
  let j = null, parseErr = '';
  try { j = JSON.parse(String(r.stdout).trim().split('\n').pop()); }
  catch (e) { parseErr = 'the child printed no JSON: ' + e.message + '\n'; }
  return { j, status: r.status, out: String(r.stdout || ''), err: parseErr + String(r.stderr || '') };
};
const run = (script, args, extra, cwd) => {
  const r = spawnSync(process.execPath, [script].concat(args || []), { cwd, env: env0(extra), encoding: 'utf8', maxBuffer: 1 << 26 });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
};

console.log('\ntests/test-regulation-steering.js — the steering inputs follow the regulation\n');

/* ---- 1. Reg M-B unmoved ---------------------------------------------------------------------- */
console.log('1. REG M-B IS UNMOVED');
{
  const lit = ['games.ladder.jsonl', 'games.bo3.jsonl'].map(DATA);
  const c = child(`
    const RS = require('./engine/regulation_stores.js');
    const REG = require('./engine/regulation.js');
    const ER = require('./engine/engine_release.js');
    console.log(JSON.stringify({ id: REG.ID, pool: RS.pool(), mp: REG.MOVE_PRIORS_FILE,
      cc: require('./engine/click_counts.js').storesSelected(), su: require('./engine/sheet_usage.js').storesSelected(),
      regSources: ER.REGULATION_SOURCES, sw: REG.artifactFor(${JSON.stringify(DATA(J('rollout-switch-census')))}),
      jc: REG.artifactFor(${JSON.stringify(DATA(J('joint-click-census')))}) }));`);
  if (!c.j) ok('the Reg M-B probe ran', false, c.err.slice(-800));
  else {
    const want = lit.filter(f => fs.existsSync(path.join(ROOT, f)));
    ok('Reg M-B: the pool is null (callers keep their own stores)', c.j.id === 'regmb' && c.j.pool === null, JSON.stringify(c.j.pool));
    ok('Reg M-B: click counts select exactly the literal Reg M-B stores', JSON.stringify(c.j.cc) === JSON.stringify(want), JSON.stringify(c.j.cc));
    ok('Reg M-B: sheet usage selects exactly the literal Reg M-B stores', JSON.stringify(c.j.su) === JSON.stringify(want), JSON.stringify(c.j.su));
    ok('Reg M-B: the behaviour table is ' + DATA(J('move-priors')), c.j.mp === DATA(J('move-priors')), c.j.mp);
    ok('Reg M-B: a release cut freezes no regulation file', Array.isArray(c.j.regSources) && !c.j.regSources.length, JSON.stringify(c.j.regSources));
    ok('Reg M-B: the switch and joint censuses keep their names', c.j.sw === DATA(J('rollout-switch-census')) && c.j.jc === DATA(J('joint-click-census')),
      c.j.sw + ' ' + c.j.jc);
  }
}

/* ---- 2. Reg M-C selects its own -------------------------------------------------------------- */
console.log('2. REG M-C SELECTS ITS OWN BEHAVIOUR TABLE AND CENSUSES');
{
  const c = child(`
    const REG = require('./engine/regulation.js');
    const ER = require('./engine/engine_release.js');
    console.log(JSON.stringify({ id: REG.ID, mp: REG.MOVE_PRIORS_FILE, regSources: ER.REGULATION_SOURCES,
      sw: REG.artifactFor(${JSON.stringify(DATA(J('rollout-switch-census')))}),
      jc: REG.artifactFor(${JSON.stringify(DATA(J('joint-click-census')))}),
      obs: REG.artifactFor(${JSON.stringify(DATA(J('move-priors.observed')))}) }));`, { ABRA_REGULATION: 'regmc' });
  if (!c.j) ok('the Reg M-C probe ran', false, c.err.slice(-800));
  else {
    ok('Reg M-C: the behaviour table is its own sibling', c.j.mp === DATA(J('move-priors-regmc')), c.j.mp);
    ok('Reg M-C: a release cut freezes that table', (c.j.regSources || []).includes(DATA(J('move-priors-regmc'))), JSON.stringify(c.j.regSources));
    ok('Reg M-C: the switch census, the joint census and the observed table are -regmc',
      c.j.sw === DATA(J('rollout-switch-census-regmc')) && c.j.jc === DATA(J('joint-click-census-regmc'))
        && c.j.obs === DATA(J('move-priors.observed-regmc')), JSON.stringify(c.j));
  }
}

/* ---- 3/4. the builders in a sandbox ------------------------------------------------------------ */
console.log('3. IN A SANDBOX THE BUILDERS COUNT THE REG M-C POOL, AND REG M-B\'S FILES ARE UNTOUCHED');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-regsteer-'));
try {
  for (const d of ['engine', 'data', path.join('data', 'team-pool-frozen-regmc')]) fs.mkdirSync(path.join(T, d), { recursive: true });
  for (const f of ['regulation.js', 'regulation_stores.js', 'click_counts.js', 'sheet_usage.js', 'policy.js', 'moves-meta.js',
                   'rollout_switch_census.js', 'quality_bots.js', 'quality.js']) {
    fs.copyFileSync(path.join(ROOT, 'engine', f), path.join(T, 'engine', f));
  }
  fs.copyFileSync(path.join(ROOT, 'data', J('regulations')), path.join(T, 'data', J('regulations')));
  /* Reg M-B's two artifacts, as sentinels. A Reg M-C run must not change a byte of either. */
  const SENT = 'SENTINEL -- Reg M-B\'s file; a Reg M-C run must never touch it\n';
  for (const f of [J('click-counts'), J('sheet-usage'), J('move-priors'), J('move-priors.observed'), J('rollout-switch-census')]) {
    fs.writeFileSync(path.join(T, 'data', f), SENT);
  }
  /* the synthetic pool: placeholder strings only */
  const game = (id, mvs, side) => JSON.stringify({ id, turns: [{ n: 1, ev: mvs.map(mv => ({ t: 'm', mon: 'bodyA', mv })) }],
    sheets: { p1: side, p2: side } });
  const sideA = [{ species: 'bodyA', ability: 'abilityA', item: 'itemA', moves: ['moveA'] }];
  const sideB = [{ species: 'bodyB', ability: 'abilityB', item: 'itemB', moves: ['moveB'] }];
  const POOL = path.join(T, 'data', 'team-pool-frozen-regmc');
  const files = {
    /* g1 clicks moveA sixteen times: the behaviour clone keeps a species only past 15 acts */
    'games.bo3.jsonl': [game('g1', Array(16).fill('moveA'), sideA), game('g2', ['moveB'], sideB)].join('\n') + '\n',
    'games.ots.jsonl': game('g3', ['moveA'], sideA) + '\n',
  };
  const receipt = { format: null, files: {}, pool_digest: null };
  const REGF = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', J('regulations')), 'utf8'));
  receipt.format = (REGF.runtime && REGF.runtime.regmc && REGF.runtime.regmc.showdownFormat) || null;
  for (const [f, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(POOL, f), body);
    receipt.files[f] = { bytes: Buffer.byteLength(body), sha256: crypto.createHash('sha256').update(body).digest('hex'), lines: body.trim().split('\n').length };
  }
  receipt.pool_digest = crypto.createHash('sha256').update(receipt.files['games.bo3.jsonl'].sha256 + '\n'
    + receipt.files['games.ots.jsonl'].sha256 + '\n').digest('hex');
  fs.writeFileSync(path.join(POOL, 'pool-receipt.json'), JSON.stringify(receipt, null, 2));
  const MC = { ABRA_REGULATION: 'regmc' };
  const sentOK = () => [J('click-counts'), J('sheet-usage'), J('move-priors'), J('move-priors.observed'), J('rollout-switch-census')]
    .every(f => fs.readFileSync(path.join(T, 'data', f), 'utf8') === SENT);
  /* the raw logs the switch census joins to the pool: one tracked-style shard per format, plus one game
   * the pool did NOT keep, which the join must leave out */
  const log = '|tier|[Gen 9 Champions] placeholder\n|teamsize|p1|4\n|teamsize|p2|4\n|turn|1\n|switch|p1a: bodyA|bodyA\n'
            + '|move|p2a: bodyB|moveB|p1a: bodyA\n|upkeep\n|win|p1\n';
  for (const [fmt, ids] of [[REGF.runtime.regmc.bo3Format, ['g1', 'g2', 'gX']], [REGF.runtime.regmc.showdownFormat, ['g3']]]) {
    const dir = path.join(T, 'data', 'raw', 'games.' + fmt);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '20260921T0000-00.jsonl.gz'),
      require('zlib').gzipSync(ids.map(id => JSON.stringify({ id, log })).join('\n') + '\n'));
  }
  /* An artifact the builder did not write reads null, and WHY is kept for the failing check to print. */
  const artErr = {};
  const art = f => {
    try { return JSON.parse(fs.readFileSync(path.join(T, 'data', f), 'utf8')); }
    catch (e) { artErr[f] = e.message; return null; }
  };

  const cc = run(path.join(T, 'engine', 'click_counts.js'), [], MC, T);
  const ccA = art(J('click-counts-regmc'));
  ok('click counts under Reg M-C exit 0', cc.status === 0, cc.out.slice(-600) + ' ' + JSON.stringify(artErr));
  ok('click counts under Reg M-C are counted from the pool (3 games, moveA 17, moveB 1)',
    ccA && ccA.store_games === 3 && ccA.moves && ccA.moves.movea === 17 && ccA.moves.moveb === 1
      && ccA.pool && ccA.pool.pool_digest === receipt.pool_digest, JSON.stringify(ccA && { g: ccA.store_games, m: ccA.moves, p: ccA.pool }));
  const su = run(path.join(T, 'engine', 'sheet_usage.js'), [], MC, T);
  const suA = art(J('sheet-usage-regmc'));
  ok('sheet usage under Reg M-C exits 0', su.status === 0, su.out.slice(-600));
  ok('sheet usage under Reg M-C is counted from the pool (6 teams, abilityA on 4)',
    suA && suA.teams === 6 && suA.abilities && suA.abilities.abilitya && suA.abilities.abilitya.teams === 4
      && suA.pool && suA.pool.pool_digest === receipt.pool_digest, JSON.stringify(suA && { t: suA.teams, a: suA.abilities }));
  const po = run(path.join(T, 'engine', 'policy.js'), [], MC, T);
  const poA = art(J('move-priors.observed-regmc'));
  ok('the behaviour clone under Reg M-C is derived from the pool (bodyA, 18 acts, pool stamped)',
    po.status === 0 && poA && poA.species && poA.species.bodyA && poA.species.bodyA.acts === 18
      && poA.source && poA.source.pool_digest === receipt.pool_digest, po.status + ' ' + JSON.stringify(poA && poA.species) + ' ' + po.out.slice(-300));
  const pr = run(path.join(T, 'engine', 'policy.js'), ['--promote'], MC, T);
  const prA = art(J('move-priors-regmc'));
  ok('its promotion lands on the regulation\'s own table, not on ' + DATA(J('move-priors')),
    pr.status === 0 && prA && prA.species && prA.species.bodyA, pr.status + ' ' + pr.out.slice(-400));
  const sw = run(path.join(T, 'engine', 'rollout_switch_census.js'), [], MC, T);
  const swA = art(J('rollout-switch-census-regmc'));
  ok('the switch census under Reg M-C reads the raw logs of exactly the games the pool kept (3 of 4, 3 voluntary)',
    sw.status === 0 && swA && swA.pooled && swA.pooled.games === 3 && swA.pooled.voluntary === 3
      && swA.pool && swA.pool.pool_digest === receipt.pool_digest
      && swA.stores.find(s => s.key === 'bo3').excluded.unjudged === 1, sw.status + ' ' + JSON.stringify(swA && swA.pooled) + ' ' + sw.out.slice(-400));
  ok('Reg M-B\'s click counts, sheet usage, behaviour tables and switch census are byte-for-byte untouched', sentOK());

  console.log('4. AN ABSENT OR ALTERED POOL REFUSES AND WRITES NOTHING');
  const OUTS = [J('click-counts-regmc'), J('sheet-usage-regmc'), J('move-priors.observed-regmc'), J('rollout-switch-census-regmc')];
  const clear = () => {
    for (const f of OUTS) {
      try { fs.unlinkSync(path.join(T, 'data', f)); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }   /* absent is the state being set up; anything else is a fault */
    }
  };
  const BUILDERS = [['click counts', 'click_counts.js', J('click-counts-regmc')], ['sheet usage', 'sheet_usage.js', J('sheet-usage-regmc')],
    ['the behaviour clone', 'policy.js', J('move-priors.observed-regmc')], ['the switch census', 'rollout_switch_census.js', J('rollout-switch-census-regmc')]];
  /* a byte changed at the same size: only the digest can see it */
  clear();
  const ots = path.join(POOL, 'games.ots.jsonl');
  const body = fs.readFileSync(ots, 'utf8');
  fs.writeFileSync(ots, body.replace('moveA', 'moveC'));
  for (const [name, script, out] of BUILDERS) {
    const r = run(path.join(T, 'engine', script), [], MC, T);
    ok(name + ': an altered pool file refuses by name (same size, different sha256)',
      r.status !== 0 && /REFUSING/.test(r.out) && /games\.ots\.jsonl/.test(r.out) && !fs.existsSync(path.join(T, 'data', out)), r.status + ' ' + r.out.slice(-400));
  }
  fs.writeFileSync(ots, body);
  /* a file removed */
  clear();
  const bo3 = path.join(POOL, 'games.bo3.jsonl');
  fs.renameSync(bo3, bo3 + '.away');
  for (const [name, script, out] of BUILDERS) {
    const r = run(path.join(T, 'engine', script), [], MC, T);
    ok(name + ': an absent pool file refuses by name and writes no zero-usage artifact',
      r.status !== 0 && /REFUSING/.test(r.out) && /games\.bo3\.jsonl/.test(r.out) && !fs.existsSync(path.join(T, 'data', out)), r.status + ' ' + r.out.slice(-400));
  }
  fs.renameSync(bo3 + '.away', bo3);
  ok('Reg M-B\'s sentinels are still untouched after the refusals', sentOK());

  /* THE CONTROL ARM. The same sandbox under Reg M-B, with Reg M-B's two stores present (placeholder games
   * that click `moveZ`): the builder must read THOSE, overwrite its own unsuffixed artifact exactly as it
   * always did, and neither read the pool nor write a `-regmc` file. Without this arm, part 1's "the
   * literal stores" could pass in a checkout that has no stores at all. */
  clear();
  for (const f of ['games.ladder.jsonl', 'games.bo3.jsonl']) fs.writeFileSync(path.join(T, 'data', f), game('mb-' + f, ['moveZ'], sideB) + '\n');
  const sel = child(`console.log(JSON.stringify(require('./engine/click_counts.js').storesSelected()))`, {}, T);
  ok('control, Reg M-B: the builder selects the two literal Reg M-B stores', JSON.stringify(sel.j) === JSON.stringify(['games.ladder.jsonl', 'games.bo3.jsonl'].map(DATA)),
    JSON.stringify(sel.j) + ' ' + sel.err.slice(-300));
  const mb = run(path.join(T, 'engine', 'click_counts.js'), [], {}, T);
  const mbA = art(J('click-counts'));
  ok('control, Reg M-B: counted from Reg M-B\'s stores (2 games, moveZ 2, no pool stamp) and no -regmc file',
    mb.status === 0 && mbA && mbA.store_games === 2 && mbA.moves.movez === 2 && !mbA.moves.movea && !mbA.pool
      && !fs.existsSync(path.join(T, 'data', J('click-counts-regmc'))), mb.status + ' ' + JSON.stringify(mbA && mbA.moves) + ' ' + mb.out.slice(-300));
} finally {
  fs.rmSync(T, { recursive: true, force: true });
}

/* ---- 5. the joint census --------------------------------------------------------------------- */
console.log('5. THE JOINT CENSUS REFUSES UNDER REG M-C');
{
  const r = run(path.join(ROOT, 'engine', 'joint_click_census.js'), [], { ABRA_REGULATION: 'regmc' }, ROOT);
  ok('joint_click_census.js under Reg M-C exits 2 and says why', r.status === 2 && /REFUSING/.test(r.out), r.status + ' ' + r.out.slice(-400));
}

console.log('\nREGULATION STEERING: ' + (ran - bad) + ' passed, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
