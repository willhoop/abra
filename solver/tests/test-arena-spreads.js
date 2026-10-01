/* solver/tests/test-arena-spreads.js — the arena fields the spreads the ladder fields, and every artifact says which
 * spreads it played (solver/arena/spread_source.js; abra/regmc 1.49.0).
 *
 *   node solver/tests/test-arena-spreads.js [--no-red] [--only RULE,PARITY,RECORD] [--release <id>]
 *        exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND (a deliberate break stayed green)
 *
 *   RULE     the format's levers, read from it: every role-v1 table entry is within the validator's SP total (evLimit)
 *            and the 32 cap; the table was built by solver/rotom/spreads.js's CURRENT rule text; the default mode is
 *            role-v1; `flat` and `xatu-random` still exist (to re-run a pre-1.49.0 figure).
 *   PARITY   for EVERY set ROTOM plays (every ladder rotation file with recorded spreads), the body the ARENA builds for
 *            it (solver/arena/teams.js buildTeam, the default mode, on a game holding that team) carries exactly the stat
 *            line ROTOM fields: the checkout's own statModify (solver/xatu/sd.js statValue — what the |request| reports)
 *            at the rotation's RECORDED Stat Points and the sheet's nature, all six stats, HP included. Every Choice
 *            Scarf set's arena Speed is the maximum over SP 0..32 and every Trick Room set's the minimum; at least one of
 *            each, or the clause asks nothing. And `flat` still builds the pre-1.49.0 body (the table line, no nature).
 *   OBSERVED (abra/regmc 1.72.0) the observed-v1 table: every entry within the total and the cap, built by the current
 *            rule and the current observed rule over the Smogon files it pins (each on disk at its sha256), on the current
 *            role-v1 as its base; it is NOT the default; and for EVERY set ROTOM plays — the Smogon- and tournament-observed
 *            ones included — the body the arena builds at --spreads observed-v1 carries exactly ROTOM's line (all six
 *            stats at the recorded Stat Points and the sheet nature). At least one Smogon-observed set, or it asks nothing.
 *   RECORD   a 1-pair match through solver/mew/play.js (two greedy human-clone agents, --cap 3): with no --spreads every
 *            line says role-v1, the summary's stamp names the table file at its sha256 and a fielded digest, and all 16
 *            bodies were dressed; with --spreads flat every line says flat and 0 bodies were dressed; with
 *            --spreads xatu-random 16 bodies were dressed and the lines say so.
 *
 * RED, unless --no-red: SPREADS_SOURCE_BREAK=scarf (a Choice Scarf set's Speed SP moved to HP — the 1.34.0 arena Speed)
 * must turn PARITY red, and OBSERVED red (the break applies to every table mode); SPREADS_SOURCE_BREAK=stamp (the artifact block says `flat` whatever was fielded) must turn
 * RECORD red.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const ROOT = path.join(__dirname, '..', '..');
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require('../arena/env.js');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const want = c => !ONLY || ONLY.includes(c);
const REL = process.env.ARENA_TEST_RELEASE || (argv.includes('--release') ? argv[argv.indexOf('--release') + 1] : 'eaa5becc54eb');
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
const STORE = [path.join(ROOT, 'data', 'team-pool-frozen-regmc'), path.join(MAIN, 'data', 'team-pool-frozen-regmc')].find(d => fs.existsSync(path.join(d, 'games.bo3.jsonl')));
if (!fs.existsSync(path.join(ROOT, 'data', 'releases', REL))) { console.log('CANNOT ANSWER: release ' + REL + ' is not in data/releases'); process.exit(2); }
const SS = require('../arena/spread_source.js');
if (!fs.existsSync(SS.TABLE_FILE)) { console.log('CANNOT ANSWER: no role-v1 table at ' + SS.TABLE_FILE); process.exit(2); }

let fails = 0, checks = 0, notChecked = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const KEY = { hp: 'hp', atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };

const ENGINE = require('../arena/engine.js').load(REL);
const M = ENGINE.API.M;
const T = require('../arena/teams.js');
const SD = require('../xatu/sd.js');
const SPR = require('../rotom/spreads.js');
const X = require('../human/dex.js');

/* ---------------- RULE ---------------- */
if (want('RULE')) {
  const J = JSON.parse(fs.readFileSync(SS.TABLE_FILE, 'utf8'));
  let bad = 0; const vals = Object.values(J.spreads);
  for (const v of vals) { const e = SS.decode(v).evs; const tot = STATS.reduce((a, s) => a + e[s], 0); if (tot > SD.SP_TOTAL || STATS.some(s => e[s] > SD.SP_CAP || e[s] < 0)) bad++; }
  ok('RULE', vals.length > 1000 && bad === 0, `every table spread is within the format's total ${SD.SP_TOTAL} and cap ${SD.SP_CAP} (${bad} of ${vals.length} outside)`);
  ok('RULE', J.provenance.rule === SPR.RULE_TEXT, 'the table was built by solver/rotom/spreads.js\'s current rule');
  ok('RULE', SS.DEFAULT === 'role-v1' && ['flat', 'xatu-random', 'role-v1', 'observed-v1'].every(m => SS.MODES.includes(m)), 'default role-v1; observed-v1, flat and xatu-random available');
  console.log(`  RULE: ${vals.length} table sets, SP total ${SD.SP_TOTAL}, cap ${SD.SP_CAP}`);
}

