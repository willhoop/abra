/* probe_moldbreaker_refusals.js — A MOLD BREAKER USER AGAINST EVERY BREAKABLE REFUSAL THAT READ THE RAW
 * ABILITY (2026-09-18, ENGINE).
 *
 *   SHOWDOWN_PATH=... node tests/probe_moldbreaker_refusals.js --release <id>
 *   SHOWDOWN_PATH=... node tests/probe_moldbreaker_refusals.js --release <id> --only magicbounce
 *
 * Each case is a `tests/roster.js` scenario played through the roster AS A LIBRARY, so it is compared by
 * the same instrument, the same pin and the same board reader as every roster row:
 *
 *   SUBJECT   a thrower holding a non-piercing ability clicks the move at the carrier. The carrier's
 *             breakable ability refuses it for exactly one reason.
 *   CONTROL   the SAME thrower holding Mold Breaker (`controlKind: 'piercer'`). The carrier is untouched.
 *   READABLE  the carrier holding a DIFFERENT ability, played in both thrower arms: the effect must land on
 *             a board leaf there, so an inert verdict on the real carrier is a fact about the ability and
 *             not a dead fixture. (The Oblivious lesson: a control that cannot read differently proves
 *             nothing.)
 *
 * Every body and move is legal in Reg M-B; the carriers and throwers were derived with
 * `Dex.forFormat(...)`/`TeamValidator.checkCanLearn` (report §7), and the probe re-asserts the
 * thrower's legal Mold Breaker slot and the move's learnability on every run.
 *
 * EXPECTATIONS, per case (read off the authority, never typed as a board value):
 *   board      the authority's board MOVES between the arms; the engine must MATCH. Each carries a knob that
 *              restores the raw read, and a child run under it must read DID-NOT-FIRE.
 *   narration  the authority's board does NOT move (the ability cures what the piercer let through); the
 *              engine must agree, and the READABLE arm must show the effect landing.
 *
 * Damp is not a case: no legal Mold Breaker-family user in this regulation learns Explosion, Self-Destruct
 * or Misty Explosion, and the probe re-derives that on every run and FAILS if it stops being true. */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. Not a pass.'); process.exit(2); }
const RELID = ARG('--release');
if (!RELID) { console.log('NOT RUN — pass --release <id>; this probe loads the roster, which must not cut one.'); process.exit(2); }
const ONLY = ARG('--only');
const KNOB = process.env.PROBE_MB_CHILD || null;          // set only in a child run

const argv0 = process.argv.slice();
process.argv = [argv0[0], D('tests', 'roster.js'), '--release', RELID, '--stage', 'abilities'];
const R = require(D('tests', 'roster.js'));
process.argv = argv0;
const CS = require(D('engine', 'champions_sim.js'));
const { Dex, TeamValidator } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT), V = new TeamValidator(CS.FORMAT);

const CASES = [
  { id: 'magicbounce', kind: 'board', knob: 'MEDI_BOUNCE_UNBREAKABLE',
    thrower: ['pangoro', 'Iron Fist'], click: 'scaryface', carrier: ['espeon', 'Magic Bounce', ''],
    readable: 'Synchronize' },
  { id: 'stickyhold', kind: 'board', knob: 'MEDI_STICKYHOLD_UNBREAKABLE',
    thrower: ['pangoro', 'Iron Fist'], click: 'knockoff', carrier: ['hydrapple', 'Sticky Hold', 'lightclay'],
    readable: 'Regenerator' },
  { id: 'goodasgold', kind: 'board', knob: 'MEDI_STATUS_REFUSAL_UNBREAKABLE',
    thrower: ['pangoro', 'Iron Fist'], click: 'scaryface', carrier: ['gholdengo', 'Good as Gold', ''],
    readable: null /* Gholdengo has one ability; the roster row carries this case's readable arm */ },
  { id: 'owntempo', kind: 'narration',
    thrower: ['basculegion', 'Adaptability'], click: 'confuseray', carrier: ['slowbro', 'Own Tempo', ''],
    readable: 'Regenerator' },
  { id: 'oblivious', kind: 'narration',
    thrower: ['pangoro', 'Iron Fist'], click: 'taunt', carrier: ['salazzle', 'Oblivious', ''],
    readable: 'Corrosion' },
].filter(c => !ONLY || c.id === ONLY);

let bad = 0;
const ok = (cond, what, detail) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what
  + (detail ? '\n          ' + detail : '')); if (!cond) bad++; };
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const mon = (species, ability, moves, item) => ({ species, item: item || '', ability, moves: moves.concat(['focusenergy']) });
const IDLE = { m: 'focusenergy' };

