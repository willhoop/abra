/* probe_volley_reactor_count.js — HOW MANY TIMES DOES A VOLLEY THAT KILLS SET OFF THE REACTOR?
 *
 *   SHOWDOWN_PATH=... node tests/probe_volley_reactor_count.js --release <id>
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * `data/mods/champions/scripts.ts:461-464` — the Champions override of `hitStepMoveHitLoop`, NOT
 * mainline:
 *
 *     for (hit = 1; hit <= targetHits; hit++) {
 *       if (damage.includes(false)) break;
 *       if (hit > 1 && pokemon.status === 'slp' && ...) break;
 *       if (targets.every(target => !target?.hp)) break;
 *
 * The loop refuses to open an arrival against a body already on zero. `runEvent('DamagingHit')` is
 * raised INSIDE `spreadMoveHit`, so a Rough Skin, a Gooey or a Stamina is set off once per ARRIVAL
 * THAT LANDED — never once per arrival the volley DREW. `scripts.ts:550` writes `-hitcount` as
 * `hit - 1`, i.e. that same landed count.
 *
 * ================= WHAT THIS PROBE IS FOR =======================================================
 *
 * medicham2's packet loop already breaks on `tg.curHP<=0` and already announces `-hitcount` off the
 * LANDED count. Its reaction count is a SECOND opinion about the same quantity, taken from the
 * DRAWN count (`_hitsThisUse` inside `_stepApply`), and the two come apart on exactly one board: a
 * volley that kills before its last arrival.
 *
 * This probe reads BOTH STREAMS and counts, per turn, the `[from] ability: Rough Skin` lines beside
 * that turn's `-hitcount`. Nothing is typed as an expected value: the verdict is whether the two
 * engines print the same number of tolls on the same turn.
 *
 * THE CONTROLS, and they are the point:
 *   - every turn BEFORE the killing one is a survivor volley — the authority must toll TWICE there,
 *     or "the counts agree" is satisfied by an engine that stopped tolling at all;
 *   - `no-ability` is the same board with Speed Boost in Rough Skin's place. Neither engine may
 *     write a single toll line, and the target must still die.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

if (!process.argv.includes('--release')) {
  console.log('REFUSING TO RUN — pass --release <id>.');
  console.log('  Requiring engine/game_differential.js without it CUTS A RELEASE INTO THE REAL STORE');
  console.log('  at require time (game_differential.js:196).');
  process.exit(2);
}

/* `--state` IS FORCED, AND THE REASON IS THE MEASUREMENT AND NOT CONVENIENCE. The default protocol
 * stop rule halts at the first divergent LINE, and a survivor volley into a contact-punish body parts
 * on turn 1 for a DIFFERENT, still-open reason: the authority interleaves the reactor with each
 * arrival (`hit,TOLL,hit,TOLL`) and this engine batches them below the volley (`hit,hit,TOLL,TOLL`).
 * Same HP on both sides, same `-hitcount` — narration, and it is filed apart. Under the protocol rule
 * the game stops there and the KO turn this probe is about is never reached at all.
 *
 * CLAUDE.md: commentary may differ; boards may not. `--state` is that rule, and `onBoundary` below
 * declares every board identical so the run plays every scripted turn. */
if (!process.argv.includes('--state')) {
  process.argv.push('--state');
  console.log('  --state FORCED — the reactor INTERLEAVE parts the stream on turn 1 (a separate, open,');
  console.log('    narration-only defect), and the protocol stop rule would end the game above the KO turn.');
}
const CS = require(D('engine', 'champions_sim.js'));
const G = require(D('engine', 'game_differential.js'));

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });

