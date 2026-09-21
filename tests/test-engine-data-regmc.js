/* test-engine-data-regmc.js — CAN MEDICHAM BUILD EVERY REG M-C BODY, OUT OF data/engine-data-regmc.js?
 *
 * Until 2026-09-21 it could not build ONE of the 35 species Reg M-C adds: data/engine-data.js is Reg
 * M-B's table and has no row for any of them, so `buildMon` returned null and selecting the regulation
 * got the right authority and a runtime that could not field it (docs/REGMC.md).
 *
 * WHAT THIS ASKS, AND WHY FROM THE CONSUMER'S SIDE. The builder already counts the 2026-07-30 shape on
 * the rows it writes. That is necessary and it cannot see a species the builder never wrote. So the
 * population here comes from the FORMAT — every species Reg M-C admits, including what the
 * TeamValidator re-admits over the strict filter (engine/legal_scope.js) — and every one is put through
 * medicham2's own `buildMon`, the function every rollout calls:
 *
 *   1  every admitted species builds: base stats, >= 1 move, and an ability that is a real M-C ability
 *      AND one this forme can have
 *   2  the 35 species M-C adds over the PINNED Reg M-B authority all build (derived in a child against
 *      both checkouts, never typed)
 *   3  every `Future`-flagged ability the validator re-admits reaches a row AND a built body
 *   4  a real M-C team — six sets taken off the table's own observed rows, at least one an added
 *      species and one the re-admitted ability's carrier — passes the M-C TeamValidator, and every body
 *      buildMon returns from it carries moves and a real ability
 *   5  CONTROL, KNOB CLEARED: the same added species against Reg M-B's table resolve FEWER times. An
 *      identical result would mean the table was never what decided it (docs/LESSONS.md)
 *   6  the artifact holds no two keys that flatten alike — the 2026-07-30 question asked correctly
 *   7  every move any row carries has a move-table entry (`dmgRange` reads MC.moves[id].bp)
 *
 * SHOWN RED FIRST, 2026-09-21: a copy of the table with one added species' `mv` emptied and another's
 * row deleted fails clauses 1, 2 and both of 4 — 380 of 382, 33 of 35, the validator refusing the
 * moveless set — and the builder's own `--check` fails the same copy naming both rows.
 *
 * EACH REGULATION RUNS IN ITS OWN CHILD. The regulation is resolved at module load, and
 * engine/showdown_path.js writes SHOWDOWN_PATH into the environment as a side effect of being required
 * — tests/run-all.js requires it — so a child inherits the DEFAULT regulation's checkout unless the
 * variable is dropped. Each child is started with it removed and its regulation named.
 *
 *   node tests/test-engine-data-regmc.js
 *   ABRA_REGMC_TABLE=<file> node tests/test-engine-data-regmc.js     judge another copy (the red demo)
 */
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const TABLE = process.env.ABRA_REGMC_TABLE || path.join(ROOT, 'data', 'engine-data-regmc.js');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ── CHILD: legal species of one regulation, from its own checkout ────────────────────────────── */
if (process.argv[2] === '--child-legal') {
  const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
  const D = CS.sim().Dex.forFormat(CS.FORMAT);
  const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  process.stdout.write(JSON.stringify({ format: CS.FORMAT, ids: D.species.all().filter(legal).map(s => s.id) }));
  process.exit(0);
}