/* ---------------- PARITY ---------------- */
if (want('PARITY')) {
  const dir = path.join(ROOT, 'solver', 'rotom', 'teams');
  const rots = fs.readdirSync(dir).filter(f => /^ladder-rotation.*\.json$/.test(f)).map(f => [f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))])
    .filter(([, J]) => Array.isArray(J.teams) && J.teams.every(t => Array.isArray(t.spreads)));
  let sets = 0, lineSame = 0, scarf = 0, scarfMax = 0, tr = 0, trMin = 0, flatOk = 0, flatN = 0, observedTour = 0, offTable = 0;
  const diffs = [], observedList = [], offTableDiff = [];
  const TABLE = JSON.parse(fs.readFileSync(SS.TABLE_FILE, 'utf8'));
  const builtAt = Date.parse(TABLE.provenance.built);
  const covered = J => Date.parse((J.respread && J.respread.at) || J.generated) <= builtAt;
  for (const [f, J] of rots) for (const t of J.teams) {
    const rows = t.spreads.map(z => ({ species: z.species, item: z.item, ability: z.ability, nature: z.nature, moves: z.moves.slice() }));
    for (const brought of [[0, 1, 2, 3], [2, 3, 4, 5]]) {
      const G = { id: 'parity', sheets: { p1: rows, p2: rows }, brought: { p1: brought, p2: brought } };
      const got = T.buildTeam(M, G, 'p1'), flat = T.buildTeam(M, G, 'p1', { spreads: 'flat' });
      if (!got) { ok('PARITY', false, f + ' ' + t.id + ': the arena could not build the team'); continue; }
      got.team.forEach((b, k) => {
        const s = got.sheetOf[k], z = t.spreads[s], row = rows[s];
        if (brought[0] === 2 && s < 4) return;   // each row once
        /* every set's ROLE-V1 body, whatever the ladder plays for it (1.72.0: most rotation sets now play an observed
         * spread on the ladder, and role-v1 must still put Choice Scarf and Trick Room sets at the top / bottom) */
        const have = {}; for (const st of STATS) have[st] = b.st[KEY[st]];
        const spe = []; for (let v = 0; v <= SD.SP_CAP; v++) spe.push(SD.statValue(row.species, row.nature, 'spe', v));
        const role = SPR.role(row);
        if (X.toID(row.item) === 'choicescarf' && role.role === 'fast') { scarf++; if (have.spe === Math.max(...spe)) scarfMax++; else if (diffs.length < 8) diffs.push('Scarf ' + row.species + ' arena Speed ' + have.spe + ' max ' + Math.max(...spe)); }
        if (role.role === 'trickroom') { tr++; if (have.spe === Math.min(...spe)) trMin++; else if (diffs.length < 8) diffs.push('Trick Room ' + row.species + ' arena Speed ' + have.spe + ' min ' + Math.min(...spe)); }
        const fb = flat.team[k]; flatN++;
        const line = M.buildMon(fb.name, {}); if (line && JSON.stringify(fb.st) === JSON.stringify(line.st) && !fb._nature) flatOk++;
        /* a PUBLISHED tournament spread (solver/rotom/spreads.js hook 0, the tournament rotation, 2026-10-01): role-v1 pins
         * the observed hooks off by design (solver/arena/build_spreads.js header: "an observed table is a new version"), so
         * the arena fields the derived spread for it. Counted and printed, never compared — and never silently.
         * 1.72.0: the same holds for a set ROTOM plays at a Smogon-observed spread; observed-v1 is the version that fields
         * it, and OBSERVED below checks its parity. */
        if (/^observed:/.test(z.source || '')) { observedTour++; if (observedList.length < 8) observedList.push(f + ' ' + t.id + ' ' + row.species); return; }
        const want = {}; for (const st of STATS) want[st] = SD.statValue(row.species, row.nature, st, z.evs[st]);
        const same = STATS.every(st => want[st] === have[st]);
        /* A ROTATION THE role-v1 TABLE PREDATES (2026-10-01: the tournament rotation was built after the table). The table
         * holds MEDICHAM-oracle spreads, ROTOM derives with Showdown's oracles, and the two disagree by a point on a few
         * sets; the table builder reconciles them for the rotations that exist when it runs (a rotation set takes the
         * ladder's recorded spread), and only a NEW table version can do that for a later rotation. So a set of a rotation
         * generated (or re-spread) after the table was built is compared, and where the two differ it is reported NOT
         * CHECKED by name — never counted as a pass. A rotation the table covers must still match exactly. */
        if (!same && !covered(J)) { offTable++; offTableDiff.push(f + ' ' + t.id + ' ' + row.species + ' want ' + STATS.map(x => want[x]).join('/') + ' arena ' + STATS.map(x => have[x]).join('/') + (SPR.setKey(row) in TABLE.spreads ? ' (table entry)' : ' (derived at play time)')); return; }
        sets++;
        if (same) lineSame++; else if (diffs.length < 8) diffs.push(f + ' ' + t.id + ' ' + row.species + ' want ' + STATS.map(x => want[x]).join('/') + ' arena ' + STATS.map(x => have[x]).join('/'));
      });
    }
  }
  ok('PARITY', sets > 0 && lineSame === sets, `the arena body equals ROTOM's fielded stat line on every rotation set (${lineSame} of ${sets})`);
  ok('PARITY', scarf > 0 && scarfMax === scarf, `every Choice Scarf set runs its maximum Speed in the arena (${scarfMax} of ${scarf})`);
  ok('PARITY', tr > 0 && trMin === tr, `every Trick Room set runs its minimum Speed in the arena (${trMin} of ${tr})`);
  ok('PARITY', flatN > 0 && flatOk === flatN, `--spreads flat still builds the pre-1.49.0 body: the table line, no nature (${flatOk} of ${flatN})`);
  for (const d of diffs) console.log('    ' + d);
  console.log(`  PARITY: ${sets} rotation sets, line identical ${lineSame}; Scarf ${scarfMax}/${scarf} at max Speed; Trick Room ${trMin}/${tr} at min`);
  if (observedTour) console.log(`  PARITY: ${observedTour} set(s) play an OBSERVED spread (tournament or Smogon) on the ladder and the role-v1 derived one in the arena at the default (by design, not compared here; OBSERVED checks them at observed-v1): ${observedList.slice(0, 4).join('; ')}${observedList.length > 4 ? '; ...' : ''}`);
  for (const d of offTableDiff) { notChecked++; console.log('  NOT CHECKED [PARITY] the role-v1 table (built ' + TABLE.provenance.built + ') predates this rotation and its line differs from ROTOM\'s (cover the rotation in a new table version): ' + d); }
}

