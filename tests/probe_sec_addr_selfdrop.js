/* probe_sec_addr_selfdrop.js — WHERE A SECONDARY ROLL IS ADDRESSED, AND WHO GETS ONE. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_sec_addr_selfdrop.js
 *   SHOWDOWN_PATH=... node tests/probe_sec_addr_selfdrop.js --team-store <dir>
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * Three of the 34 board partings in the held-out 12,000-game draw on release `18773c22878f`
 * (`docs/_reports/2026-09-19-final-remeasure.md` §4 rows 7, 18 and 31) are one line each:
 *
 *     |cant|p2b: Scovillain|flinch   against   |move|p2b: Scovillain|Overheat|...|[miss]
 *     |cant|p1b: Kingambit|flinch    against   |move|p1b: Kingambit|Iron Head|p2b: Garchomp
 *     |cant|p2b|flinch               against   |move|p2b|strengthsap
 *
 * NONE OF THEM IS A FLINCH RULE. In every one the two engines drew the King's Rock 10% from DIFFERENT
 * ADDRESSES, so they were reading two independent hashed numbers and one of them came up under 10.
 * Two separate causes, one family:
 *
 *   A  A MOVE WITH A `self:` BLOCK. The authority's step 4 (`selfDrops`) calls
 *      `moveHit(source, source, ...)`, and the `activeTarget` restore sits BELOW step 5
 *      (sim/battle-actions.ts:1093-1101) — so every secondary of that move is addressed to the USER.
 *      This engine kept the last body of the spread.
 *   B  A BODY THE HIT KILLED. `BattleActions#secondaries` skips only `target === false` (:1339) and a
 *      corpse is not that, so the authority DRAWS for it; a passing draw calls `moveHit(target, ...)`
 *      (:1348) and moves the address onto the corpse for every later secondary of the move. This
 *      engine skipped the draw entirely and its own header claimed the skip "cannot reach a board".
 *      The flinch is refused on a corpse either way (`addVolatile`, sim/pokemon.ts:1980) — the ADDRESS
 *      MOVE is what reaches a board, and that sentence is retracted at the site.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 *   1  AUTHORITY  King's Rock still pushes `{chance:10, volatileStatus:'flinch'}` onto a non-Status
 *                 move, read off the format on this run rather than typed.
 *   2  FIXTURE    each named game is in the PINNED pool at its own swarm size. A game that cannot be
 *                 staged is a FAILURE of this file, never a statement about the mechanic.
 *   3  ADDRESSES  the two engines' `sec` address strings for the game are IDENTICAL, in order. This
 *                 is the direct claim; the board below is its consequence.
 *   4a BOARD      no board leaf parts at ANY boundary of the whole game.
 *   4b PROTOCOL   the protocol parts nowhere, OR parts only on an `|-ability|` announcement that one
 *                 engine wrote and the other did not — the class 6.72.0 measured and WITHHELD.
 *   5  COUNTERS   both wires FIRED (`secAddrFromSelfDrop`, `kingsRockFlinchRefusedOnCorpse`), the
 *                 skip counter is at zero, and both restore knobs are OFF in this process.
 *   6  RED        the parent re-runs itself under each knob and both children must FAIL.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 *
 * ================= WHY CLAIM 4 IS TWO ARMS, 2026-09-19 (RE-AIMED, NOT RELAXED) ===================
 *
 * IT WAS ONE ARM — "neither the protocol nor the board parts anywhere in the game" — and on the
 * merged tree it went RED on the `omit-weather` fixture with THE MECHANIC GREEN BESIDE IT:
 *
 *     replay: turns=9 protocol_div=26 board_div=null boundaries=10/10
 *     protocol split: sd |-ability|p1a: Blaziken|Speed Boost|boost
 *                     me |-boost|p1a: Blaziken|spe|1|[from] ability: speedboost
 *
 * THE ENGINE DID NOT MOVE AND NEITHER DID THE GAME. 9 turns and 10/10 boundaries, the same course
 * this game ran when the fix landed; the 4 `sec` draws of t1 are still byte-identical; the wires
 * still fire (+4 / +1); each knob still turns its own half red. **THE COMPARATOR MOVED.** Commit
 * `221ab64a` (6.72.0) RETIRED `game_differential.js`'s `ability-announcement` equivalence, which had
 * deleted every `|-ability|` line from BOTH streams since `f60b01c7`. Those lines are compared now,
 * so a narration gap this file never used to be able to see — the authority announcing before an
 * ability-sourced boost, 198 of the 250 newly-visible games, Speed Boost 48 of them — is the FIRST
 * protocol divergence of this game, three lines after where the flinch split used to be.
 *
 * So the single arm had stopped being a statement about the secondary address: it was asserting the
 * whole-game narration zero, which 6.72.0 withdrew on purpose. Split, not deleted:
 *
 *   4a is the arm the knob answers to, and it reads the WHOLE game. `stateDiv` is computed at every
 *      boundary independently of where the protocol first parted — measured under
 *      MEDI_SEC_ADDR_IGNORES_SELFDROP=1 on this same fixture: protocol 23, BOARD 1, boundaries 9/10,
 *      `p2.pp[1].overheat` 0/1. An announcement ahead of a board parting cannot hide it.
 *   4b keeps the protocol under assertion instead of dropping it. A surviving divergence must be an
 *      `|-ability|` INSERTION — exactly one side wrote the line — and neither raw line may mention
 *      a flinch. A flinch split, a board-material split, or any other narration class is a FAILURE
 *      of this file, and the `|-ability|` audit delta is printed beside the verdict so the excusal
 *      is NAMED rather than asserted (its sign and key, not its size — see the note at the call).
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('THE SECONDARY ADDRESS');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

const ARGV0 = process.argv.slice(2);          /* what the CALLER passed, before this file adds pins */
const tsIdx = process.argv.indexOf('--team-store');
const POOL = tsIdx > 0 ? process.argv[tsIdx + 1] : D('data', 'team-pool-frozen');
if (tsIdx < 0) process.argv.push('--team-store', POOL);
process.argv.push('--steering', 'empirical', '--state', '--end-state', '--turns', '50');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '1200');