/* ---- THE CAST IS DERIVED, NOT NAMED FROM MEMORY ------------------------------------------------- */
const CAST = [['talonflame', 'dualwingbeat'], ['talonflame', 'protect'], ['sharpedo', 'agility'],
              ['sharpedo', 'protect'], ['milotic', 'protect'], ['corviknight', 'protect'],
              ['garchomp', 'protect']];
{
  let bad = 0;
  for (const [sp, mv] of CAST) if (!CS.canLearn(sp, mv)) { console.log('  learnset: ' + sp + ' / ' + mv + ' -> NOT LEGAL'); bad++; }
  console.log('  learnset (TeamValidator): ' + (CAST.length - bad) + ' of ' + CAST.length + ' cast rows LEGAL');
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}
/* THE ABILITY IS THE SPECIES' OWN — printed, so neither arm rests on an ability the validator would
 * refuse. Both arms name a real Sharpedo ability and they differ in nothing else. */
{
  const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
  const Dx = Dex.forFormat('gen9championsvgc2026regmb');
  const s = Dx.species.get('sharpedo');
  console.log('  Dex: sharpedo ' + s.types.join('/') + ' abilities ' + Object.values(s.abilities).join(', ')
    + '  — Flying x' + Math.pow(2, Dx.getEffectiveness('Flying', s.types)));
}

const TEAM_ATK = [mon('talonflame', '', 'Gale Wings', ['Dual Wingbeat', 'Protect']),
                  mon('corviknight', '', 'Pressure', ['Protect']),
                  mon('milotic', '', 'Marvel Scale', ['Protect']),
                  mon('garchomp', '', 'Sand Veil', ['Protect'])];
const foeTeam = ab => [mon('sharpedo', '', ab, ['Agility', 'Protect']),
                       mon('milotic', '', 'Marvel Scale', ['Protect']),
                       mon('corviknight', '', 'Pressure', ['Protect']),
                       mon('garchomp', '', 'Sand Veil', ['Protect'])];

/* TWO TURNS: the survivor volley and the volley that kills. A third would ask Showdown for a
 * post-KO replacement this script does not answer, and the game would end on the harness rather than
 * on the measurement. */
const TURNS = 2;
const SCRIPT = [];
for (let i = 0; i < TURNS; i++) {
  SCRIPT.push({ p1: [{ m: 'agility' }, { m: 'protect' }],
                p2: [{ m: 'dualwingbeat', t: 0 }, { m: 'protect' }] });
}

function unsplit(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const l = String(log[i]);
    if (/^\|split\|/.test(l)) { if (log[i + 1] !== undefined) out.push(String(log[i + 1])); i += 2; continue; }
    out.push(l);
  }
  return out;
}

/* ONE TURN'S SHAPE, on either stream: the arrivals onto the target, the tolls back onto the
 * attacker, the count line and the faint, in the order they were written. */
function turns(lines) {
  const out = []; let cur = null;
  for (const raw of lines.map(String)) {
    if (/^\|turn\|/.test(raw)) { cur = { n: +raw.split('|')[2], hits: 0, tolls: 0, count: null, faint: false, shape: [] }; out.push(cur); continue; }
    if (!cur) continue;
    if (/^\|-damage\|/.test(raw)) {
      if (/\[from\] ability: *rough ?skin/i.test(raw)) { cur.tolls++; cur.shape.push('TOLL'); }
      else if (!/\[from\]/.test(raw)) { cur.hits++; cur.shape.push('hit'); }
      continue;
    }
    if (/^\|-hitcount\|/.test(raw)) { cur.count = +raw.split('|').pop(); cur.shape.push('count:' + cur.count); continue; }
    if (/^\|faint\|/.test(raw)) { cur.faint = true; cur.shape.push('faint'); continue; }
  }
  return out;
}

function runArm(label, ability, note) {
  const a = G.buildPair(foeTeam(ability)), b = G.buildPair(TEAM_ATK);
  if (!a || !b) return { label, note, verdict: 'NOT-STAGED', why: 'buildPair returned null', sd: [], me: [] };
  const r = G.playGame(a, b, 'directed', 'probe-volley:' + label, {
    script: SCRIPT, onBoundary: (snap) => { snap.identical = true; snap.diffs = []; },
  });
  const sd = turns(unsplit((G.lastSdLog ? G.lastSdLog() : []).map(String)));
  const me = turns(((r && r.mediTrace) || []).map(String));
  return { label, note, verdict: r.err ? 'THREW' : 'RAN', why: r.err, sd, me,
           stop: (r && r.endReason) || null, turnsPlayed: r && r.turns };
}