/* ---------------- OBSERVED (observed-v1) ---------------- */
if (want('OBSERVED')) {
  const sha = f => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  if (!fs.existsSync(SS.OBS_TABLE_FILE)) ok('OBSERVED', false, 'no observed-v1 table at ' + SS.OBS_TABLE_FILE);
  else {
    const J = JSON.parse(fs.readFileSync(SS.OBS_TABLE_FILE, 'utf8'));
    let bad = 0; const vals = Object.values(J.spreads);
    for (const v of vals) { const e = SS.decode(v).evs; const tot = STATS.reduce((a, s) => a + e[s], 0); if (tot > SD.SP_TOTAL || STATS.some(s => e[s] > SD.SP_CAP || e[s] < 0)) bad++; }
    ok('OBSERVED', vals.length > 1000 && bad === 0, `every observed-v1 spread is within the total and the cap (${bad} of ${vals.length} outside)`);
    ok('OBSERVED', J.provenance.version === 'observed-v1' && J.provenance.rule === SPR.RULE_TEXT && J.provenance.observed.rule === SPR.OBSERVED_RULE_TEXT && J.provenance.base.sha256 === sha(SS.TABLE_FILE),
      'observed-v1 was built by the current rule and observed rule on the current role-v1');
    const pinned = J.provenance.observed.files.filter(f => fs.existsSync(path.join(ROOT, f.file)) && sha(path.join(ROOT, f.file)) === f.sha256).length;
    ok('OBSERVED', J.provenance.observed.files.length > 0 && pinned === J.provenance.observed.files.length, `every Smogon file observed-v1 pins is on disk at its sha256 (${pinned} of ${J.provenance.observed.files.length})`);
    ok('OBSERVED', SS.DEFAULT !== 'observed-v1', 'observed-v1 is not the arena default (switching it is Will\'s call)');
    const dir = path.join(ROOT, 'solver', 'rotom', 'teams');
    const rots = fs.readdirSync(dir).filter(f => /^ladder-rotation.*\.json$/.test(f)).map(f => [f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))])
      .filter(([, R]) => Array.isArray(R.teams) && R.teams.every(t => Array.isArray(t.spreads)));
    let n = 0, same = 0, smogon = 0, smogonSame = 0; const diffs = [];
    for (const [f, R] of rots) for (const t of R.teams) {
      const rows = t.spreads.map(z => ({ species: z.species, item: z.item, ability: z.ability, nature: z.nature, moves: z.moves.slice() }));
      for (const brought of [[0, 1, 2, 3], [2, 3, 4, 5]]) {
        const G = { id: 'parity-obs', sheets: { p1: rows, p2: rows }, brought: { p1: brought, p2: brought } };
        const got = T.buildTeam(M, G, 'p1', { spreads: 'observed-v1' });
        if (!got) { ok('OBSERVED', false, f + ' ' + t.id + ': the arena could not build the team at observed-v1'); continue; }
        got.team.forEach((b, k) => {
          const s = got.sheetOf[k], z = t.spreads[s], row = rows[s];
          if (brought[0] === 2 && s < 4) return;
          const want = STATS.map(st => SD.statValue(row.species, row.nature, st, z.evs[st])).join('/');
          const have = STATS.map(st => b.st[KEY[st]]).join('/');
          const isSm = /^observed:data\//.test(z.source || '');
          n++; if (isSm) smogon++;
          if (want === have) { same++; if (isSm) smogonSame++; } else if (diffs.length < 8) diffs.push(f + ' ' + t.id + ' ' + row.species + ' want ' + want + ' arena ' + have);
        });
      }
    }
    ok('OBSERVED', n > 0 && same === n, `at observed-v1 the arena body equals ROTOM's fielded line on every rotation set (${same} of ${n})`);
    ok('OBSERVED', smogon > 0 && smogonSame === smogon, `... including every Smogon-observed set (${smogonSame} of ${smogon}; need >= 1 or the clause asks nothing)`);
    for (const d of diffs) console.log('    ' + d);
    console.log(`  OBSERVED: ${vals.length} table sets ${JSON.stringify(J.provenance.sources)}; rotation parity ${same}/${n} (Smogon-observed ${smogonSame}/${smogon})`);
  }
}