/* ── CHILD: everything that must run under Reg M-C ─────────────────────────────────────────────── */
if (process.argv[2] === '--child-mc') {
  const added = JSON.parse(process.argv[3]);
  const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
  const out = { format: CS.FORMAT, carries: CS.sim().Dex.formats.get(CS.FORMAT).exists };
  const D = CS.sim().Dex.forFormat(CS.FORMAT);
  const LS = require(path.join(ROOT, 'engine', 'legal_scope.js'));
  const S = LS.derive();
  const strict = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
  const futSp = new Set(S.futureReadmitted.filter(r => r.startsWith('species:')).map(r => r.slice(8)));
  const species = D.species.all().filter(s => strict(s) || futSp.has(s.id));

  require(TABLE);
  const MCmc = globalThis.MC;
  const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
  const realAb = id => { const a = D.abilities.get(id); return !!(a && a.exists); };

  /* 1 — every admitted species, by its dex NAME, through buildMon */
  const failed = [];
  let built = 0;
  for (const s of species) {
    const b = M.buildMon(s.name);
    const why = !b ? 'buildMon returned null'
      : !b.st ? 'no stat line'
      : !(b.moves || []).length ? 'no moves'
      : !b.ability ? 'no ability'
      : !realAb(b.ability) ? `ability ${b.ability} is not an M-C ability`
      : !Object.values(s.abilities || {}).map(norm).includes(norm(b.ability)) ? `ability ${b.ability} is not one ${s.name} can have`
      : null;
    if (why) failed.push(`${s.name}: ${why}`); else built++;
  }
  out.species = species.length; out.built = built; out.failed = failed;

  /* 2 — the 35 added species, same test */
  out.addedBuilt = added.filter(id => { const s = D.species.get(id); const b = s.exists && M.buildMon(s.name);
    return !!(b && (b.moves || []).length && b.ability); });

  /* 3 — the re-admitted `Future` abilities */
  out.future = S.futureReadmitted.filter(r => r.startsWith('ability:')).map(r => {
    const id = r.slice(8);
    const rowKey = Object.keys(MCmc.mons).find(k => MCmc.mons[k].ab === id) || null;
    const b = rowKey && M.buildMon(rowKey);
    return { id, rowKey, bodyAbility: b ? b.ability : null };
  });

  /* 4 — a real team off the table's own observed rows */
  /* NEVER INDEX THE TABLE WITH A KEY IT MAY NOT HOLD: engine/mc_key.js guards MC.mons and THROWS on a
   * miss (LookupMiss), which is how the first red demonstration crashed instead of failing a clause. */
  const rowOf = s => { const k = Object.keys(MCmc.mons).find(x => norm(x) === s.id); return k ? MCmc.mons[k] : null; };
  const team = [], used = new Set(), items = new Set();
  const addSet = (speciesName, row, item, ability) => {
    const s = D.species.get(speciesName);
    const base = norm(s.baseSpecies);
    if (used.has(base) || (item && items.has(norm(item)))) return false;
    used.add(base); if (item) items.add(norm(item));
    team.push({ species: s.name, item: item ? D.items.get(item).name : '', ability: D.abilities.get(ability).name,
                moves: row.mv.map(m => D.moves.get(m).name), nature: row.nature ? D.natures.get(row.nature).name : 'Serious' });
    return true;
  };
  /* the carrier of the first re-admitted ability — the set legal_scope itself put to the validator */
  const fr = (S.future || []).find(r => r.accepted && r.kind === 'ability');
  if (fr && fr.ask) {
    const mega = D.species.get(Object.values(D.items.get(fr.ask.item).megaStone || {})[0] || '');
    const megaRow = mega && mega.exists && rowOf(mega);
    const baseSp = D.species.get(fr.ask.species);
    if (megaRow) addSet(baseSp.name, megaRow, fr.ask.item, baseSp.abilities[0]);
  }
  /* then the added species with the most observations, non-mega, each on its own observed set */
  const addedRows = added.map(id => D.species.get(id)).filter(s => s.exists && !s.isMega && !s.battleOnly)
    .map(s => ({ s, row: rowOf(s) })).filter(x => x.row && x.row.set_source && x.row.set_source.n)
    .sort((a, b) => b.row.set_source.n - a.row.set_source.n);
  for (const { s, row } of addedRows) { if (team.length >= 6) break; addSet(s.name, row, row.item, row.ab); }
  out.team = team;
  const { Teams, TeamValidator } = CS.sim();
  const sets = team.map(t => Object.assign({ name: t.species, level: 50, gender: '',
    evs: Object.assign({}, CS.LEGAL_SPREAD), ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } }, t));
  out.validator = new TeamValidator(CS.FORMAT).validateTeam(Teams.unpack(Teams.pack(sets))) || [];
  out.teamBodies = team.map(t => {
    const key = norm(t.species);
    const b = M.buildMon(t.species, { [t.species]: norm(t.item) });
    return { species: t.species, item: b && b.item, ability: b && b.ability, moves: b ? (b.moves || []).length : 0,
             realAbility: !!(b && realAb(b.ability)), key };
  });
  /* the M-C stones the M-B tag artifact does not know — measured, not failed: a mega a base forme
   * cannot evolve into is the tags' gap, not the table's, and it is reported so it cannot hide */
  const TAGS = require(path.join(ROOT, 'engine', 'tags.js'));
  const stones = D.items.all().filter(it => it.exists && !it.isNonstandard && it.megaStone);
  out.stonesUntagged = stones.filter(it => !TAGS.has('item', it.id, 'megaStone')).map(it => it.id);
  out.stones = stones.length;

  /* 5 — CONTROL: the Reg M-B table, same process, same engine, same added species */
  require(path.join(ROOT, 'data', 'engine-data.js'));    // re-assigns globalThis.MC
  out.controlSwapped = globalThis.MC !== MCmc;
  out.addedBuiltUnderMB = added.filter(id => { const s = D.species.get(id); const b = s.exists && M.buildMon(s.name);
    return !!(b && (b.moves || []).length && b.ability); });

  /* 6 — two keys, one body */
  const flat = new Map();
  for (const k of Object.keys(MCmc.mons)) { const f = norm(k); flat.set(f, (flat.get(f) || []).concat(k)); }
  out.dupes = [...flat.values()].filter(v => v.length > 1);
  out.rows = Object.keys(MCmc.mons).length;
  /* 7 — every move a row carries has a damage-table row: `dmgRange` reads MC.moves[id].bp, so a move
   * on a body with no entry is UNLOOKUPABLE, which is how Reg M-B lost Low Kick for weeks */
  const mvKeys = new Set(Object.keys(MCmc.moves));
  out.movesMissing = [...new Set(Object.values(MCmc.mons).flatMap(r => r.mv || []))].filter(m => !mvKeys.has(m));
  out.moves = mvKeys.size;
  process.stdout.write('\n@@RESULT@@' + JSON.stringify(out));
  process.exit(0);
}