console.log('\nA VOLLEY THAT KILLS — how many arrivals set the reactor off, on both engines\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id));

const ARMS = [
  runArm('rough-skin', 'Rough Skin',
    'THE DEFECT ARM. Every turn is the same two-arrival Dual Wingbeat. The turns before the KO are '
    + 'the survivor control — the authority tolls TWICE there. On the turn the first arrival kills, '
    + 'the authority opens no second arrival, so it tolls ONCE.'),
  runArm('no-ability', 'Speed Boost',
    'THE CLEARED CONTROL: the same board, the same clicks, Sharpedo’s OTHER legal ability. '
    + 'NEITHER engine may write a toll line, and the body must still die — otherwise the arm above '
    + 'is measuring a board where nothing could have happened.'),
];

let fails = 0;
const ok = (cond, label, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + label + (detail ? '\n          ' + detail : ''));
  if (!cond) fails++;
};

for (const x of ARMS) {
  console.log('\n' + '='.repeat(98));
  console.log('  ' + x.label + '   (' + x.verdict + (x.why ? ' — ' + x.why : '') + ')');
  console.log('  STOPPED: ' + x.stop + '   (turns played ' + x.turnsPlayed + ')');
  console.log('  ' + x.note);
  const n = Math.max(x.sd.length, x.me.length);
  console.log('    turn |         SHOWDOWN                     |         MEDICHAM');
  for (let i = 0; i < n; i++) {
    const s = x.sd[i], m = x.me[i];
    const f = t => t ? (t.shape.join(',') + '  [tolls ' + t.tolls + ']') : '(none)';
    console.log('    ' + String(s ? s.n : (m ? m.n : '?')).padEnd(5) + '| ' + f(s).padEnd(36) + '| ' + f(m));
  }
  const sTot = x.sd.reduce((a, t) => a + t.tolls, 0), mTot = x.me.reduce((a, t) => a + t.tolls, 0);
  if (x.label === 'no-ability') {
    ok(sTot === 0 && mTot === 0, 'no toll line on either engine', 'showdown ' + sTot + ', medicham ' + mTot);
    ok(x.sd.some(t => t.faint) && x.me.some(t => t.faint), 'the body still dies on both engines',
       'without this the defect arm proves nothing');
  } else {
    const killS = x.sd.findIndex(t => t.faint), killM = x.me.findIndex(t => t.faint);
    ok(killS >= 0 && killM >= 0, 'both engines killed the body', 'showdown turn idx ' + killS + ', medicham ' + killM);
    const pre = x.sd.slice(0, Math.max(0, killS));
    ok(pre.length > 0 && pre.every(t => t.tolls === 2 && t.count === 2),
       'THE SURVIVOR CONTROL — every pre-KO turn tolls TWICE on the authority',
       pre.map(t => t.tolls + '/' + t.count).join(' '));
    const kill = x.sd[killS];
    ok(!!kill && kill.count === 1 && kill.tolls === 1,
       'THE AUTHORITY: the killing volley lands ONE arrival and tolls ONCE',
       kill ? ('count ' + kill.count + ', tolls ' + kill.tolls + ', shape ' + kill.shape.join(',')) : 'no killing turn');
    for (let i = 0; i < Math.max(x.sd.length, x.me.length); i++) {
      const s = x.sd[i], m = x.me[i];
      if (!s || !m) continue;
      ok(s.tolls === m.tolls, 'turn ' + s.n + ': the two engines set the reactor off the same number of times',
         'showdown ' + s.tolls + ' (count ' + s.count + '), medicham ' + m.tolls + ' (count ' + m.count + ')');
    }
  }
}

console.log('\n' + (fails ? 'RED — ' + fails + ' assertion(s) failed' : 'GREEN — every assertion held'));
process.exit(fails ? 1 : 0);
