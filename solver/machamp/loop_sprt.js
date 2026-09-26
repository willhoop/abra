/* solver/machamp/loop_sprt.js — MACHAMP, unattended: generation after generation under the round-3 recipe and the
 * pre-registered SPRT (solver/machamp/preregistration-loop.json), publishing each result to main.
 *
 *   cmd.exe /c tools\lownode.cmd solver\machamp\loop_sprt.js --release eaa5becc54eb [--start 6] [--workers 3]
 *        [--publish] [--state solver/out/machamp/<release>/loop-sprt-state.json]
 *
 * ONE GENERATION n, champion C (starts at gen5), previous P:
 *   1. MEW: C plays 1,000 games in the league { current C, previous P, clone } on TRAIN pairs of the frozen team store
 *      (seed 200 + n)                                     -> solver/out/selfplay/<release>/loop-sp<n>/
 *   2. deep values for that new directory (deep_value.js, 4 rollouts x 3 turns, seed n)
 *   3. pooled build over EVERY self-play directory on this release (DODUO targets; PORYGON2 positions with deep values)
 *   4. train from the same starting points as gen5 (MAG v1 + DODUO v1, beta 0.7, human weight 3.0; PORYGON2 v0,
 *      0.5 z + 0.5 v_deep)                                -> solver/machamp/models/gen<n>/ (small, tracked)
 *   5. gates, read once each: PORYGON2 human log-loss; the SPRT vs C (elo0 0, elo1 +20, alpha = beta = 0.05, <= 2,000
 *      games, battle seed 9001 + 10 (n - 5)); the human clone, 200 games (seed 9002 + 10 (n - 5))
 *   6. ACCEPT iff all three pass: gen<n> becomes C, the old C becomes P.
 *   7. --publish: fetch, merge origin/main (append-only conflicts in the three logs resolved ours-then-theirs; any
 *      other conflict aborts the merge and skips the push), write the rows, commit, push HEAD:main. Never force.
 *      Accepted: models + spec + CHANGELOG-REGMC + RUNNING-NOTES + one solver/LOG.md line + the report section, as a
 *      MINOR above main's top. Rejected: the one solver/LOG.md line and the report section only.
 * STOP when two generations in a row fail the SPRT, when solver/out/machamp/STOP exists, or on an error. Resumable.
 *
 * --recipe warm (solver/machamp/preregistration-warm.json, from generation 8). gen6 and gen7 failed because every
 * generation restarted training from MAG v1 + DODUO v1 and PORYGON2 v0. Under `warm`:
 *   - MAG/DODUO and PORYGON2 are WARM-STARTED from the CURRENT CHAMPION's files, at a smaller learning rate
 *     (DODUO 1e-4, was 3e-4; PORYGON2 1.5e-4, was 5e-4);
 *   - the champion's OWN self-play (a directory whose manifest's league.current digests equal the champion's files)
 *     carries sample weight 3; every other directory 1 (build_doduo.js / build_pory2.js --weights);
 *   - the DODUO pull toward the human clone is unchanged (beta 0.7, human weight 3.0, anchor DODUO v1), and the
 *     epoch-selection tolerance is measured from the CLONE's human val NLL, not the warm init's, so drift cannot
 *     compound generation over generation (train_doduo.py --tol-ref anchor);
 *   - the PORYGON2 target is unchanged: 0.5 z + 0.5 v_deep (3-turn rollouts);
 *   - the search's FALLBACK decisions (solver/mew/play.js `fallbacks`, recorded from this recipe on) are DODUO targets;
 *   - accepted: test-machamp and tests/test-docs-current.js must be GREEN before the push, else the loop stops unpushed;
 *   - a generation whose two nets both select epoch -1 (the champion unchanged) stops the loop: it cannot be tested.
 * Every child runs at the parent's priority (BELOWNORMAL under lownode); at most 3 workers at a time.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const REL = flag('--release', 'eaa5becc54eb');
const RECIPE = flag('--recipe', 'r3');
if (!['r3', 'warm'].includes(RECIPE)) throw new Error('unknown --recipe ' + RECIPE);
const WARM = RECIPE === 'warm';
const PREREG = WARM ? 'solver/machamp/preregistration-warm.json' : 'solver/machamp/preregistration-loop.json';
const CHAMP_W = 3;   // warm: the sample weight of the champion's own self-play (pre-registered)
const W = Math.min(3, +flag('--workers', 3));
const PUBLISH = argv.includes('--publish');
const OUTR = path.join(ROOT, 'solver', 'out', 'machamp', REL);
const SPROOT = path.join(ROOT, 'solver', 'out', 'selfplay', REL);
const STATE = path.resolve(ROOT, flag('--state', path.join('solver', 'out', 'machamp', REL, WARM ? 'loop-warm-state.json' : 'loop-sprt-state.json')));
const STOPF = path.join(ROOT, 'solver', 'out', 'machamp', 'STOP');
const STORE = 'C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc';
const REPORT = path.join(ROOT, 'docs', '_reports', WARM ? '2026-09-25-machamp-warm-loop.md' : '2026-09-25-machamp-loop.md');
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const today = () => new Date().toISOString().slice(0, 10);
const J = f => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));

const load = () => { try { return J(STATE); } catch (e) { return null; } };
const save = S => { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(S, null, 1)); };
function log(...a) { console.log(`[${new Date().toISOString()}]`, ...a); }
function run(cmd, args, name, opts) {
  const lf = path.join(OUTR, 'logs', name + '.log');
  fs.mkdirSync(path.dirname(lf), { recursive: true });
  log(cmd, args.join(' ').slice(0, 300), '->', rel(lf));
  const fd = fs.openSync(lf, 'a');
  const r = cp.spawnSync(cmd, args, Object.assign({ cwd: ROOT, stdio: ['ignore', fd, fd], env: process.env }, opts || {}));
  fs.closeSync(fd);
  if (r.status !== 0) throw new Error(`${name} failed (exit ${r.status}); see ${rel(lf)}`);
}
const node = (script, args, name, heap) => run(process.execPath, [...(heap ? ['--max-old-space-size=' + heap] : []), script, ...args], name);
const py = (script, args, name) => run('python', [script, ...args], name);
const git = (args, allowFail) => {
  const r = cp.spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0 && !allowFail) throw new Error('git ' + args.join(' ') + ' failed: ' + (r.stderr || r.stdout).slice(0, 800));
  return r;
};

/* every self-play directory on this release that holds shards, in a fixed order */
function poolDirs() {
  const order = d => (d === 'gen0' ? 0 : d === 'gen1' ? 1 : d.startsWith('r2-') ? 2 : d.startsWith('r3-') ? 3 : 4);
  return fs.readdirSync(SPROOT).filter(d => /^(gen[01]|r2-sp\d+|r3-sp\d+|loop-sp\d+)$/.test(d) && fs.existsSync(path.join(SPROOT, d, 'manifest.json')))
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b, 'en', { numeric: true })).map(d => path.join(SPROOT, d));
}
/* the deep-value directory for a self-play directory (round 3 computed the first four in one run) */
function deepDirFor(spDir) {
  const b = path.basename(spDir);
  if (['gen0', 'gen1', 'r2-sp0', 'r2-sp1'].includes(b)) return path.join(OUTR, 'r3-deep');
  return path.join(OUTR, 'deep-' + b);
}