/* ── PARENT ─────────────────────────────────────────────────────────────────────────────────────── */
let pass = 0; const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name + (detail ? '  — ' + detail : '')); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}
const envFor = reg => { const e = Object.assign({}, process.env, { ABRA_REGULATION: reg }); delete e.SHOWDOWN_PATH; return e; };
const run = (args, reg) => {
  try {
    return execFileSync(process.execPath, [__filename, ...args],
      { env: envFor(reg), maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (e) {
    /* A CRASHED CHILD IS RED, AND IT SAYS WHY — a stack of byte arrays is not a reason. */
    console.log(`  FAIL the ${reg} child (${args[0]}) crashed:`);
    for (const l of String(e.stderr || e.message).split('\n').filter(l => /Error|Miss|at /.test(l)).slice(0, 6)) console.log('       ' + l.trim());
    process.exit(1);
  }
};

console.log('REG M-C DAMAGE TABLE — can medicham2 build every Reg M-C body?');
console.log('  table: ' + path.relative(ROOT, TABLE));
if (!fs.existsSync(TABLE)) { console.log('  FAIL the table does not exist — run build/build_engine_data_regmc.js'); process.exit(1); }

const mb = JSON.parse(run(['--child-legal'], 'regmb'));
const mc = JSON.parse(run(['--child-legal'], 'regmc'));
const mbSet = new Set(mb.ids);
const added = mc.ids.filter(id => !mbSet.has(id));
ok('the two children read two different regulations', mb.format !== mc.format, `${mb.format} vs ${mc.format}`);
ok('Reg M-C adds species over the pinned Reg M-B authority', added.length > 0, `${added.length} added, ${mb.ids.filter(id => !mc.ids.includes(id)).length} removed`);

const raw = run(['--child-mc', JSON.stringify(added)], 'regmc');
const R = JSON.parse(raw.slice(raw.indexOf('@@RESULT@@') + 10));

ok('the M-C child loaded a checkout that carries the M-C format', R.format === mc.format && R.carries, R.format);
ok('1  every admitted M-C species builds with stats, moves and a real ability it can have',
  R.built === R.species && R.failed.length === 0,
  `${R.built} of ${R.species}` + (R.failed.length ? ' — ' + R.failed.slice(0, 6).join(' | ') : ''));
ok('2  every species M-C adds builds', R.addedBuilt.length === added.length,
  `${R.addedBuilt.length} of ${added.length}` + (R.addedBuilt.length < added.length ? ' — missing ' + added.filter(a => !R.addedBuilt.includes(a)).join(', ') : ''));
ok('3  the validator re-admits at least one `Future` ability (the path under test exists)', R.future.length > 0,
  R.future.map(f => f.id).join(', ') || 'none');
for (const f of R.future) ok(`3  re-admitted ability ${f.id} reaches a row AND a built body`,
  !!f.rowKey && f.bodyAbility === f.id, `row ${f.rowKey || 'NONE'}, body ability ${f.bodyAbility}`);
ok('4  the team is six sets', R.team.length === 6, R.team.map(t => `${t.species} @ ${t.item || '-'}`).join(', '));
ok('4  it carries an added species', R.team.some(t => added.includes(norm(t.species))),
  R.team.filter(t => added.includes(norm(t.species))).map(t => t.species).join(', '));
ok('4  the M-C TeamValidator accepts it', R.validator.length === 0, R.validator.slice(0, 4).join(' | ') || 'no problems');
ok('4  every body buildMon returns from it carries moves and a real M-C ability',
  R.teamBodies.every(b => b.moves > 0 && b.realAbility),
  R.teamBodies.map(b => `${b.species}: ${b.moves} moves, ${b.ability}`).join(' | '));
ok('5  CONTROL: the table was actually swapped', R.controlSwapped);
ok('5  CONTROL: the same added species resolve FEWER times against the Reg M-B table',
  R.addedBuiltUnderMB.length < R.addedBuilt.length,
  `M-C table ${R.addedBuilt.length}, M-B table ${R.addedBuiltUnderMB.length}` +
  (R.addedBuiltUnderMB.length ? ' (resolved under M-B: ' + R.addedBuiltUnderMB.join(', ') + ')' : ''));
ok('6  no two keys in the table flatten alike', R.dupes.length === 0, R.dupes.map(d => d.join(' + ')).join(' | ') || `${R.rows} rows`);
ok('7  every move a row carries has a move-table entry', R.movesMissing.length === 0,
  R.movesMissing.join(', ') || `${R.moves} move rows`);

/* MEASURED, NOT FAILED — the next gap, printed so it cannot hide behind a green run */
console.log(`\n  NOT THIS TABLE'S GAP, printed so it is seen: ${R.stonesUntagged.length} of ${R.stones} legal M-C mega stones carry no`);
console.log('  `megaStone` tag in data/tags.json (Reg M-B\'s), so a base forme holding one builds but cannot mega evolve');
console.log('  until the tag artifact is derived for M-C: ' + R.stonesUntagged.join(', '));

console.log(`\n  ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log('    FAIL ' + f); process.exit(1); }