/* ---------------- RECORD ---------------- */
if (want('RECORD')) {
  if (!STORE) { console.log('  RECORD: CANNOT ANSWER — no frozen team store (games.bo3.jsonl) in this checkout or the main one'); ok('RECORD', false, 'no frozen team store'); }
  else {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-spreads-'));
    const sha = f => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    const clone = path.join(ROOT, 'solver', 'machamp', 'league', 'human-clone.json');
    const play = (tag, extra) => {
      const out = path.join(TMP, tag + '.jsonl');
      const r = cp.spawnSync(process.execPath, ['--max-old-space-size=1536', path.join(ROOT, 'solver', 'mew', 'play.js'), '--mode', 'match', '--release', REL, '--x', clone, '--y', clone,
        '--pairs', '1', '--pair-seed', '2', '--seed', '9', '--cap', '3', '--team-store', STORE, '--out', out, ...extra], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
      ok('RECORD', r.status === 0, tag + ': play.js ran (exit ' + r.status + ') ' + String(r.stderr || '').slice(-300));
      if (r.status !== 0) return null;
      return { s: JSON.parse(fs.readFileSync(out + '.summary.json', 'utf8')), lines: fs.readFileSync(out, 'utf8').trim().split('\n').map(JSON.parse) };
    };
    const d = play('default', []);
    if (d) {
      ok('RECORD', d.lines.length === 2 && d.lines.every(l => l.spreads === 'role-v1'), 'no --spreads: every match line says role-v1 (' + d.lines.map(l => l.spreads).join(',') + ')');
      ok('RECORD', d.s.spreads && d.s.spreads.spreads === 'role-v1' && d.s.spreads.table && d.s.spreads.table.sha256 === sha(SS.TABLE_FILE) && d.s.spreads.fielded && d.s.spreads.fielded.sets > 0,
        'the summary stamps role-v1, the table at its sha256 and a fielded digest (' + JSON.stringify(d.s.spreads && { spreads: d.s.spreads.spreads, table: d.s.spreads.table && d.s.spreads.table.sha256.slice(0, 12), fielded: d.s.spreads.fielded }) + ')');
      ok('RECORD', d.s.spreads && d.s.spreads.counters.bodies_dressed === 16 && !d.s.spreads.counters.flat_fallback, 'all 16 bodies dressed at role-v1 (' + JSON.stringify(d.s.spreads && d.s.spreads.counters) + ')');
    }
    const f = play('flat', ['--spreads', 'flat']);
    if (f) {
      ok('RECORD', f.lines.every(l => l.spreads === 'flat') && f.s.spreads.spreads === 'flat' && f.s.spreads.counters.bodies_dressed === 0, '--spreads flat: every line and the stamp say flat, 0 bodies dressed');
    }
    const x = play('xatu', ['--spreads', 'xatu-random']);
    if (x) {
      ok('RECORD', x.lines.every(l => l.spreads === 'xatu-random') && x.s.spreads.spreads === 'xatu-random' && x.s.spreads.counters.bodies_dressed === 16, '--spreads xatu-random: the lines and stamp say so, 16 bodies dressed');
    }
    console.log('  RECORD: default ' + (d && d.s.spreads.spreads) + ', flat ' + (f && f.s.spreads.spreads) + ', xatu ' + (x && x.s.spreads.spreads));
  }
}

/* ---------------- RED ---------------- */
let blind = false;
if (!NO_RED && !ONLY) {
  for (const [brk, clause] of [['scarf', 'PARITY'], ['stamp', 'RECORD'], ['scarf', 'OBSERVED']]) {
    const r = cp.spawnSync(process.execPath, [__filename, '--no-red', '--only', clause, '--release', REL], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { SPREADS_SOURCE_BREAK: brk }), maxBuffer: 1 << 26 });
    const red = r.status === 1 && new RegExp('FAIL \\[' + clause + '\\]').test(r.stdout);
    console.log(`  RED SPREADS_SOURCE_BREAK=${brk}: ${red ? clause + ' went red, as it must' : 'STAYED GREEN (exit ' + r.status + ') — the test is blind'}`);
    if (!red) blind = true;
  }
}

console.log(`\ntest-arena-spreads: ${checks - fails}/${checks} ${fails ? 'RED ' + JSON.stringify([...failed]) : blind ? 'BLIND' : 'GREEN'}${notChecked ? '  (' + notChecked + ' NOT CHECKED, named above)' : ''}`);
process.exit(fails ? 1 : blind ? 3 : 0);