const G = require(D('engine', 'game_differential.js'));
/* THE ENGINE THE DRIVER ACTUALLY PLAYED, not a second load of the same path — see
 * tests/probe_stall_uncaused.js for why a plain require here reads counters that stay at zero. */
const MEDI = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const KNOB_SELFDROP = process.env.MEDI_SEC_ADDR_IGNORES_SELFDROP === '1';
const KNOB_DEAD = process.env.MEDI_KINGSROCK_SKIPS_DEAD === '1';
const CHILD = KNOB_SELFDROP || KNOB_DEAD;
const C0 = { self: MEDI.MEDSEEN.secAddrFromSelfDrop, corpse: MEDI.MEDSEEN.kingsRockFlinchRefusedOnCorpse,
             rolls: MEDI.MEDSEEN.kingsRockRolls, skipped: MEDI.MEDSEEN.kingsRockRollSkippedOnKO };
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n== WHERE A SECONDARY ROLL IS ADDRESSED =='
  + (CHILD ? '   [' + (KNOB_SELFDROP ? 'MEDI_SEC_ADDR_IGNORES_SELFDROP=1 ' : '')
           + (KNOB_DEAD ? 'MEDI_KINGSROCK_SKIPS_DEAD=1' : '') + ']' : '') + '\n');
console.log('  release ' + G.REL.id + '   pool ' + POOL);

/* ---- 1 — THE AUTHORITY, RE-DERIVED ----------------------------------------------------------- */
{
  const kr = dex.items.get('kingsrock');
  const pushed = [];
  const fake = { category: 'Special', secondaries: null };
  try { kr.onModifyMove.call({}, fake); } catch (e) { pushed.push('THREW: ' + ((e && e.message) || e)); }
  console.log('  kingsrock.onModifyMove on a Special move with no secondaries -> '
    + JSON.stringify(fake.secondaries) + (pushed.length ? '  ' + pushed.join('; ') : ''));
  ok(!!fake.secondaries && fake.secondaries.length === 1
     && fake.secondaries[0].chance === 10 && fake.secondaries[0].volatileStatus === 'flinch',
     'King\'s Rock still pushes ONE 10% flinch secondary onto a non-Status move',
     'read off the format on this run (data/items.ts:3213-3223; no Champions override)');
}

/* ---- 2..4 — THE GAMES ------------------------------------------------------------------------ */
/* `--games` is part of the SAMPLE DEFINITION and not a budget: `buildSwarm` is sized from it, so a
 * different number is a different pool and therefore a different pairing. Each fixture names its own. */