function scenario(c, carrierAb) {
  return {
    id: 'probe/mb-' + c.id + '-' + idOf(carrierAb), kind: 'ability', entityId: c.id, arm: 'top-tie-first',
    subject: 'B0', hpA: 4, hpB: 4,
    A: [mon(c.thrower[0], c.thrower[1], [c.click]), mon('corviknight', 'Pressure', []),
        mon('milotic', 'Competitive', []), mon('clefable', 'Magic Guard', [])],
    B: [mon(c.carrier[0], carrierAb, [], c.carrier[2]), mon('snorlax', 'Thick Fat', []),
        mon('garchomp', 'Rough Skin', []), mon('toxapex', 'Regenerator', [])],
    script: [{ p1: [{ m: c.click, t: 0 }, IDLE], p2: [IDLE, IDLE] }, { p1: [IDLE, IDLE], p2: [IDLE, IDLE] }],
    controlKind: 'piercer', piercer: { slot: 0, ability: 'Mold Breaker', subjectAbility: c.thrower[1], species: c.thrower[0] },
    abilityId: idOf(carrierAb), carrierSpecies: c.carrier[0], controlAbility: 'Mold Breaker', controlQuiet: true,
  };
}
const run = (c, ab) => R.runEntry({ kind: 'ability', id: c.id, name: c.id, rule: 'probe', controlQuiet: true,
                                    scenario: scenario(c, ab) });

console.log('\nMOLD BREAKER AGAINST THE BREAKABLE REFUSALS — release ' + RELID + (KNOB ? '   CHILD under ' + KNOB + '=1' : ''));

if (!KNOB) {
  /* the legality of every fixture, asked of the format on this run */
  for (const c of CASES) {
    const th = dex.species.get(c.thrower[0]), ca = dex.species.get(c.carrier[0]);
    ok(Object.values(th.abilities).includes('Mold Breaker') && Object.values(th.abilities).includes(c.thrower[1])
       && !V.checkCanLearn(dex.moves.get(c.click), th)
       && Object.values(ca.abilities).includes(c.carrier[1]) && (!c.readable || Object.values(ca.abilities).includes(c.readable)),
       c.id + ': the thrower legally holds Mold Breaker and ' + c.thrower[1] + ' and learns ' + c.click
       + '; the carrier legally holds ' + c.carrier[1] + (c.readable ? ' and ' + c.readable : ''));
  }
  /* Damp stays out of scope only while no legal Mold Breaker user learns a self-destructing move */
  if (!ONLY) {
    const legal = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
    const users = dex.species.all().filter(s => legal(s) && Object.values(s.abilities).includes('Mold Breaker'));
    const boom = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.selfdestruct === 'always');
    const pairs = [];
    for (const s of users) {
      const base = s.battleOnly ? dex.species.get(Array.isArray(s.battleOnly) ? s.battleOnly[0] : s.battleOnly) : s;
      for (const m of boom) if (!V.checkCanLearn(m, base)) pairs.push(s.name + '/' + m.name);
    }
    ok(pairs.length === 0, 'Damp: no legal Mold Breaker user learns a self-destructing move ('
       + boom.map(m => m.name).join(', ') + '), so Damp-versus-Mold-Breaker cannot occur in this regulation',
       pairs.join(', '));
  }
}

for (const c of CASES) {
  if (KNOB && c.knob !== KNOB) continue;
  const r = run(c, c.carrier[1]);
  if (KNOB) {
    ok(r.verdict === 'DID-NOT-FIRE', c.id + ' under ' + KNOB + '=1 reads DID-NOT-FIRE (the raw read is back)',
       r.verdict + ' ' + String(r.why || '').slice(0, 120));
    continue;
  }
  if (c.kind === 'board') {
    ok(r.verdict === 'FIRED-AND-BOARDS-MATCH', c.id + ': the authority moves a board leaf when the thrower '
       + 'holds Mold Breaker, and this engine agrees',
       r.verdict + ' ' + (r.sd_delta || []).map(d => d.path).slice(0, 4).join(', '));
  } else {
    ok(r.verdict === 'COULD-NOT-STAGE' && /INERT/.test(r.why || ''), c.id + ': the authority\'s board does NOT '
       + 'move between the arms (the ability cures what Mold Breaker let through) — narration only', r.verdict);
  }
  if (c.readable) {
    /* both thrower arms against a carrier WITHOUT the ability: the effect must be on the board */
    const s2 = scenario(c, c.readable);
    const sub = R.play(s2, null, 'top-tie-first');
    const moved = (sub.boards || []).some((b, i) => i > 0 && require(D('engine', 'board_state.js'))
      .compare(sub.boards[0].sd, b.sd, { compared: 0 }).some(d => /^p2\.active\[0\]\.|^p1\.active\[0\]\.boosts/.test(d.path)
        && !/\.pp\b|focusenergy/.test(d.path)));
    ok(moved, c.id + ': READABLE arm — against ' + c.readable + ' the click lands on a board leaf the reading '
       + 'can see, so the fixture is live');
  }
}

if (!KNOB) {
  for (const knob of [...new Set(CASES.filter(c => c.knob).map(c => c.knob))]) {
    let out = '', code = 0;
    try {
      out = execFileSync(process.execPath, ['--max-old-space-size=6144', __filename, '--release', RELID]
        .concat(ONLY ? ['--only', ONLY] : []), { env: { ...process.env, [knob]: '1', PROBE_MB_CHILD: knob },
        encoding: 'utf8', maxBuffer: 1 << 26 });
    } catch (e) { out = String(e.stdout || ''); code = e.status || 1; }
    ok(code === 0, 'CHILD under ' + knob + '=1 went red on its own case(s), as it must',
       out.split('\n').filter(l => /PASS|FAIL/.test(l)).join(' | ').slice(0, 300));
  }
}
console.log('\n' + (bad ? bad + ' FAILED' : 'ALL PASS'));
process.exit(bad ? 1 : 0);