/* ------------------------------------------------------------------ publishing */
function resolveAppendOnly(p) {
  const f = path.join(ROOT, p);
  let s = fs.readFileSync(f, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/<<<<<<< [^\n]*\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [^\n]*\n/g, (m, a, b) => (a.endsWith(nl + nl) ? a : a.replace(/[\r\n]+$/, '') + nl + nl) + b);
  if (/^(<<<<<<<|>>>>>>>)/m.test(s)) throw new Error('unresolved markers in ' + p);
  fs.writeFileSync(f, s);
}
function mergeMain() {
  git(['fetch', 'origin']);
  const r = git(['merge', '--no-ff', '--no-commit', 'origin/main'], true);
  const un = git(['diff', '--name-only', '--diff-filter=U']).stdout.split('\n').filter(Boolean);
  if (r.status !== 0 && !un.length && !/Already up to date/.test(r.stdout)) { git(['merge', '--abort'], true); throw new Error('merge failed: ' + r.stdout.slice(0, 400)); }
  const ok = ['CHANGELOG-REGMC.md', 'docs/RUNNING-NOTES.md', 'solver/LOG.md'];
  if (un.some(f => !ok.includes(f))) { git(['merge', '--abort'], true); throw new Error('merge conflict outside the append-only logs: ' + un.join(', ')); }
  for (const f of un) { resolveAppendOnly(f); git(['add', f]); }
  const mh = git(['rev-parse', '-q', '--verify', 'MERGE_HEAD'], true);
  if (mh.status === 0) git(['commit', '-q', '-m', 'Merge origin/main into the MACHAMP loop branch\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>']);
}
function topVersion() {
  const s = fs.readFileSync(path.join(ROOT, 'CHANGELOG-REGMC.md'), 'utf8');
  const m = s.match(/^## \[(\d+)\.(\d+)\.(\d+)\]/m);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function insertBefore(p, re, text) {
  const f = path.join(ROOT, p);
  const s = fs.readFileSync(f, 'utf8');
  const i = s.search(re);
  if (i < 0) throw new Error('anchor not found in ' + p);
  fs.writeFileSync(f, s.slice(0, i) + text + s.slice(i));
}
function logLine(line) {
  const f = path.join(ROOT, 'solver', 'LOG.md');
  let s = fs.readFileSync(f, 'utf8');
  const head = '## ' + today();
  const hdr = '### MACHAMP loop — one line per generation (solver/machamp/loop_sprt.js)';
  if (!s.includes(head + '\n') && !s.includes(head + '\r\n')) s = s.replace(/^---\r?\n/m, m => m + '\n' + head + '\n\n');
  const hi = s.indexOf(head);
  const after = s.indexOf('\n', hi) + 1;
  const hj = s.indexOf(hdr, hi);
  const nextDay = s.indexOf('\n## ', after);
  if (hj < 0 || (nextDay >= 0 && hj > nextDay)) s = s.slice(0, after) + '\n' + hdr + '\n' + s.slice(after);
  const k = s.indexOf(hdr, hi);
  const e = s.indexOf('\n', k) + 1;
  s = s.slice(0, e) + '- ' + line + '\n' + s.slice(e);
  fs.writeFileSync(f, s);
}
const DRY = argv.includes('--dry-publish');   // write the rows and the log line, commit nothing (a test of the text)
function publish(v, S) {
  if (!PUBLISH && !DRY) { log('publish skipped (no --publish)'); return; }
  if (!DRY) {
    const st = git(['status', '--porcelain', '--untracked-files=no']).stdout.trim();
    if (st) throw new Error('refusing to publish over uncommitted tracked changes:\n' + st);
    mergeMain();
  }
  const files = ['solver/LOG.md', rel(REPORT)];
  const n = v.gen, g = v.G_beats_previous_SPRT, c = v.G_not_lose_clone, p = v.G_pory2_human;
  const ci = x => '[' + x.map(z => z.toFixed(3)).join(', ') + ']';
  const line = `${WARM ? '(warm) ' : ''}gen${n}: ${v.accepted ? '**ACCEPTED**' : 'rejected'} — SPRT ${g.verdict.split(' ')[0]} after ${g.games_used} games, ` +
    `${g.result.score_x.toFixed(3)} ${ci(g.result.ci95_x)} vs ${path.basename(v.champion_before, '.json')}; clone ${c.score.toFixed(3)}; ` +
    `PORYGON2 human Δ ${p.diff.toFixed(4)} ${p.pass ? 'PASS' : 'FAIL'}. \`solver/machamp/models/gen${n}/gates.json\``;
  logLine(line);
  const sec = `\n## gen${n} — ${v.accepted ? 'ACCEPTED' : 'rejected'} (${new Date().toISOString()})\n\n` +
    `- Self-play: \`${v.selfplay.dir}\`, ${v.selfplay.games} games, ${v.selfplay.games_per_hour} games/hour, ${(100 * v.selfplay.unfilled).toFixed(2)}% cells empty.\n` +
    `- Pool: ${v.pool.dirs} self-play directories, ${v.pool.doduo_decisions} DODUO decisions, ${v.pool.pory2_positions} PORYGON2 positions (all with a deep value: ${v.pool.pory2_with_deep}).\n` +
    `- **SPRT vs ${path.basename(v.champion_before, '.json')}** (elo0 0, elo1 +20, α = β = 0.05): **${g.verdict}**, LLR ${g.llr_at_stop == null ? 'n/a' : g.llr_at_stop.toFixed(2)}, ` +
    `${g.pairs_used} pairs = ${g.games_used} games; ${g.result.W}–${g.result.L} = ${g.result.score_x.toFixed(3)} ${ci(g.result.ci95_x)} (Wilson at the stop, slightly optimistic).\n` +
    `- Human clone: ${c.score.toFixed(3)} ${ci(c.ci95)} (${c.pass ? 'PASS' : 'FAIL'}). PORYGON2 human log-loss vs v0: ${p.diff.toFixed(4)} ${ci(p.ci95)} (${p.pass ? 'PASS' : 'FAIL'}).\n` +
    `- DODUO drift from the human clone: ${v.doduo_drift.toFixed(4)} nats.\n- Champion after: \`${v.champion_after}\`.\n` +
    (v.recipe && v.recipe.name === 'warm' ? `- Recipe: warm start from \`${v.recipe.init}\`; lr DODUO ${v.recipe.lr_doduo}, PORYGON2 ${v.recipe.lr_pory2}; champion self-play weight ${v.recipe.champion_weight} on ${v.recipe.champion_dirs.join(', ') || 'none'}; ` +
      `fallback decisions in the DODUO targets: ${v.pool.fallbacks_kept}; selected epochs DODUO ${v.recipe.selected_epoch.doduo}, PORYGON2 ${v.recipe.selected_epoch.pory2}.\n` : '');
  if (!fs.existsSync(REPORT)) fs.writeFileSync(REPORT, `# MACHAMP unattended loop${WARM ? ' — warm-start recipe' : ''} — one section per generation\n\nWritten by \`solver/machamp/loop_sprt.js${WARM ? ' --recipe warm' : ''}\` under \`${PREREG}\`. Historical by construction.\n`);
  fs.appendFileSync(REPORT, sec);
  let msg = `MACHAMP gen${n} ${v.accepted ? 'accepted' : 'rejected'}: SPRT ${g.verdict.split(' ')[0]} after ${g.games_used} games`;
  if (v.accepted) {
    const t = topVersion(); const ver = `${t[0]}.${t[1] + 1}.0`;
    insertBefore('CHANGELOG-REGMC.md', /^## \[/m, `## [${ver}] — ${today()}\n\n### Added\n- **MACHAMP gen${n} accepted** (\`solver/machamp/models/gen${n}/\`, \`league/gen${n}.json\`), the unattended loop under \`${PREREG}\`${WARM ? ' (warm start from the champion, smaller learning rate, champion self-play weighted 3, fallback decisions in the DODUO targets)' : ''}.\n\n### Notes\n` +
      `- SPRT vs ${path.basename(v.champion_before, '.json')} (elo0 0, elo1 +20, α = β = 0.05): H1 after ${g.games_used} games; ${g.result.score_x.toFixed(3)} ${ci(g.result.ci95_x)}. Human clone ${c.score.toFixed(3)} ${ci(c.ci95)}; PORYGON2 human Δ ${p.diff.toFixed(4)} ${ci(p.ci95)}.\n` +
      `- Source: \`solver/machamp/models/gen${n}/gates.json\`. Account: \`${rel(REPORT)}\`.\n- **Basis.** unchanged.\n\n`);
    insertBefore('docs/RUNNING-NOTES.md', /^## \[abra\/regmc /m, `## [abra/regmc ${ver}] — ${today()} — **MACHAMP gen${n} accepted by SPRT (H1 after ${g.games_used} games, ${g.result.score_x.toFixed(3)} ${ci(g.result.ci95_x)})**\n` +
      `- **What changed.** \`solver/machamp/models/gen${n}/\`, \`solver/machamp/league/gen${n}.json\`; the champion is now gen${n}.\n` +
      `- **Measured.** SPRT vs ${path.basename(v.champion_before, '.json')} H1, ${g.games_used} games, ${g.result.score_x.toFixed(3)} ${ci(g.result.ci95_x)}; clone ${c.score.toFixed(3)}; PORYGON2 human Δ ${p.diff.toFixed(4)} — \`solver/machamp/models/gen${n}/gates.json\`.\n` +
      `- **Basis.** unchanged.\n- **Supersedes.** Nothing.\n- **Owed to the next major.** MEW and MACHAMP in \`docs/MODELS.md\`.\n\n`);
    files.push('CHANGELOG-REGMC.md', 'docs/RUNNING-NOTES.md', `solver/machamp/models/gen${n}`, `solver/machamp/league/gen${n}.json`);
    msg += ` (abra/regmc ${ver})`;
  }
  if (DRY) { log('dry publish: would commit', files.join(' '), '|', msg); return; }
  git(['add', ...files]);
  git(['commit', '-q', '-m', msg + '\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>']);
  if (WARM && v.accepted) {
    /* the tests must be GREEN before an accepted generation reaches main; a red one stops the loop, unpushed */
    for (const t of ['solver/tests/test-machamp.js', 'tests/test-docs-current.js']) {
      const lf = path.join(OUTR, 'logs', `loop-gen${n}-${path.basename(t, '.js')}.log`);
      const r = cp.spawnSync(process.execPath, [path.join(ROOT, t)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 27, env: Object.assign({}, process.env, { ARENA_TEST_RELEASE: REL }) });
      fs.writeFileSync(lf, (r.stdout || '') + (r.stderr || ''));
      log(t, 'exit', r.status, '->', rel(lf));
      S.tests = (S.tests || []).concat([{ gen: n, test: t, exit: r.status }]);
      if (r.status !== 0) throw new Error(`${t} is not GREEN (exit ${r.status}) for accepted gen${n}: committed locally, NOT pushed; see ${rel(lf)}`);
    }
  }
  for (let tries = 0; tries < 2; tries++) {
    const r = git(['push', 'origin', 'HEAD:main'], true);
    if (r.status === 0) { log('pushed', git(['rev-parse', '--short', 'HEAD']).stdout.trim()); S.pushes = (S.pushes || []).concat([{ gen: n, head: git(['rev-parse', 'HEAD']).stdout.trim() }]); return; }
    log('push rejected, re-merging:', (r.stderr || '').slice(0, 300));
    mergeMain();
  }
  throw new Error('push failed twice');
}

/* ------------------------------------------------------------------ one generation */
function generation(S) {
  const n = S.next, K = k => `gen${n}:${k}`, done = k => (S.stages[K(k)] || {}).done;
  const stamp = (k, extra) => { S.stages[K(k)] = Object.assign({ done: true, at: new Date().toISOString() }, extra || {}); save(S); };
  const champ = J(S.champion);
  const spDir = path.join(SPROOT, `loop-sp${n}`);
  const cand = path.join(OUTR, `cand${n}`);
  const modelDir = path.join(ROOT, 'solver', 'machamp', 'models', `gen${n}`);
  fs.mkdirSync(cand, { recursive: true }); fs.mkdirSync(modelDir, { recursive: true });
  const off = n - 5;
  if (!done('selfplay')) {
    const league = { current: champ, previous: S.previous ? J(S.previous) : null, clone: J(S.clone), weights: { current: 0.6, previous: 0.2, clone: 0.2 } };
    const lf = path.join(cand, 'league.json'); fs.writeFileSync(lf, JSON.stringify(league, null, 1));
    node(path.join(ROOT, 'solver', 'mew', 'run.js'), ['--release', REL, '--league', rel(lf), '--games', '1000', '--seed', String(200 + n), '--workers', String(W), '--team-store', STORE, '--out', rel(spDir)], `loop-gen${n}-selfplay`);
    const m = J(path.join(spDir, 'manifest.json'));
    stamp('selfplay', { dir: rel(spDir), games: m.counts.games, games_per_hour: m.games_per_hour, unfilled: m.search.unfilled_share, warnings: m.warnings });
  }
  const dirs = poolDirs();
  /* warm: the champion's own self-play carries weight CHAMP_W, every other directory 1 */
  const ASHA = require('../mew/agent.js').sha;
  const champDg = { mag: ASHA(champ.mag), doduo: ASHA(champ.doduo), pory2: ASHA(champ.pory2) };
  const isChampDir = d => { const m = J(path.join(d, 'manifest.json')); const c = m.league && m.league.current; return !!(c && c.digests && c.digests.mag === champDg.mag && c.digests.doduo === champDg.doduo && c.digests.pory2 === champDg.pory2); };
  const weights = dirs.map(d => (WARM && isChampDir(d) ? CHAMP_W : 1));
  const wArgs = WARM ? ['--weights', weights.join(',')] : [];
  for (const d of dirs) {
    const dd = deepDirFor(d);
    if (fs.existsSync(path.join(dd, 'deep.summary.json'))) continue;
    node(path.join(__dirname, 'deep_value.js'), ['--release', REL, '--selfplay', rel(d), '--out', rel(dd), '--workers', String(W), '--rollouts', '4', '--depth', '3', '--seed', String(n)], `loop-gen${n}-deep-${path.basename(d)}`);
    const ds = J(path.join(dd, 'deep.summary.json'));
    if (ds.counts.replay_mismatch || ds.counts.no_joint || ds.counts.errors) throw new Error('deep values: replay did not reproduce ' + rel(d) + ' ' + JSON.stringify(ds.counts));
  }
  if (!done('build')) {
    node(path.join(__dirname, 'build_doduo.js'), ['--selfplay', dirs.map(rel).join(','), ...wArgs, '--out', rel(path.join(cand, 'doduo'))], `loop-gen${n}-build-doduo`, 3072);
    node(path.join(__dirname, 'build_pory2.js'), ['--release', REL, '--selfplay', dirs.map(rel).join(','), ...wArgs, '--deep', [...new Set(dirs.map(deepDirFor))].map(rel).join(','), '--out', rel(path.join(cand, 'pory2'))], `loop-gen${n}-build-pory2`, 3072);
    const dm = J(path.join(cand, 'doduo', 'meta.json')), pm = J(path.join(cand, 'pory2', 'meta.json'));
    stamp('build', { dirs: dirs.map(rel), weights, doduo_decisions: dm.counts.kept, doduo_fallbacks_seen: dm.counts.fallbacks_seen || 0, doduo_fallbacks_kept: dm.counts.fallbacks_kept || 0,
      pory2_positions: pm.counts.positions, pory2_with_deep: pm.counts.with_deep });
  }
  const poryOut = path.join(modelDir, `porygon2-gen${n}.json`), poryMet = path.join(modelDir, `porygon2-gen${n}.metrics.json`);
  if (!done('train-pory2')) {
    py(path.join('solver', 'machamp', 'train_pory2.py'), ['--init', WARM ? champ.pory2 : 'solver/porygon2/model/porygon2-v0.json', ...(WARM ? ['--lr', '1.5e-4'] : []), '--human', 'solver/out/porygon2/human-' + REL, '--selfplay', rel(path.join(cand, 'pory2')),
      '--out', rel(poryOut), '--metrics', rel(poryMet), '--name', `PORYGON2 gen${n}`, '--threads', '4', '--seed', String(n), '--fixture', rel(path.join(modelDir, `porygon2-gen${n}.fixture.json`))], `loop-gen${n}-train-pory2`);
    stamp('train-pory2');
  }
  if (!done('train-doduo')) {
    py(path.join('solver', 'machamp', 'train_doduo.py'), ['--init-mag', WARM ? champ.mag : 'solver/mag/model/mag-v1.json', '--init-doduo', WARM ? champ.doduo : 'solver/mag/model/doduo-v1.json',
      ...(WARM ? ['--lr', '1e-4', '--tol-ref', 'anchor'] : []), '--human', 'solver/out/mag',
      '--selfplay', rel(path.join(cand, 'doduo')), '--out-dir', rel(modelDir), '--tag', `gen${n}`, '--metrics', rel(path.join(modelDir, `doduo-gen${n}.metrics.json`)),
      '--beta', '0.7', '--human-weight', '3.0', '--threads', '4', '--seed', String(n), '--fixture', rel(path.join(modelDir, `doduo-gen${n}.fixture.json`))], `loop-gen${n}-train-doduo`);
    stamp('train-doduo');
  }
  const specF = path.join(__dirname, 'league', `gen${n}.json`);
  fs.writeFileSync(specF, JSON.stringify(Object.assign({}, champ, { name: `gen${n}`, mag: rel(path.join(modelDir, `mag-gen${n}.json`)), doduo: rel(path.join(modelDir, `doduo-gen${n}.json`)), pory2: rel(poryOut) }), null, 1) + '\n');
  if (WARM) {
    const ed = J(path.join(modelDir, `doduo-gen${n}.metrics.json`)).selected_epoch, ep = J(poryMet).selected_epoch;
    if (ed === -1 && ep === -1) throw new Error(`gen${n}: both nets selected epoch -1 (the champion unchanged); the candidate cannot be tested against itself — stopping`);
  }
  const sprtOut = path.join(OUTR, 'gates', `gen${n}-sprt.json`), cloneOut = path.join(OUTR, 'gates', `gen${n}-not-lose-clone.json`);
  if (!done('sprt')) {
    node(path.join(__dirname, 'sprt.js'), ['--release', REL, '--x', rel(specF), '--y', S.champion, '--elo0', '0', '--elo1', '20', '--alpha', '0.05', '--beta', '0.05', '--max-games', '2000',
      '--seed', String(9001 + 10 * off), '--workers', String(W), '--team-store', STORE, '--out', rel(sprtOut)], `loop-gen${n}-sprt`);
    stamp('sprt');
  }
  if (!done('clone')) {
    node(path.join(__dirname, 'gate.js'), ['--release', REL, '--x', rel(specF), '--y', S.clone, '--pairs', '100', '--pair-seed', '1', '--seed', String(9002 + 10 * off), '--workers', String(W), '--rule', 'notlose', '--team-store', STORE, '--out', rel(cloneOut)], `loop-gen${n}-clone`);
    stamp('clone');
  }
  const sp = J(sprtOut), cl = J(cloneOut), pm = J(poryMet).gate_nonworse_vs_v0, dd = J(path.join(modelDir, `doduo-gen${n}.metrics.json`)).human_test_vs_v1.joint_ll.diff;
  const bst = S.stages[K('build')];
  const v = { gen: n, candidate: rel(specF), champion_before: S.champion, preregistration: PREREG,
    recipe: WARM ? { name: 'warm', init: S.champion, lr_doduo: 1e-4, lr_pory2: 1.5e-4, tol_ref: 'anchor', beta: 0.7, human_weight: 3.0, champion_weight: CHAMP_W,
      champion_dirs: bst.dirs.filter((d, i) => (bst.weights || [])[i] === CHAMP_W),
      selected_epoch: { doduo: J(path.join(modelDir, `doduo-gen${n}.metrics.json`)).selected_epoch, pory2: J(poryMet).selected_epoch } } : { name: 'r3' },
    G_pory2_human: { diff: pm.diff, ci95: pm.ci95, pass: pm.pass },
    G_beats_previous_SPRT: { verdict: sp.verdict, llr_at_stop: sp.llr_at_stop, pairs_used: sp.pairs_used, games_used: sp.games_used, result: sp.result, elo_estimate: sp.elo_estimate },
    G_not_lose_clone: { score: cl.result.score_x, ci95: cl.result.ci95_x, W: cl.result.W, L: cl.result.L, pass: cl.pass },
    selfplay: S.stages[K('selfplay')], pool: { dirs: S.stages[K('build')].dirs.length, doduo_decisions: S.stages[K('build')].doduo_decisions, pory2_positions: S.stages[K('build')].pory2_positions, pory2_with_deep: S.stages[K('build')].pory2_with_deep, fallbacks_kept: bst.doduo_fallbacks_kept || 0 },
    doduo_drift: dd, at: new Date().toISOString() };
  v.sprt_pass = sp.verdict.startsWith('H1');
  v.accepted = !!(pm.pass && v.sprt_pass && cl.pass);
  if (v.accepted) { S.previous = S.champion; S.champion = rel(specF); }
  v.champion_after = S.champion;
  fs.writeFileSync(path.join(modelDir, 'gates.json'), JSON.stringify(v, null, 1));
  S.history.push({ gen: n, accepted: v.accepted, sprt: sp.verdict, games: sp.games_used, score: sp.result.score_x });
  S.fails = v.sprt_pass ? 0 : (S.fails || 0) + 1;
  S.next = n + 1;
  save(S);
  log(`gen${n}: ${v.accepted ? 'ACCEPTED' : 'rejected'} — ${sp.verdict}, ${sp.games_used} games, ${sp.result.score_x.toFixed(3)}; consecutive SPRT fails ${S.fails}`);
  return v;
}

function main() {
  if (flag('--dry-publish-from', null)) { publish(J(flag('--dry-publish-from')), {}); return; }
  const armed = Object.keys(process.env).filter(k => /_BREAK$/.test(k) && process.env[k]);
  if (armed.length) throw new Error('refusing to run with a deliberate break armed: ' + armed.join(', '));
  let S = load();
  if (!S) { S = { what: 'MACHAMP unattended loop state', release: REL, recipe: RECIPE, preregistration: PREREG, started: new Date().toISOString(),
    champion: 'solver/machamp/league/gen5.json', previous: 'solver/machamp/league/gen0-r2.json', clone: 'solver/machamp/league/human-clone.json', next: +flag('--start', WARM ? 8 : 6), fails: 0, history: [], stages: {} }; save(S); }
  if ((S.recipe || 'r3') !== RECIPE) throw new Error(`state ${rel(STATE)} was written under recipe ${S.recipe || 'r3'}, not ${RECIPE}`);
  for (;;) {
    if (fs.existsSync(STOPF)) { log('STOP file present: stopping'); break; }
    if ((S.fails || 0) >= 2) { log('two consecutive generations failed the SPRT: stopping'); break; }
    const v = generation(S);
    publish(v, S); save(S);
  }
  S.stopped = new Date().toISOString(); save(S);
}

try { main(); process.exit(0); } catch (e) { console.error(e.stack || e); process.exit(1); }