const WANT = [
  { half: 'A  a `self:` move — Make It Rain out of a King\'s Rock Gholdengo',
    cfg: 'omit-weather', arm: 'middle', games: 12000, turn: 1,
    tag: 'gen9championsvgc2026regmbbo3-2657252654 vs gen9championsvgc2026regmbbo3-2657249003',
    was: '|cant|p2b: Scovillain|flinch  against  |move|p2b: Scovillain|Overheat|...|[miss]' },
  { half: 'B  a KO\'d body — Earthquake out of a King\'s Rock Garchomp, two of its three targets die',
    cfg: 'omit-intimidate', arm: 'middle', games: 12000, turn: 5,
    tag: 'gen9championsvgc2026regmbbo3-2660280251 vs gen9championsvgc2026regmbbo3-2660473779',
    was: '|cant|p1b: Kingambit|flinch  against  |move|p1b: Kingambit|Iron Head|p2b: Garchomp' },
  { half: 'B  the same half on a second lattice road',
    cfg: 'pair-speedctrl', arm: 'middle', games: 12000, turn: 10,
    tag: 'gen9championsvgc2026regmbbo3-2658356295 vs gen9championsvgc2026regmbbo3-2658352967',
    was: '|cant|p2b|flinch  against  |move|p2b|strengthsap' },
];

const SWARMS = new Map();
const swarmAt = (n) => {
  if (!SWARMS.has(n)) {
    const t0 = Date.now();
    const sw = SWARM.buildSwarm(n * 2, { storeDir: POOL });
    console.log('  pool at --games ' + n + ' built in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — '
      + sw.out.reduce((a, c) => a + c.picked, 0) + ' teams picked from ' + sw.teams.length);
    SWARMS.set(n, sw);
  }
  return SWARMS.get(n);
};
/* THE `sec` DRAWS OF ONE TURN. Scoped to the turn the artifact named, for two reasons that are not
 * convenience: the address is `seed|turn|cat|move|target|nth`, so the turn is a field of it and not a
 * filter over it; and under hashing a draw only ONE side asks for is expected and harmless (it takes
 * its own address and shifts nothing), which is exactly what `midGameVoid` judges — the question is
 * whether the events BOTH engines asked about got the same identity. The whole-game claim is the
 * OUTCOME arm below, which reads every turn. */
const secOn = (list, turn) => list.filter(s => new RegExp('\\|' + turn + '\\|sec\\|').test(String(s)));

