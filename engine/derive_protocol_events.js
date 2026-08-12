/* derive_protocol_events.js — WHAT SHOWDOWN CAN EMIT, READ OUT OF SHOWDOWN. ROADMAP #68, step one.
 *
 *   SHOWDOWN_PATH=... node engine/derive_protocol_events.js            check
 *   SHOWDOWN_PATH=... node engine/derive_protocol_events.js --write    regenerate data/protocol-events.json
 *
 * WHY IT EXISTS
 * -------------
 * docs/GAME-DIFFERENTIAL-DESIGN.md §5 asks MEDICHAM to emit Showdown's protocol so the two engines
 * can be diffed line for line. The instruction that came with it was *"DERIVE THE EVENT LIST, DO NOT
 * TYPE IT"*, and the reason is not tidiness: a hand-typed list of protocol events is the ban list
 * this project already replaced with a mechanism (CLAUDE.md), and it goes stale the same way.
 *
 * AND THE GENERIC PROTOCOL IS NOT THE AUTHORITY -- THE FORMAT IS. Measured while this file was being
 * written: `sim/battle-actions.ts:1800` emits `add('-supereffective', target)`, two fields, and
 * `data/mods/champions/scripts.ts:271` OVERRIDES it with `add('-supereffective', target,
 * Math.min(typeMod, 2))`, three. A trace built from `sim/SIM-PROTOCOL.md` alone would have emitted
 * the wrong shape on every super-effective hit in this format and the differ would have reported it
 * as a divergence forever. So the scan covers `sim/` AND `data/mods/champions/`, and the mod's
 * arities WIN where the two disagree.
 *
 * WHAT IT PRODUCES
 * ----------------
 * `data/protocol-events.json`:
 *   events[]        every event name Showdown can emit, with the arities seen at its call sites,
 *                   how many sites, and whether the champions mod overrides it
 *   emitted[]       the names medicham2 claims (its own TRACE_EVENTS)
 *   notEmitted[]    every remaining name WITH A WRITTEN REASON -- the declared list §5 asks for
 *   partial[]       names medicham2 emits in a SHAPE that is knowably not Showdown's, with the reason
 *
 * TWO GATES, and both are the point rather than decoration:
 *   INVENTED   a name in TRACE_EVENTS that Showdown never emits. An approximated event is a false
 *              agreement; the differ would align two streams on a line only one of them can produce.
 *   UNDECLARED a Showdown event that medicham2 neither emits nor gives a reason for. That is the
 *              silent gap -- the differ sees a missing line and cannot tell "this engine does not
 *              model it" from "this engine got it wrong".
 */
'use strict';
require('./showdown_path.js');
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

if (!process.env.SHOWDOWN_PATH) { console.error('NOT RUN — set SHOWDOWN_PATH'); process.exit(2); }
const SP = process.env.SHOWDOWN_PATH;

/* ---- THE SCAN ---------------------------------------------------------------------------------
 * Every `add('name', ...)` / `addMove('name', ...)` in the simulator core and in this format's mod.
 * The arity is counted by splitting the argument list at top level -- good enough to record the
 * SHAPE, and it is recorded rather than asserted, because a template literal or a spread makes an
 * exact count meaningless and a wrong number in an artifact is worse than a range. */
const CORE = ['battle.ts', 'battle-actions.ts', 'pokemon.ts', 'side.ts', 'field.ts', 'battle-queue.ts'];
const MOD_DIR = path.join(SP, 'data', 'mods', 'champions');
const DATA = ['moves.ts', 'abilities.ts', 'items.ts', 'conditions.ts', 'scripts.ts'];