for (const W of WANT) {
  const SW = swarmAt(W.games);
  const c = SW.out.find(x => x.config === W.cfg);
  const [ida, idb] = W.tag.split(' vs ');
  const ta = c && c.picked_teams.find(t => t.id === ida);
  const tb = c && c.picked_teams.find(t => t.id === idb);
  if (!ta || !tb) {
    ok(false, W.cfg + ' t' + W.turn + ': the pair is in the PINNED pool at --games ' + W.games,
       'a=' + !!ta + ' b=' + !!tb + ' — a FIXTURE fault, never a claim about the mechanic');
    continue;
  }
  const a = G.buildPair(ta.team), b = G.buildPair(tb.team);
  if (!a || !b) { ok(false, W.cfg + ' t' + W.turn + ': both sides build', 'buildPair refused'); continue; }
  const arm = G.ARM_BY_ID.get(W.arm);
  if (!arm) { ok(false, W.cfg + ': the arm "' + W.arm + '" exists'); continue; }

  /* THE TWO LOGS HAVE DIFFERENT LIFETIMES AND THAT IS NOT SYMMETRICAL. `MID_CTX_ALL.sd` accumulates
   * across the whole process (capped), while the medicham side is `M.midEventLog()`, whose `MID_LOG`
   * is CLEARED by `midEventDice` at every game install. So the authority's log is sliced from a mark
   * and this engine's is taken whole. Reading both the same way is how a comparison here goes quietly
   * wrong — it did, on the first run of this file. */
  const n0sd = G.midAddresses().sd.length;
  /* THE `|-ability|` AUDIT IS CUMULATIVE ACROSS THE PROCESS (`ABIL_FORMS` in game_differential.js),
   * so the asymmetry of ONE replay is a DELTA of `gap` (= authority minus ours) taken around it. It
   * is what sizes 4b's excusal; a rule that drops a line class without counting it is the exact hole
   * 6.72.0 found.
   * IT IS AN UPPER BOUND AND NOT A PER-GAME LINE COUNT. `alignAndCheck` runs at the leads, at every
   * turn and at the tail (:4867, :5163, :5204), each time over the WHOLE stream so far, and it audits
   * on each pass — so a single emitted line is counted once per remaining pass. Reading it as "the
   * authority wrote N more lines in this game" would be wrong by a factor of the turn count. What it
   * is good for is the SIGN and the KEY: which body+ability the surviving asymmetry belongs to, and
   * which side is missing it. */
  const auditKey = (x) => x.body + '|' + x.ability + '|' + x.tail;
  const gap0 = new Map(G.abilityAuditRows().map(x => [auditKey(x), x.gap]));
  const r = G.playGame(a, b, W.cfg, W.tag, { arm });
  const abilGaps = G.abilityAuditRows()
    .map(x => ({ k: auditKey(x), d: x.gap - (gap0.get(auditKey(x)) || 0) }))
    .filter(x => x.d !== 0);
  const after = G.midAddresses();
  const sd = secOn(after.sd.slice(n0sd), W.turn), me = secOn(after.me, W.turn);

  console.log('\n  ---- ' + W.half);
  console.log('       ' + W.cfg + '  arm ' + W.arm + '  --games ' + W.games + '  ' + W.tag);
  console.log('       the artifact\'s line: ' + W.was);
  console.log('       replay: turns=' + r.turns + ' protocol_div=' + (r.div ? r.div.index : null)
    + ' board_div=' + (r.stateDiv ? r.stateDiv.turn : null)
    + ' boundaries=' + r.boundariesAgreed + '/' + r.boundaries + ' err=' + (r.err || '-'));
  if (r.div) console.log('       protocol split: sd ' + r.div.sdRaw + '   me ' + r.div.meRaw);
  if (r.stateDiv) console.log('       board diffs: ' + JSON.stringify(r.stateDiv.diffs));

  /* THE DIRECT CLAIM. A set-shaped check would call two engines that spent each other's numbers a
   * match (that is the 2026-08-26 spread-secondary lesson), so this is order-sensitive and exact. */
  let first = -1;
  for (let i = 0; i < Math.max(sd.length, me.length); i++) { if (sd[i] !== me[i]) { first = i; break; } }
  ok(first < 0 && sd.length === me.length && sd.length > 0,
     W.cfg + ' t' + W.turn + ': every `sec` draw OF THAT TURN is addressed identically by the two engines',
     first < 0 && sd.length === me.length && sd.length > 0
       ? sd.length + ' `sec` draw(s), byte-identical in order'
       : 'sd ' + sd.length + ' draws, me ' + me.length + '; first disagreement at index '
         + (first < 0 ? Math.min(sd.length, me.length) : first) + ':\n          '
         + '  sd ' + JSON.stringify(sd.slice(Math.max(0, first), first + 4)) + '\n          '
         + '  me ' + JSON.stringify(me.slice(Math.max(0, first), first + 4)));
  /* 4a — THE BOARD, EVERY BOUNDARY. This is the arm the knob answers to; see the header. */
  ok(!r.stateDiv && r.boundaries > 1 && r.boundariesAgreed === r.boundaries,
     W.cfg + ' t' + W.turn + ': NO board leaf parts, at any boundary of the whole game',
     r.stateDiv ? 'board parts at t' + r.stateDiv.turn + ': ' + JSON.stringify(r.stateDiv.diffs)
                : r.boundariesAgreed + ' of ' + r.boundaries + ' boundaries identical, ' + r.turns + ' turns');

  /* 4b — THE PROTOCOL, AND WHAT IT IS ALLOWED TO BE. An `|-ability|` INSERTION: exactly one engine
   * wrote the line. Anything else — a flinch split, a move/cant split, any other narration class —
   * is a failure of this file. */
  const isAbil = (l) => /^\|-ability\|/.test(String(l || ''));
  const saysFlinch = (l) => /flinch/i.test(String(l || ''));
  const announceOnly = !!r.div && (isAbil(r.div.sdRaw) !== isAbil(r.div.meRaw))
    && !saysFlinch(r.div.sdRaw) && !saysFlinch(r.div.meRaw);
  ok(!r.div || announceOnly,
     W.cfg + ' t' + W.turn + ': the protocol parts nowhere, or only on an `|-ability|` announcement '
     + 'one engine wrote and the other did not',
     !r.div ? 'no protocol divergence at all'
       : (announceOnly ? 'DECLARED: the 6.72.0 announcement class, index ' + r.div.index + '\n          '
                         + '  sd ' + r.div.sdRaw + '\n          ' + '  me ' + r.div.meRaw
                       : 'NOT the announcement class — index ' + r.div.index + '\n          '
                         + '  sd ' + r.div.sdRaw + '\n          ' + '  me ' + r.div.meRaw)
         + '\n          ' + '  `|-ability|` audit delta around this replay, authority MINUS ours '
         + '(re-counted at every alignment pass — read the sign and the key, not the size): '
         + (abilGaps.length ? abilGaps.map(x => x.k + ' ' + (x.d > 0 ? '+' : '') + x.d).join(', ') : 'none'));
}

/* ---- 5 — THE COUNTERS ------------------------------------------------------------------------ */
{
  const S = MEDI.MEDSEEN, F = MEDI.MEDFAILS;
  const self = S.secAddrFromSelfDrop - C0.self, corpse = S.kingsRockFlinchRefusedOnCorpse - C0.corpse;
  const rolls = S.kingsRockRolls - C0.rolls, skipped = S.kingsRockRollSkippedOnKO - C0.skipped;
  console.log('\n  COUNTERS across the replays: secAddrFromSelfDrop +' + self
    + '  kingsRockFlinchRefusedOnCorpse +' + corpse + '  kingsRockRolls +' + rolls
    + '  kingsRockRollSkippedOnKO +' + skipped
    + '   restored=' + F.secAddrIgnoresSelfDropRestored + '/' + F.kingsRockSkipsDeadRestored);
  ok(self > 0 || KNOB_SELFDROP, 'HALF A FIRED — the address was put on the user by a `self:` block',
     'secAddrFromSelfDrop moved by ' + self + '. A zero with the arms above green would mean the '
     + 'boards agree for some other reason');
  ok(rolls > 0, 'CONTROL — King\'s Rock dice are still being taken at all',
     'kingsRockRolls moved by ' + rolls);
  ok(corpse > 0 || KNOB_DEAD, 'HALF B FIRED — a die on a corpse passed and moved the address',
     'kingsRockFlinchRefusedOnCorpse moved by ' + corpse);
  ok(KNOB_DEAD ? skipped > 0 : skipped === 0,
     'the KO skip is ' + (KNOB_DEAD ? 'restored in the child' : 'gone in this process'),
     'kingsRockRollSkippedOnKO moved by ' + skipped);
  ok(KNOB_SELFDROP ? F.secAddrIgnoresSelfDropRestored === 1 : F.secAddrIgnoresSelfDropRestored === 0,
     'the `self:` restore knob is ' + (KNOB_SELFDROP ? 'LIVE' : 'OFF') + ' — stamped at module LOAD',
     'secAddrIgnoresSelfDropRestored=' + F.secAddrIgnoresSelfDropRestored);
  ok(KNOB_DEAD ? F.kingsRockSkipsDeadRestored === 1 : F.kingsRockSkipsDeadRestored === 0,
     'the KO-skip restore knob is ' + (KNOB_DEAD ? 'LIVE' : 'OFF') + ' — stamped at module LOAD',
     'kingsRockSkipsDeadRestored=' + F.kingsRockSkipsDeadRestored);
}

/* ---- 6 — THE RED ----------------------------------------------------------------------------- */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const argv = ARGV0.filter((x, i, A) => x !== '--team-store' && A[i - 1] !== '--team-store');
  for (const knob of ['MEDI_SEC_ADDR_IGNORES_SELFDROP', 'MEDI_KINGSROCK_SKIPS_DEAD']) {
    console.log('\n  ---- RE-RUNNING UNDER ' + knob + '=1 (the child must FAIL)');
    const r = spawnSync(process.execPath, [__filename, '--team-store', POOL, ...argv],
      { env: Object.assign({}, process.env, { [knob]: '1' }), encoding: 'utf8' });
    const childFailed = r.status !== 0;
    const lines = String(r.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
    ok(childFailed, knob + '=1 makes this probe RED',
       childFailed ? 'child exit ' + r.status + ', ' + lines.length + ' FAIL line(s):\n          '
                     + lines.join('\n          ')
                   : 'THE CHILD PASSED — this probe cannot see that half and asserts nothing about it');
  }
}

console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'ALL ARMS PASS') + '\n');
process.exit(bad ? 1 : 0);