function topSplit(argstr) {
  const out = []; let depth = 0, cur = '', q = null;
  for (let i = 0; i < argstr.length; i++) {
    const c = argstr[i];
    if (q) { if (c === q && argstr[i - 1] !== '\\') q = null; cur += c; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* The call must be found with its whole argument list, so a regex on one line is not enough --
 * several of Showdown's add() calls wrap. Scan forward from `add(` and balance the parentheses. */
function scanFile(file, into, tag) {
  /* A FILE THAT CANNOT BE READ IS THE WHOLE DERIVATION SILENTLY SHRINKING. Skipping it quietly would
   * make every event that only lives in that file read as UNDECLARED-but-absent, i.e. the gate below
   * would pass because the authority got smaller. So it is fatal, loudly, naming the file. */
  let src;
  try { src = fs.readFileSync(file, 'utf8'); }
  catch (e) {
    console.error('CANNOT READ ' + file + ' — the derivation would silently lose every event that '
      + 'only appears there, and both gates would then pass on a smaller authority.\n  ' + e.message);
    process.exit(2);
  }
  const re = /\b(?:add|addMove)\(\s*(['"])(-?[a-z][a-zA-Z0-9]*)\1/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[2];
    const open = src.lastIndexOf('(', m.index + m[0].length);
    let depth = 0, end = -1;
    for (let i = open; i < src.length && i < open + 4000; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) continue;
    const args = topSplit(src.slice(open + 1, end));
    const rec = into[name] || (into[name] = { name, sites: 0, arities: [], where: [] });
    rec.sites++;
    if (!rec.arities.includes(args.length)) rec.arities.push(args.length);
    const w = tag + ':' + path.basename(file);
    if (!rec.where.includes(w)) rec.where.push(w);
    if (tag === 'mod') rec.champions = true;
  }
}

const events = {};
for (const f of CORE) scanFile(path.join(SP, 'sim', f), events, 'sim');
for (const f of DATA) scanFile(path.join(SP, 'data', f), events, 'data');
for (const f of DATA) scanFile(path.join(MOD_DIR, f), events, 'mod');

/* `|turn|`, `|upkeep|`, `|faint|` and the battle-start furniture are pushed rather than added in a
 * couple of places; SIM-PROTOCOL.md is the second source and is UNIONED in, never used alone. */
const PROTO_MD = path.join(SP, 'sim', 'SIM-PROTOCOL.md');
try {
  const md = fs.readFileSync(PROTO_MD, 'utf8');
  for (const line of md.split('\n')) {
    const m = /^`\|(-?[a-z][a-zA-Z0-9]*)\|?/.exec(line.trim());
    if (!m) continue;
    const rec = events[m[1]] || (events[m[1]] = { name: m[1], sites: 0, arities: [], where: [] });
    if (!rec.where.includes('SIM-PROTOCOL.md')) rec.where.push('SIM-PROTOCOL.md');
    rec.documented = true;
  }
} catch (e) { console.error('SIM-PROTOCOL.md unreadable: ' + e.message); process.exit(2); }

/* ---- WHAT MEDICHAM CLAIMS ---------------------------------------------------------------------- */
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const CLAIM = M.TRACE_EVENTS.slice();

/* ---- THE DECLARED LIST ------------------------------------------------------------------------
 * Every Showdown event medicham2 does NOT emit, with the reason. §5's rule: *"where MEDICHAM
 * genuinely cannot produce an event, record it in a declared list with the reason rather than
 * emitting an approximation."* A reason is a fact about this engine, never "not done yet". */
const NOT_EMITTED = {
  /* ---- battle furniture: this engine is a rules engine, not a server ---- */
  player: 'no players. medicham2 is handed two teams of built bodies and knows no user, avatar or rating.',
  teamsize: 'no team preview. battleInit is handed the four that are already on the field plus a bench.',
  gametype: 'always doubles; the constant is not a decision this engine makes.',
  gen: 'not modelled — there is one generation.',
  tier: 'the format id lives in data/regulations.json, not in the simulator.',
  rated: 'no ladder.', rule: 'no rulesets; legality is the caller\'s problem.',
  clearpoke: 'no team preview.', poke: 'no team preview.', teampreview: 'no team preview.',
  start: 'battleInit IS the start; there is no separate protocol frame for it.',
  request: 'no choice request loop — the caller hands actions in.',
  inactive: 'no timer.', inactiveoff: 'no timer.',
  win: 'battleResult() returns 1/0/0.5 and no side has a NAME to print.',
  tie: 'as `win`.', t: 'no wall clock.', init: 'no room.', title: 'no room.',
  split: 'no hidden information — a caller holds both teams, so there is no secret/shared pair to split.',
  message: 'no chat.', debug: 'no debug channel.', error: 'failures are counted in MEDFAILS, not logged.',
  uhtml: 'client furniture.', uhtmlchange: 'client furniture.', html: 'client furniture.',
  chat: 'client furniture.', c: 'client furniture.', j: 'client furniture.', l: 'client furniture.',
  n: 'client furniture.', b: 'client furniture.', join: 'client furniture.', leave: 'client furniture.',
  name: 'client furniture.', popup: 'client furniture.', pm: 'client furniture.',
  usercount: 'client furniture.', nametaken: 'client furniture.', challstr: 'client furniture.',
  updateuser: 'client furniture.', formats: 'client furniture.', updatesearch: 'client furniture.',
  updatechallenges: 'client furniture.', queryresponse: 'client furniture.',
  tournament: 'client furniture.', notify: 'client furniture.', users: 'client furniture.',
  askreg: 'client furniture.', expire: 'client furniture.', unlink: 'client furniture.',
  formatslist: 'client furniture.', deinit: 'client furniture.', noinit: 'client furniture.',
  refresh: 'client furniture.', selectorhtml: 'client furniture.', queryresponsetype: 'client furniture.',

  /* ---- mechanics medicham2 does not model AT ALL ---- */
  '-terastallize': 'Terastal is not in Champions Reg M-B and this engine has no tera state.',
  '-zpower': 'Z-moves do not exist in this format.',
  /* ROADMAP #155, 2026-08-11 -- THE REASON WAS WRONG, AND ONLY THE REASON. `-zbroken` said "Z-moves
   * do not exist in this format", which is true about Z-moves and false about this line: the champions
   * mod emits `-zbroken` on the TARGET every time `bypassProtect` is set, and `piercesProtect`
   * (Piercing Drill, Unseen Fist) sets it on contact moves in ordinary play. Observed live:
   *     |-ability|p1a: A|Unseen Fist  |-zbroken|p2a: B  |-damage|p2a: B|164/183
   * It stays UNCLAIMED — this engine models the pierce and the quarter and announces the `-ability`
   * half, which is the line the comparison reads; `-zbroken` is a leftover Z-move display artefact
   * that carries no state. A declaration whose reason has quietly become false is the thing this
   * table exists to stop, so the reason is corrected rather than left standing. */
  '-zbroken': 'a Z-move display leftover the champions mod re-uses for a pierced Protect. This engine '
            + 'models the pierce (WIRE 158) and announces the `-ability` line beside it; this line '
            + 'carries no state and is not emitted.',
  '-burst': 'Ultra Burst does not exist in this format.',
  '-primal': 'Primal Reversion does not exist in this format.',
  /* `-mega` and `detailschange` MOVED OUT OF THIS LIST, 2026-08-07 (ROADMAP #31). They used to read
   * "mega evolution happens in buildMon/oneMegaPerSide BEFORE battleInit, so there is no in-battle
   * event to emit" -- an honest declaration of a real modelling limit, and the limit is gone:
   * megaEvolveNow() performs the evolution inside the turn and emits both lines in Showdown's own
   * order. They are in TRACE_EVENTS now, so leaving them here would double-count. */
  '-transform': 'Imposter/Transform is not modelled; `formeChange` carriers are listed unconsumed.',
  /* ROADMAP #151, 2026-08-11 -- `-formechange` HAS A CARRIER NOW AND ITS REASON IS DELETED RATHER
   * THAN REWORDED. What it said was true and is worth keeping once: "the only other forme change this
   * engine models is Zero to Hero, which rewrites the body silently in bringIn(). Mega evolution is a
   * PERMANENT forme change and emits `detailschange` ... `-formechange` is the non-permanent shape
   * and has no carrier here." Stance Change is that carrier. It calls `formeChange()` with no
   * `isPermanent`, so the authority takes the else branch and writes the non-permanent line, and this
   * engine now writes the same one -- including its empty fourth field, which is what Showdown's
   * undefined `message` argument reaches the log as. Zero to Hero is still silent and is still an
   * announcement this engine owes; it is a different tag with a different trigger. */
  replace: 'Illusion is not modelled (ROADMAP #67), so nothing is ever revealed.',
  swap: 'Ally Switch is not modelled.',
  '-swapsideconditions': 'Court Change is not modelled.',
  /* WIRE 151, 2026-08-10 -- THESE THREE REASONS WERE "X IS NOT MODELLED" AND THAT IS NO LONGER TRUE.
   * Topsy-Turvy, Psych Up, Guard Swap and Power Swap all resolve now (statChangeInCode.op), and the
   * STATE they produce is correct and probed. What is still absent is the ANNOUNCEMENT, and the reason
   * is a real one rather than an oversight: all four use `setBoost` or a raw `boosts[i] =` assignment,
   * neither of which produces a `-boost`/`-unboost` line, so there is no per-stat delta for the
   * existing emitter to carry and the authority's own one-line event would have to be claimed in
   * TRACE_EVENTS -- where tests/test-protocol-trace.js requires every claimed event to FIRE in its
   * scripted games. Emitting without claiming would trip that file's unclaimed-event check instead.
   * Acupressure is the family member that DOES announce, because it alone calls `this.boost(...)`;
   * it emits `-boost` through the ordinary emitter and is not listed here.
   * The reason is corrected rather than left standing, because a stale "not modelled" is exactly the
   * shape of the two evasion comments this same wire had to retract. */
  '-invertboost': 'Topsy-Turvy IS modelled as of WIRE 151 and its stage inversion is probed; the '
    + 'raw `boosts[i] = -boosts[i]` assignment emits no line in this engine, and `-invertboost` is '
    + 'not claimed in TRACE_EVENTS. The STATE is right and the ANNOUNCEMENT is owed.',
  '-copyboost': 'Psych Up IS modelled as of WIRE 151 and its whole-vector copy is probed; '
    + '`source.boosts[i] = target.boosts[i]` emits no line in this engine, and `-copyboost` is not '
    + 'claimed in TRACE_EVENTS. The STATE is right and the ANNOUNCEMENT is owed.',
  '-swapboost': 'Guard Swap and Power Swap ARE modelled as of WIRE 151 and their stat-pair exchange '
    + 'is probed; `setBoost` emits no line in this engine, and `-swapboost` is not claimed in '
    + 'TRACE_EVENTS. Heart Swap is isNonstandard Past and unplayable here. The STATE is right and the '
    + 'ANNOUNCEMENT is owed.',
  '-setboost': 'no move in this engine SETS a stage; Belly Drum adds +12 half-stages through '
    + 'statChangeInCode and is emitted as `-boost`, which is what Showdown\'s gen-9 bellydrum does too.',
  '-clearpositiveboost': 'Spectral Thief is not modelled.',
  '-cureteam': 'Heal Bell / Aromatherapy are not modelled.',
  /* '-sethp' HAS MOVED INTO TRACE_EVENTS AND ITS REASON IS DELETED RATHER THAN EDITED, 2026-08-12.
   * It read "Pain Split is not modelled." and the move HAS been modelled since ROADMAP #139 -- the
   * averaging was measured identical in both engines. Only the vocabulary was wrong: medicham2 emitted
   * two `-damage` lines where the authority emits two `-sethp`, one of them `[silent]`. A declared
   * not-emitted reason that has stopped being true is the same failure as a stale handoff -- it reads
   * as a measurement -- so the entry goes rather than gets reworded. */
  '-endability': 'ability SUPPRESSION (Gastro Acid, Neutralizing Gas) is not modelled; Mummy and '
    + 'Wandering Spirit REWRITE the ability and emit `-ability` instead, which is what Showdown does.',
  /* ROADMAP #151, 2026-08-11 -- `-hitcount` HAS MOVED INTO TRACE_EVENTS AND ITS REASON IS DELETED
   * RATHER THAN REWORDED. The reason it gave was correct at the time and is worth recording once:
   * "multi-hit damage is ONE packet for most of the family in this engine (WIRE 20, declared) and the
   * HP still moves once, so emitting a count beside a single `-damage` line would be an invented
   * number." That premise is gone -- the volley IS a sequence of arrivals now, each with its own
   * `|-damage|`, so the count is READ off how many landed rather than invented. Dragon Darts still
   * emits none, and for the authority's own reason rather than ours:
   * `if (move.multihit && typeof move.smartTarget !== 'boolean')` skips every smartTarget move
   * (data/mods/champions/scripts.ts:547), which the battle loop asks before it emits. */
  '-anim': 'animation only; carries no rule. WIRE 147 -- Dragon Darts writes one at its SECOND dart '
    + '(`addMove(\'-anim\', pokemon, move.name, target)`, battle-actions.ts:906); the darts really do '
    + 'split across two bodies here now, but the line is animation and carries no rule.',
  '-combine': 'no combined moves.', '-center': 'no triples.',
  '-waiting': 'no move that waits on a partner is modelled.',
  '-notarget': 'gen 5+ emits `-fail` instead (sim/battle-actions.ts:456), which this engine does emit.',
  '-block': 'the blockers this engine models announce themselves as `-immune` or `-activate`; nothing '
    + 'in it reaches Showdown\'s `-block` path (Aroma Veil, Dynamax, Crafty Shield).',
  '-hint': 'client hint text; carries no rule.',
  '-nothing': 'removed from the protocol in gen 5.',
  '-singlemove': 'Destiny Bond / Grudge are not modelled.',
  '-fieldactivate': 'EMITTED for Perish Song only — see partial[].',
  '-ohko': 'no OHKO move is in this format.',
  '-fieldstart': 'EMITTED — see emitted[].',
  upkeep: 'EMITTED — see emitted[].',
  '-candynamax': 'Dynamax does not exist in this format.',
  '-clearboost': 'Clear Smog and Haze are the two carriers; Haze wipes BOTH sides and emits '
    + '`-clearallboost`, which this engine does emit. Clear Smog is not in this engine\'s move set '
    + 'as a boost-wiper — it resolves as an ordinary attack — so emitting a per-body clear would '
    + 'claim a mechanic that is not wired.',
  '-message': 'flavour text; carries no rule.',
  bigerror: 'server-side error channel.',
  showteam: 'open team sheets are an INPUT to this engine (buildMonFromSet), never an output.',
};

/* Shapes medicham2 emits that are knowably NOT Showdown's, with the reason. Declared rather than
 * silently different, so the comparison driver can decide whether to score the row. */
const PARTIAL = [
  ['*', 'IDENTIFIERS AND NAMES ARE IDS, NOT DISPLAY NAMES. `p1a: incineroar` for `p1a: Incineroar`, '
    + '`fakeout` for `Fake Out`, `sunnyday` for `SunnyDay`. medicham2 has no display-name table and '
    + 'inventing one would be a translation layer that can itself be wrong. `M.traceCanon(line)` is '
    + 'the ONE normaliser and the comparison driver applies it to BOTH streams.'],
  ['switch', 'DETAILS carries species and level only (`incineroar, L50`). This engine tracks no '
    + 'gender and no shininess, and Level 50 is a constant of the format rather than a field.'],
  ['-supereffective', 'the third argument is this FORMAT\'s (data/mods/champions/scripts.ts:271, '
    + '`Math.min(typeMod, 2)`), derived here from the multiplier rather than from a stored typeMod.'],
  ['-resisted', 'as `-supereffective`.'],
  ['-sidestart', 'SIDE is emitted as `p1: ` — the id with an empty player name, because this engine '
    + 'has no players. traceCanon reduces Showdown\'s `p1: A` to `p1:a` and this to `p1:`; a driver '
    + 'comparing the side field must compare the id, which is the part that carries the rule.'],
  ['-sideend', 'as `-sidestart`, and additionally: this engine keeps TWO screen counters keyed by '
    + 'damage category where Showdown keeps three named side conditions, so an Aurora Veil ends as '
    + 'both `Reflect` and `Light Screen`. A representation limit already recorded in docs/ENGINE.md.'],
  ['-damage', 'ORDER WITHIN A HIT DIFFERS. medicham2 resolves the knock-off, the resist berry and the '
    + 'contact punish BEFORE subtracting the target\'s HP, so `-enditem` and the Rough Skin `-damage` '
    + 'precede the target\'s `-damage`; Showdown subtracts first. No state differs at end of turn, '
    + 'which is exactly why tests/test-game-diff.js cannot see it and this trace can.'],
  ['-heal', 'the pinch berries (Sitrus) fire in the END-OF-TURN residual here and on the `onUpdate` '
    + 'immediately after the hit in Showdown. Same turn, different position in the stream.'],
  ['move', 'a SPREAD move emits no `[spread] ...` attribute: the target list is resolved after the '
    + 'move line is written, and this engine rolls accuracy ONCE for a spread move rather than per '
    + 'target (MEDSEEN.accSpreadNoDefender), so a per-target attribute would not be true anyway.'],
  ['-crit', 'a spread move\'s per-target effectiveness and crit lines INTERLEAVE with its damage '
    + 'lines here; Showdown batches all of them ahead of the damages (trySpreadMoveHit).'],
];

/* ---- THE TWO GATES ----------------------------------------------------------------------------- */
const names = Object.keys(events).sort();
const known = new Set(names);
const invented = CLAIM.filter(n => !known.has(n));
const undeclared = names.filter(n => !CLAIM.includes(n) && !(n in NOT_EMITTED));

/* WHAT THIS ARTIFACT WAS DERIVED FROM, BY CONTENT. engine/provenance.js compares CONTENT rather than
 * mtimes -- a file that is merely newer than its input proves nothing, and an unstamped artifact is
 * counted in a ratchet that may not grow. The digests cover the two things a stale row could come
 * from: this derivation, and medicham2's TRACE_EVENTS claim. The Showdown checkout is named rather
 * than hashed -- it is 40,000 files at a pinned commit, and the commit id is the honest handle. */
const SOURCES = ['engine/derive_protocol_events.js', 'engine/medicham2-browser.js'];
const sha12 = require('./engine_release.js').sha12;

const out = {
  generated: new Date().toISOString().slice(0, 19).replace('T', ' '),
  source: 'engine/derive_protocol_events.js',
  source_digests: SOURCES.reduce((o, f) => (o[f] = sha12(D(f)), o), {}),
  showdown_pinned_commit: require(D('engine', 'champions_sim.js')).PINNED_COMMIT || null,
  derivedFrom: {
    showdown: SP,
    scanned: [...CORE.map(f => 'sim/' + f), ...DATA.map(f => 'data/' + f),
      ...DATA.map(f => 'data/mods/champions/' + f), 'sim/SIM-PROTOCOL.md'],
    note: 'the champions mod OVERRIDES two of the core emits (-supereffective, -resisted); its arity wins.',
  },
  showdownEvents: names.length,
  /* THE COUNTS ARE PUBLISHED, NOT LEFT TO BE COUNTED. Every figure a living document quotes about
   * this artifact has to be IN it -- tests/test-docs-current.js check 3b(b) asserts exactly that, and
   * a prose "36 emitted" beside an artifact that only carries the array is a figure nobody can check
   * without recounting. Derived from the arrays in the same expression, so they cannot drift. */
  emittedCount: CLAIM.length,
  emitted: CLAIM.slice().sort(),
  notEmittedCount: Object.keys(NOT_EMITTED).filter(n => known.has(n)).length,
  notEmitted: Object.keys(NOT_EMITTED).filter(n => known.has(n)).sort()
    .map(n => ({ event: n, reason: NOT_EMITTED[n] })),
  partialCount: PARTIAL.length,
  partial: PARTIAL.map(([e, r]) => ({ event: e, reason: r })),
  events: names.map(n => ({
    name: n, sites: events[n].sites, arities: events[n].arities.sort((a, b) => a - b),
    where: events[n].where, champions: !!events[n].champions,
    medicham: CLAIM.includes(n) ? 'emitted' : (n in NOT_EMITTED ? 'declared' : 'UNDECLARED'),
  })),
  gates: { invented, undeclared },
};

const dest = D('data', 'protocol-events.json');
if (process.argv.includes('--write')) {
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log('wrote ' + dest);
}

console.log('SHOWDOWN PROTOCOL EVENTS  ' + names.length + ' distinct, from '
  + out.derivedFrom.scanned.length + ' files');
console.log('  medicham2 emits   ' + CLAIM.length);
console.log('  declared, with a reason  ' + out.notEmitted.length);
console.log('  partial shapes, with a reason  ' + PARTIAL.length);
let bad = 0;
if (invented.length) {
  bad = 1;
  console.log('\nINVENTED — in TRACE_EVENTS and Showdown never emits it:');
  for (const n of invented) console.log('    |' + n + '|');
}
if (undeclared.length) {
  bad = 1;
  console.log('\nUNDECLARED — Showdown emits it, medicham2 neither emits it nor says why:');
  for (const n of undeclared) console.log('    |' + n + '|   ' + events[n].where.join(' '));
}
if (!bad) console.log('\nBOTH GATES PASS.');
process.exit(bad);
