/* THE FULL-GAME DIFFERENTIAL — play the same game in both engines and find the FIRST turn they part.
 *
 *   SHOWDOWN_PATH=... node tests/test-game-diff.js            the scripted multi-turn games
 *   SHOWDOWN_PATH=... node tests/test-game-diff.js --pairs    the generated tag x tag interactions
 *   SHOWDOWN_PATH=... node tests/test-game-diff.js --all
 *
 * WHY IT EXISTS, and it is not "more of the same".
 * -----------------------------------------------
 * Will, 2026-08-04: *"yeah we def need interactions thats the whole point and multi turn things like
 * tailwind and trick room."*
 *
 * The two instruments this division already has are BOTH blind to that, and structurally rather than
 * by omission:
 *
 *   tests/test-mechanics.js  probes ONE mechanic in isolation. 176 tags individually verified says
 *                            nothing whatever about tag x tag, and most of what was found on
 *                            2026-08-04 lived in an interaction -- priority x blocker, contact x
 *                            reactor, weather x type.
 *   tests/test-engine-diff.js compares a SINGLE HIT through moveHit. Trick Room counting down,
 *                            Tailwind expiring on turn 4, a screen running out, an Encore ending, a
 *                            Perish Song reaching zero -- none of those is a damage number and the
 *                            harness cannot see one of them.
 *
 * Growing either does not fix the other. So this is a THIRD instrument and it answers a different
 * question: run the same scripted game in `medicham2-browser.js` and in the official pinned Showdown
 * engine, compare the whole state after EVERY turn, and report the FIRST turn they diverge.
 *
 * TWO INSTRUMENTS, NOT ONE, AND THE SPLIT IS DELIBERATE. A cross product of tags reaches an
 * INTERACTION (Fake Out into Armor Tail) and can never reach a SEQUENCE (Tailwind expiring while a
 * Choice lock still holds), because no pair generates a fourth turn. `--pairs` is the interaction
 * instrument and the scripted games are the sequence one. Neither substitutes for the other.
 *
 * THE FOUR TRAPS, and they are the design rather than edge cases
 * -------------------------------------------------------------
 * 1. BOTH ENGINES MAKE IDENTICAL CHOICES. Every game here is a fixed ACTION SCRIPT. Nothing is ever
 *    chosen by a policy on either side. If either engine picked for itself, every divergence would be
 *    two players playing differently and this file would report noise forever.
 *
 * 2. THE DICE DO NOT AGREE, SO NOTHING THE DICE CAN MOVE IS COMPARED. medicham2 rolls its own rng and
 *    Showdown rolls `battle.random`; pinning both to one sequence is not possible without rewriting
 *    one of them, because they consume rolls in different orders for different questions. So the
 *    comparison is restricted to a DICE-INDEPENDENT PROJECTION and the exclusions are listed in
 *    NOT_COMPARED below. In particular an HP AMOUNT is never compared -- only whether a body was hurt
 *    at all, which is a 0-versus-nonzero question the damage roll cannot flip. This is the decision
 *    most likely to produce a wall of false positives, and it is made here, before the comparator,
 *    rather than tuned afterwards.
 *
 * 3. ONLY THE FIRST DIVERGENCE IS A FINDING. Everything after it is downstream of it -- one real bug
 *    wearing forty hats, which is the same reason tests/test-engine-diff.js reports rows and not a
 *    rate. The comparison stops at the turn it first parts.
 *
 * 4. A COMPARATOR THAT FINDS NOTHING MUST FIRST PROVE IT CAN FIND SOMETHING. `--all` and the default
 *    run both execute injectedDivergenceProof() BEFORE anything else and REFUSE to report a clean
 *    result if it fails. A silent zero is a broken comparator, not a clean engine, and that is this
 *    project's signature failure.
 *
 * WHAT IT DOES NOT COMPARE is the honest half; see NOT_COMPARED.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — set SHOWDOWN_PATH');
  process.exit(2);
}
const CS = require(D('engine', 'champions_sim.js'));
const { Dex, Teams, Battle } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const tags = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- WHAT IS DELIBERATELY OUT OF SCOPE ---------------------------------------------------------
 *
 * Written as data rather than prose so it is printed on every run and cannot quietly grow. Each entry
 * is a thing the two engines could differ on that this file will NOT call a divergence, with why. */
const NOT_COMPARED = [
  ['hp amount', 'the damage roll differs between the engines by construction (trap 2). `hurt` is '
    + 'compared instead: a 0-versus-nonzero question no roll can flip.'],
  ['accuracy misses', 'a miss is a die. Scripts use moves that cannot miss; a script that used one '
    + 'that can would produce a divergence about luck.'],
  ['chance secondaries', 'same reason. A script must not contain a move whose secondary is a roll, '
    + 'and assertScriptIsDeterministic() below REFUSES to run one that does.'],
  ['crit', 'a die everywhere except the three alwaysCrit moves, and those only move an HP amount.'],
  ['a reactor whose effect is a ROLL', 'Static paralyses 30% of the time, Flame Body burns 30%, '
    + 'Cursed Body disables 30%. Those are dice on the ABILITY side and the first version of the pair '
    + 'generator did not filter them, so five pairs reported `status medi="" sd="par"` -- trap 2 '
    + 'broken through a door the move-side guard does not cover. generatePairs() now skips them.'],
  ['a pair where one engine KOs and the other does not', 'that is a DAMAGE MAGNITUDE question and '
    + 'tests/test-engine-diff.js owns it, row by row, against the same reference engine. Here it '
    + 'would be one damage disagreement wearing four hats -- species, hurt, ability and fainted all '
    + 'differ on a slot whose body was replaced -- which is trap 3 in miniature. Reported as '
    + 'KO-TIMING and COUNTED, never silently dropped.'],
  ['the `protect` volatile', 'both engines have it and they CLEAR it at different points in the '
    + 'turn -- Showdown at its residual, medicham2 at the top of the next turn. Comparing it would '
    + 'report a divergence on every Protect ever clicked, about bookkeeping rather than rules.'],
  ['Showdown-only volatiles', '`stall`, `lockedmove`, `futuremove`, `trapped`, `choicelock` and the '
    + 'rest have no representation in medicham2 at all. Only the volatiles in VOL_MAP are compared; '
    + 'the others are invisible in BOTH directions and that is stated rather than discovered.'],
  ['PP', 'medicham2 does not track it.'],
  ['stat VALUES', 'ALIGNED rather than excluded — alignStats() copies the medicham2 Champions SP '
    + 'block onto every Showdown body before turn 1. Left in this list because it is a control that '
    + 'has to hold: unaligned, the two engines disagree about SPEED ORDER and about who survives a '
    + 'hit, and both read as rule divergences. Stat STAGES are compared and are the part a rule can '
    + 'get wrong.'],
];

/* ---- THE COMPARABLE PROJECTION -----------------------------------------------------------------
 *
 * One shape, built from each engine, so the comparator itself knows nothing about either. */

/* The volatiles both engines can represent. medicham2 stores most of these as its own underscore
 * fields rather than in a volatiles bag, so the reader is per-name -- which is the point: a name that
 * is not in this table is not compared, in EITHER direction. */
const VOL_MAP = {
  taunt:            m => !!(m._vol && m._vol.taunt > 0),
  encore:           m => !!(m._vol && m._vol.encore > 0),
  disable:          m => !!(m._vol && m._vol.disable > 0),
  substitute:       m => m._sub > 0,
  leechseed:        m => !!m._seededBy,
  healblock:        m => m._healBlock > 0,
  throatchop:       m => m._noSound > 0,
  mustrecharge:     m => !!m._recharge,
  partiallytrapped: m => !!m._trap,
  perishsong:       m => m._perish != null,
  yawn:             m => m._yawn != null,
};
const BOOST_KEYS = [['atk', 'at'], ['def', 'df'], ['spa', 'sa'], ['spd', 'sd'], ['spe', 'sp']];

function projMedi(S) {
  const mon = m => m ? ({
    species: norm(m.name).replace(/mega.*$/, 'mega'),
    hurt: m.curHP < m.st.hp, fainted: !!m.fainted,
    status: m.status || '',
    boosts: Object.fromEntries(BOOST_KEYS.map(([sd, en]) => [sd, m.boosts[en] | 0])),
    vol: Object.keys(VOL_MAP).filter(k => VOL_MAP[k](m)).sort(),
    item: norm(m.item), ability: norm(m.ability),
    types: (m.types || []).slice().sort(),
  }) : null;
  const side = (act, bench, sf) => ({
    active: act.map(mon),
    /* LIVE bench bodies only. medicham2's refill DROPS a fainted body out of the bench array while
       Showdown keeps it in the party forever, so comparing the raw lists reports a divergence about
       bookkeeping on every KO. `fainted` on the active slots is still compared, which is the part a
       rule can get wrong. */
    benched: bench.filter(x => x && !x.fainted).map(x => norm(x.name)).sort(),
    reflect: sf.scrP | 0, lightscreen: sf.scrS | 0,
    hazards: Object.fromEntries(Object.entries(sf.hz || {}).map(([k, v]) => [k, v | 0])),
  });
  return {
    field: {
      weather: S.field.weather || '', weatherTurns: S.field.weatherT | 0,
      terrain: S.field.terrain || '', terrainTurns: S.field.terrainT | 0,
      trickroom: S.field.tr | 0, tailwindA: S.field.twA | 0, tailwindB: S.field.twB | 0,
    },
    A: side(S.actA, S.benchA, S.sfA),
    B: side(S.actB, S.benchB, S.sfB),
  };
}

/* Showdown's side conditions and pseudo-weathers count DOWN, exactly like medicham2's timers, so the
 * two are directly comparable once the vocabulary is translated. `weatherId`/`terrainId` are the
 * engine's own exported translators -- no second map is written here, which is the rule the weather
 * boundary was landed under. */
const SD_VOL = new Set(Object.keys(VOL_MAP));
function projShowdown(battle) {
  const mon = p => p ? ({
    species: norm(p.species.id).replace(/mega.*$/, 'mega'),
    hurt: p.hp < p.maxhp, fainted: !!p.fainted,
    status: p.status || '',
    boosts: Object.fromEntries(BOOST_KEYS.map(([sd]) => [sd, p.boosts[sd] | 0])),
    vol: Object.keys(p.volatiles).filter(v => SD_VOL.has(v)).sort(),
    item: norm(p.item), ability: norm(p.ability),
    types: p.getTypes().slice().sort(),
  }) : null;
  const dur = (o) => (o && o.duration) | 0;
  const side = s => ({
    active: s.active.map(mon),
    benched: s.pokemon.filter(p => !p.isActive && !p.fainted).map(p => norm(p.species.id)).sort(),
    /* MAX, NOT `||`. Showdown keeps Reflect, Light Screen and Aurora Veil as THREE independent side
     * conditions with three timers; medicham2 keeps two counters, `scrP` and `scrS`, one per damage
     * category. When a screen and an Aurora Veil are both up the two representations cannot be made
     * to agree field-for-field, and `||` picked the FIRST one that existed rather than the one that is
     * actually halving — so `lightscreen -> auroraveil` reported `medi=4 sd=2`, which is the harness
     * comparing Light Screen's remaining turns against Aurora Veil's. MAX is the quantity medicham2
     * models: how long a special-halving screen is up for. That medicham2 cannot represent two
     * overlapping screens with different expiries is a real modelling limit and is recorded in
     * docs/ENGINE.md rather than papered over here. */
    reflect: Math.max(dur(s.sideConditions.reflect), dur(s.sideConditions.auroraveil)),
    lightscreen: Math.max(dur(s.sideConditions.lightscreen), dur(s.sideConditions.auroraveil)),
    hazards: Object.fromEntries(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb']
      .filter(h => s.sideConditions[h])
      .map(h => [h, s.sideConditions[h].layers || 1])),
  });
  return {
    field: {
      weather: M.weatherId(battle.field.weather) || '', weatherTurns: dur(battle.field.weatherState),
      terrain: M.terrainId(battle.field.terrain) || '', terrainTurns: dur(battle.field.terrainState),
      trickroom: dur(battle.field.pseudoWeather.trickroom),
      tailwindA: dur(battle.p1.sideConditions.tailwind),
      tailwindB: dur(battle.p2.sideConditions.tailwind),
    },
    A: side(battle.p1),
    B: side(battle.p2),
  };
}

/* ---- THE COMPARATOR ---------------------------------------------------------------------------- */
/* ARRAYS ARE WALKED PER INDEX, not compared whole. The first version stringified an active-slot pair
 * and printed 600 characters of JSON for a one-field difference, which is a report nobody reads --
 * and the whole point of stopping at the FIRST divergence is that it should be legible. `vol` and
 * `types` are leaf arrays of strings and are still compared whole. */
function diffObj(a, b, prefix, out) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const A = Array.isArray(a) ? a : [], B = Array.isArray(b) ? b : [];
    if (A.every(x => typeof x !== 'object') && B.every(x => typeof x !== 'object')) {
      if (JSON.stringify(A) !== JSON.stringify(B)) out.push([prefix, JSON.stringify(A), JSON.stringify(B)]);
      return out;
    }
    for (let i = 0; i < Math.max(A.length, B.length); i++) diffObj(A[i], B[i], prefix + '[' + i + ']', out);
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffObj(a[k], b[k], prefix + '.' + k, out);
    return out;
  }
  if ((a === undefined ? null : a) !== (b === undefined ? null : b))
    out.push([prefix, JSON.stringify(a === undefined ? null : a), JSON.stringify(b === undefined ? null : b)]);
  return out;
}
const compare = (medi, sd) => diffObj(medi, sd, '', []);

/* ---- TEAM AND SCRIPT PLUMBING ------------------------------------------------------------------ */
const set = (species, moves, ability, item) => ({ species, moves, ability: ability || null, item: item || '' });

function sdTeam(sets) {
  return Teams.pack(sets.map(s => ({
    name: s.species, species: s.species, gender: 'N', level: 50,
    item: s.item || '', ability: s.ability || dex.species.get(s.species).abilities[0],
    moves: s.moves.slice(), nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  })));
}
function mediTeam(sets) {
  return sets.map(s => {
    const b = M.buildMon(norm(s.species).replace(/\s/g, ''), {});
    if (!b) throw new Error('no MC row for ' + s.species);
    b.moves = s.moves.map(norm);
    b.item = norm(s.item);
    b.ability = norm(s.ability || dex.species.get(s.species).abilities[0]);
    return b;
  });
}

/* WHICH MOVES NEED A TARGET, from the dex's own `target` field rather than a list here. */
const NEEDS_TARGET = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf']);
const needsTarget = id => NEEDS_TARGET.has(dex.moves.get(id).target);

/* TRAP 2, ENFORCED RATHER THAN REMEMBERED. A script containing a move that can miss or that carries a
 * chance secondary would make this file report luck. It refuses to run one. */
function assertScriptIsDeterministic(sets, name) {
  const bad = [];
  for (const s of sets) for (const mv of s.moves) {
    const m = dex.moves.get(mv);
    if (m.accuracy !== true && m.accuracy < 100) bad.push(m.name + ' (accuracy ' + m.accuracy + ')');
    for (const sec of (m.secondaries || [])) if (sec.chance != null && sec.chance < 100)
      bad.push(m.name + ' (secondary ' + sec.chance + '%)');
    if (m.multiaccuracy) bad.push(m.name + ' (per-hit accuracy)');
  }
  if (bad.length) throw new Error(name + ': script is not deterministic — ' + [...new Set(bad)].join(', '));
}

/* Play ONE scripted game in both engines, comparing after each turn. Returns the first divergence or
 * null. `script[i] = { a: [act, act], b: [act, act] }`, `act = {m:'moveid', t:0|1} | {sw: benchIndex}`. */
function runScript(name, setsA, setsB, script, opts) {
  opts = opts || {};
  assertScriptIsDeterministic([...setsA, ...setsB], name);

  const A = mediTeam(setsA), B = mediTeam(setsB);
  /* HP BOOST — opt-in, and it exists for one reason: a DAMAGE RATIO cannot be read off a body that
   * died. Showdown clamps the recorded HP loss at the target's max, so a control arm that overkills
   * reports exactly max and the reactor's halving reads as 1.0 -- the engine scored correct on a
   * number nobody measured. Inflating the HP pool changes no multiplier and no rule; it only stops the
   * measurement hitting the floor. alignStats() below copies these values onto the Showdown bodies, so
   * both engines get the same pool. */
  if (opts.hpBoost) for (const m of [...A, ...B]) { m.st.hp = Math.round(m.st.hp * opts.hpBoost); m.curHP = m.st.hp; }
  const S = M.battleInit(A, B, {});
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: sdTeam(setsA) });
  battle.setPlayer('p2', { name: 'B', team: sdTeam(setsB) });
  if (battle.requestState === 'teampreview') {
    const pick = 'team ' + setsA.map((_, i) => i + 1).join('');
    battle.choose('p1', pick); battle.choose('p2', pick);
  }
  /* CONTROL: ALIGN THE STAT BLOCKS, WHOLE TEAM, BEFORE TURN 1.
   *
   * medicham2 builds a Champions SP body; a Showdown set here is 0-EV neutral. Unaligned, the two
   * engines disagree about two things that are NOT rules and both of which read as rule divergences:
   * SPEED ORDER (who moves first, which decides whether an Encore has anything to repeat) and WHO
   * SURVIVES A HIT (a frail body dies to one Close Combat in one engine and lives in the other).
   * Both were observed: `encore -> disguise` reported a volatile difference that was Mimikyu being
   * faster in one engine, and `closecombat -> static` reported a species difference that was Pikachu
   * dying in one. Same class as CONTROL FIX 8 in tests/test-engine-diff.js, applied to the whole party
   * rather than the two leads because a switch brings a new body in. */
  const alignStats = () => {
    for (const [side, team] of [[battle.p1, A], [battle.p2, B]]) {
      for (const p of side.pokemon) {
        const m = team.find(x => norm(x.name) === norm(p.species.id));
        if (!m) continue;
        p.storedStats.atk = m.st.at; p.storedStats.def = m.st.df;
        p.storedStats.spa = m.st.sa; p.storedStats.spd = m.st.sd; p.storedStats.spe = m.st.sp;
        p.baseStoredStats.atk = m.st.at; p.baseStoredStats.def = m.st.df;
        p.baseStoredStats.spa = m.st.sa; p.baseStoredStats.spd = m.st.sd; p.baseStoredStats.spe = m.st.sp;
        const full = p.hp === p.maxhp;
        p.maxhp = m.st.hp; p.baseMaxhp = m.st.hp; if (full) p.hp = m.st.hp;
      }
    }
  };
  alignStats();
  /* The rng is pinned to the MIDDLE of every range on the medicham2 side. It cannot make the two
   * engines agree (trap 2) — it only stops medicham2 itself being non-reproducible between the real
   * run and the injected-divergence run. */
  const rng = () => 0.5;
  /* PIN SHOWDOWN'S DICE TOO — opt-in, because the interaction matrix runs the SAME case TWICE (with
   * the reactor and with an inert control) and subtracts one from the other. A seeded PRNG is
   * reproducible run-to-run and NOT arm-to-arm: swapping an ability changes how many rolls the turn
   * consumes, so the two arms drift apart on the PRNG stream and a crit lands in one of them. That
   * would put a x1.5 in a ratio and read as an engine bug.
   *
   * `battle.random` is NOT enough and that is the trap: Battle.randomChance delegates to `this.prng`
   * directly, so an override on the Battle object leaves every chance event still rolling. Both are
   * pinned on the prng itself. `num >= den` is the deterministic reading of a chance: a 100%-accurate
   * move HITS (accuracy is checked as randomChance(accuracy, 100)), a 1-in-24 crit does NOT happen,
   * and a 30% secondary does not either. Returning a flat false instead would make every move MISS. */
  if (opts.pinDice && battle.prng) {
    battle.prng.random = (m, n) => (n === undefined ? (m === undefined ? 0.5 : Math.floor(m / 2)) : m + Math.floor((n - m) / 2));
    battle.prng.randomChance = (num, den) => num >= den;
  }

  for (let t = 0; t < script.length; t++) {
    const step = script[t];
    /* --- medicham2 --- */
    const mk = (side, acts) => {
      const own = side === 'A' ? S.actA : S.actB, foes = side === 'A' ? S.actB : S.actA;
      const bench = side === 'A' ? S.benchA : S.benchB;
      const m = new Map();
      own.forEach((mon, i) => {
        if (!mon) return;
        const act = acts[i];
        if (!act) { m.set(mon, { kind: 'pass' }); return; }
        /* TRAP 1 -- A SWITCH NAMES A SPECIES, NOT A BENCH INDEX. The first version indexed each
           engine's own bench array, and the two are not in the same order: medicham2 PUSHES the
           outgoing body onto the bench, so one switch reorders it, while Showdown keeps party order.
           The engines then brought in different Pokemon and every later turn was a divergence about
           the harness rather than about the rules -- trap 1 broken by the harness itself. */
        if (act.sw) {
          const want = bench.find(x => x && norm(x.name) === norm(act.sw) && !x.fainted);
          if (!want) throw new Error(name + ': no benched ' + act.sw + ' on side ' + side);
          m.set(mon, { kind: 'switch', to: want }); return;
        }
        m.set(mon, M.playerAction(mon, act.m, act.t != null ? foes[act.t] : null, S.field));
      });
      return m;
    };
    const mapA = mk('A', step.a), mapB = mk('B', step.b);
    M.battleTurn(S, rng, mapA, mapB);
    if (opts.inject) opts.inject(t, S);

    /* --- Showdown --- */
    const choice = (side, acts) => {
      const s = side === 'A' ? battle.p1 : battle.p2;
      return s.active.map((p, i) => {
        const act = acts[i];
        if (!p || p.fainted) return 'pass';
        if (!act) return 'move 1';
        if (act.sw) {
          const j = s.pokemon.findIndex(q => !q.isActive && !q.fainted && norm(q.species.id) === norm(act.sw));
          if (j < 0) throw new Error(name + ': no benched ' + act.sw + ' on side ' + side);
          return 'switch ' + (j + 1);
        }
        const n = p.set.moves.findIndex(mv => norm(mv) === norm(act.m));
        if (n < 0) throw new Error(name + ': ' + p.name + ' has no move ' + act.m);
        /* AN ALLY TARGET IS NEGATIVE IN SHOWDOWN and a foe target is positive. Emitting `2` for
           "my partner" produced an ILLEGAL choice, `battle.choose` returned false, the turn never
           advanced on the Showdown side, and eight pairs then reported `hurt medi=true sd=false` --
           a wall of divergences about the harness silently not playing the turn. Trap 1 broken by the
           harness, and invisible until the choice was asserted. */
        const loc = act.ally != null ? -(act.ally + 1) : (act.t != null ? act.t + 1 : null);
        return 'move ' + (n + 1) + (needsTarget(norm(act.m)) && loc != null ? ' ' + loc : '');
      }).join(', ');
    };
    /* A REJECTED CHOICE IS A HARNESS BUG AND MUST BE LOUD. `battle.choose` returns false and leaves
       the battle exactly where it was, so a silent one turns the reference engine into a frozen
       snapshot that disagrees with everything. */
    const cA = choice('A', step.a), cB = choice('B', step.b);
    if (!battle.choose('p1', cA)) throw new Error(name + ' turn ' + (t + 1) + ': p1 choice rejected — "'
      + cA + '"  (' + (battle.p1.choice.error || 'no reason given') + ')');
    if (!battle.choose('p2', cB)) throw new Error(name + ' turn ' + (t + 1) + ': p2 choice rejected — "'
      + cB + '"  (' + (battle.p2.choice.error || 'no reason given') + ')');
    /* A forced switch (a faint, or a phazing move) puts Showdown back in `switch` state; medicham2
     * refills automatically with live(bench)[0], so the same rule is applied here. */
    let guard = 0;
    while (battle.requestState === 'switch' && guard++ < 8) {
      for (const sd of ['p1', 'p2']) {
        const s = sd === 'p1' ? battle.p1 : battle.p2;
        if (!s.activeRequest || !s.activeRequest.forceSwitch) continue;
        const picks = s.activeRequest.forceSwitch.map(need => {
          if (!need) return 'pass';
          const j = s.pokemon.findIndex(q => !q.isActive && !q.fainted);
          return j >= 0 ? 'switch ' + (j + 1) : 'pass';
        });
        battle.choose(sd, picks.join(', '));
      }
    }

    const pm = projMedi(S), ps = projShowdown(battle);
    /* THE MATRIX NEEDS BOTH ARMS' STATE EVEN WHEN THEY PART, because its question is not "did they
     * agree" but "did the mechanic fire AT ALL" -- and that is answered by comparing an arm against
     * its own control, not against the other engine. So the projections are collected before the
     * early return rather than after it. Raw HP goes with them: the state projection deliberately
     * carries only `hurt` (trap 2), and the DAMAGE layer needs a number. */
    if (opts.collect) opts.collect.push({ turn: t + 1, medi: pm, sd: ps,
      mediHp: [...S.actA, ...S.actB].map(m => (m ? m.curHP / m.st.hp : null)),
      sdHp: [...battle.p1.active, ...battle.p2.active].map(p => (p ? p.hp / p.maxhp : null)) });
    const d = compare(pm, ps);
    if (d.length) return { turn: t + 1, diffs: d };
    if (battle.ended || M.battleOver(S)) break;
  }
  return null;
}

/* ---- THE SCRIPTED GAMES ------------------------------------------------------------------------
 *
 * Deliberately few and deliberately about SEQUENCE. Each one runs long enough for the counter it is
 * about to actually expire, because "it went up" is what the census already proves and "it came back
 * down on the right turn" is what nothing does. */
const GAMES = [];

/* Whimsicott is Prankster, so its Tailwind is +1 and resolves before anything -- that is itself an
 * interaction the single-hit differential cannot see. Six turns takes Tailwind past its expiry. */
GAMES.push({
  name: 'tailwind expires on the right turn',
  A: [set('Whimsicott', ['Tailwind', 'Protect'], 'Prankster'), set('Archaludon', ['Protect', 'Body Press']),
      set('Incineroar', ['Protect']), set('Garchomp', ['Protect'])],
  B: [set('Milotic', ['Protect', 'Recover']), set('Corviknight', ['Protect']),
      set('Farigiraf', ['Protect']), set('Weavile', ['Protect'])],
  script: [
    { a: [{ m: 'tailwind' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    ...Array.from({ length: 5 }, () => ({ a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] })),
  ],
});

/* Trick Room TOGGLES: a second click ends it rather than refreshing it, which medicham2 models and
 * nothing has ever checked against the real engine. Seven turns covers set, toggle, and expiry. */
GAMES.push({
  name: 'trick room sets, toggles off, and expires',
  A: [set('Farigiraf', ['Trick Room', 'Protect']), set('Archaludon', ['Protect']),
      set('Incineroar', ['Protect']), set('Garchomp', ['Protect'])],
  B: [set('Milotic', ['Protect']), set('Corviknight', ['Protect']),
      set('Whimsicott', ['Trick Room', 'Protect'], 'Prankster'), set('Weavile', ['Protect'])],
  script: [
    { a: [{ m: 'trickroom' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    { a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    { a: [{ m: 'trickroom' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    { a: [{ m: 'trickroom' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    ...Array.from({ length: 4 }, () => ({ a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] })),
  ],
});

/* Weather and terrain together, both replaced mid-run, both taken past expiry. This is the pair of
 * vocabularies the two boundary fixes of 2026-08-04 landed for, and until now nothing compared either
 * counter against the real engine at all. */
GAMES.push({
  name: 'weather is replaced and terrain expires',
  /* THE TERRAIN SETTER IS A MOVE AND NOT AN ABILITY, and that is forced rather than chosen: not one
     of the 318 species in MC.mons carries Psychic Surge, Grassy Surge, Electric Surge or Misty Surge,
     so the ability route cannot be scripted in medicham2 at all. Alakazam learns Psychic Terrain. */
  A: [set('Torkoal', ['Sunny Day', 'Protect'], 'Drought'), set('Alakazam', ['Psychic Terrain', 'Protect']),
      set('Incineroar', ['Protect']), set('Garchomp', ['Protect'])],
  B: [set('Politoed', ['Rain Dance', 'Protect'], 'Water Absorb'), set('Milotic', ['Protect']),
      set('Corviknight', ['Protect']), set('Weavile', ['Protect'])],
  script: [
    { a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    { a: [{ m: 'sunnyday' }, { m: 'psychicterrain' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    { a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'raindance' }, { m: 'protect' }] },
    ...Array.from({ length: 5 }, () => ({ a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] })),
  ],
});

/* A switch-heavy game: the bench composition, entry abilities and the slot a body lands in are all
 * state the single-hit harness never touches. Incineroar's Intimidate fires on every entry. */
GAMES.push({
  name: 'switches, entry abilities and bench composition',
  A: [set('Whimsicott', ['Protect'], 'Prankster'), set('Archaludon', ['Protect']),
      set('Incineroar', ['Protect'], 'Intimidate'), set('Garchomp', ['Protect'])],
  B: [set('Milotic', ['Protect']), set('Corviknight', ['Protect']),
      set('Farigiraf', ['Protect']), set('Weavile', ['Protect'])],
  script: [
    { a: [{ sw: 'incineroar' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    { a: [{ m: 'protect' }, { sw: 'garchomp' }], b: [{ sw: 'farigiraf' }, { m: 'protect' }] },
    { a: [{ sw: 'whimsicott' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    { a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] },
  ],
});

/* Screens, and the hazard that outlives everything on the field. Stealth Rock's whole point is what
 * it does to the NEXT body in, which is a sequence and not a hit. */
GAMES.push({
  name: 'a screen expires and a hazard outlives it',
  A: [set('Archaludon', ['Reflect', 'Protect']), set('Whimsicott', ['Stealth Rock', 'Protect'], 'Prankster'),
      set('Incineroar', ['Protect']), set('Garchomp', ['Protect'])],
  B: [set('Milotic', ['Protect']), set('Corviknight', ['Protect']),
      set('Farigiraf', ['Protect']), set('Weavile', ['Protect'])],
  script: [
    { a: [{ m: 'reflect' }, { m: 'stealthrock' }], b: [{ m: 'protect' }, { m: 'protect' }] },
    ...Array.from({ length: 5 }, () => ({ a: [{ m: 'protect' }, { m: 'protect' }], b: [{ m: 'protect' }, { m: 'protect' }] })),
    { a: [{ m: 'protect' }, { m: 'protect' }], b: [{ sw: 'farigiraf' }, { m: 'protect' }] },
  ],
});

/* ---- TRAP 4 — PROVE THE COMPARATOR CAN FIND SOMETHING ------------------------------------------ */
function injectedDivergenceProof() {
  const g = GAMES[0];
  /* A clean run first, so the injection is the only difference. */
  const clean = runScript('PROOF/clean', g.A, g.B, g.script);
  /* Now corrupt the medicham2 side on turn 2 ONLY: one extra turn of Tailwind, which is exactly the
   * counter Will named and exactly the kind of thing no other instrument here can see. */
  const dirty = runScript('PROOF/injected', g.A, g.B, g.script, {
    inject: (t, S) => { if (t === 1) S.field.twA += 1; },
  });
  const caughtAtRightTurn = !!dirty && dirty.turn === 2
    && dirty.diffs.some(([p]) => p === '.field.tailwindA');
  return { clean, dirty, ok: caughtAtRightTurn };
}

/* ---- THE GENERATED PAIR MATRIX -----------------------------------------------------------------
 *
 * Will, 2026-08-04: *"the interactions should be pretty formulaic now that we have all the tags and
 * such."* The cross product IS the test list and generating it is a loop, not an act of imagination.
 *
 * AND THE EXPECTED OUTCOME IS NEVER AUTHORED. That is the half that makes it safe: the official engine
 * supplies the truth. Every one of the roughly twenty wrong probes this project has produced was a
 * case where a human wrote down what should happen.
 *
 * IT GENERATES OFF THE SPLIT LINKAGE INDEX, which is why PRIORITIES #44 had to land first:
 * `linkage[key].carrierMoves` are the moves that HAVE the property and `linkage[key].abilities` are
 * the things that REACT to it. Until 2026-08-04 both lived under one key called `moves`, and
 * generating off it would have produced a confident wrong matrix -- Fake Out listed as a reactor to
 * contact. */
function findSpeciesWith(abilityId) {
  for (const sp of dex.species.all()) {
    if (!sp.exists || sp.isNonstandard || sp.forme) continue;
    if (!Object.values(sp.abilities).some(a => norm(a) === abilityId)) continue;
    if (!M.buildMon(norm(sp.id), {})) continue;      // must exist in MC.mons too
    return sp.name;
  }
  return null;
}
/* A body that can legally hold the carrier move AND exists in both engines' tables. */
function findUserOf(moveId) {
  for (const sp of dex.species.all()) {
    if (!sp.exists || sp.isNonstandard || sp.forme) continue;
    if (!M.buildMon(norm(sp.id), {})) continue;
    const ls = dex.species.getLearnsetData(sp.id);
    if (ls && ls.learnset && ls.learnset[moveId]) return sp.name;
  }
  return null;
}

function generatePairs(limit) {
  const out = [];
  for (const [key, v] of Object.entries(tags.linkage)) {
    /* HOW WIDE. Every reactor ABILITY the key has, against the six most-clicked carrier moves. The
     * reactor MOVES (Spiky Shield's family, from the split) are NOT crossed here: a move that reacts
     * needs a two-sided script -- it must go up on the same turn the carrier comes in -- and that is a
     * SEQUENCE, which is the scripted games' half of this file rather than the matrix's. Stated so the
     * gap is a decision rather than an omission. */
    const reactors = [...v.abilities.map(x => ({ ...x, kind: 'ability' }))];
    if (!reactors.length || !v.carrierMoves.length) continue;
    for (const r of reactors) {
      const holder = findSpeciesWith(r.id);
      if (!holder) continue;
      /* TRAP 2 THROUGH THE OTHER DOOR. The move-side guard catches an accuracy roll and a chance
       * secondary; it says nothing about a reactor whose OWN effect is a roll. Static, Flame Body,
       * Effect Spore, Cute Charm and Cursed Body all fire on a percentage, and the first version of
       * this generator produced five pairs reading `status medi="" sd="par"` -- pure luck, reported
       * as an engine divergence. Skipped here rather than filtered out of the report, so the pair is
       * never run and never looks like a finding. */
      const rp = (tags.abilities[r.id] || {}).params || {};
      const chancey = ['punishesAttacker', 'poisonsOnMyContact', 'disablesAttacker']
        .some(t => rp[t] && (rp[t].chance != null || rp[t].p != null
                             || (Array.isArray(rp[t].inflicts) && rp[t].inflicts.length)));
      if (chancey) continue;
      for (const c of v.carrierMoves.slice(0, 6)) {
        const mv = dex.moves.get(c.id);
        /* THE CARRIER MUST AIM AT A FOE. Helping Hand is a `priorityMove` carrier and targets an
         * ALLY, so aiming it across the field produced an illegal Showdown choice and a throw. */
        if (!mv.exists || !NEEDS_TARGET.has(mv.target)
            || mv.target === 'adjacentAlly' || mv.target === 'adjacentAllyOrSelf') continue;
        if (mv.accuracy !== true && mv.accuracy < 100) continue;         // trap 2
        if ((mv.secondaries || []).some(s => s.chance != null && s.chance < 100)) continue;
        const user = findUserOf(c.id);
        if (!user) continue;
        out.push({ key, move: c.id, moveName: mv.name, user, reactor: r.id, holder, uses: c.uses });
      }
    }
  }
  out.sort((a, b) => b.uses - a.uses);
  return limit ? out.slice(0, limit) : out;
}

/* THE HOLDER MUST TAKE THE HIT, WHICH IS LESSON 5 IN A GENERATOR. The first version gave the reactor
 * `Protect` as its only move, so it blocked every single attack -- 30 pairs in which the interaction
 * being tested could not happen, and the two divergences it did report were both about a BLOCKED move
 * rather than about contact, sound or bullet. (They were real bugs and are fixed as WIRE 65, which is
 * the argument for this instrument and not against it.)
 *
 * So the holder is given the first move it legally learns from a preference list of things that do
 * NOT stop the incoming attack. Helping Hand is the ideal filler -- it targets the ally, deals
 * nothing, and its volatile is in neither engine's compared set -- but not everything learns it, so
 * the fallback chain is real and the chosen filler is REPORTED per pair. A pair that falls all the way
 * back to Protect is marked `blocked` and is a weaker test, stated rather than hidden. */
const FILLERS = ['Helping Hand', 'Bulk Up', 'Calm Mind', 'Iron Defense', 'Agility', 'Protect'];
function fillerFor(speciesName) {
  const ls = dex.species.getLearnsetData(dex.species.get(speciesName).id);
  for (const f of FILLERS) if (ls && ls.learnset && ls.learnset[norm(f)]) return f;
  return 'Protect';
}
function runPairs(pairs) {
  const rows = [];
  for (const p of pairs) {
    const filler = fillerFor(p.holder);
    const A = [set(p.user, [p.moveName, 'Protect']), set('Archaludon', ['Protect']),
               set('Incineroar', ['Protect']), set('Garchomp', ['Protect'])];
    const B = [set(p.holder, [filler, 'Protect'], dex.abilities.get(p.reactor).name),
               set('Milotic', ['Protect']), set('Corviknight', ['Protect']), set('Weavile', ['Protect'])];
    /* Helping Hand targets the ALLY, so it is aimed at slot 1; everything else on the list is
       self-targeting and takes no target at all. */
    const bAct = norm(filler) === 'helpinghand' ? { m: 'helpinghand', ally: 1 } : { m: norm(filler) };
    let d = null, err = null;
    try {
      d = runScript(p.key + '/' + p.move + '->' + p.reactor, A, B,
        [{ a: [{ m: norm(p.moveName), t: 0 }, { m: 'protect' }], b: [bAct, { m: 'protect' }] }]);
    } catch (e) { err = e.message.slice(0, 110); }
    /* A FAINT DISAGREEMENT IS DOWNSTREAM OF THE STAT SPREAD, which NOT_COMPARED already excludes.
       Separated from a real divergence rather than counted as one -- and counted rather than dropped,
       because a silent exclusion is how a harness starts flattering the engine. */
    /* A KO THE TWO ENGINES TIME DIFFERENTLY IS A DAMAGE QUESTION, AND DAMAGE IS THE OTHER HARNESS'S
       JOB. tests/test-engine-diff.js compares damage numbers against Showdown row by row and reports a
       residual; this file compares STATE. When one engine kills a body and the other does not, every
       later field on that slot differs -- species, hurt, ability -- and it is one damage disagreement
       wearing four hats, which is trap 3 in miniature.
       DETECTED ON `species` AS WELL AS `fainted`, because a body that faints is REPLACED and the slot
       then holds a different Pokemon, so `fainted` never appears in the diff at all. That is why the
       first version of this filter missed `bitterblade -> sharpness`.
       Counted and named rather than dropped: a silent exclusion is how a harness starts flattering
       the engine it is checking. */
    const koTiming = !!d && d.diffs.some(([path]) => /\.active\[\d+\]\.(fainted|species)$/.test(path))
      && dex.moves.get(norm(p.moveName)).category !== 'Status';
    rows.push({ ...p, filler, blocked: filler === 'Protect', statSpread: koTiming,
      diverged: !!d && !koTiming, err, first: d && d.diffs.slice(0, 3) });
  }
  return rows;
}

/* ---- EXPORTED SO THE MATRIX RUNNER DOES NOT WRITE A SECOND PROJECTION --------------------------
 *
 * tests/test-interaction-matrix.js plays generated cases and needs exactly this comparator, this
 * dice-independent projection and this NOT_COMPARED list. A copy of any of them would be two harnesses
 * disagreeing about what "the same state" means, which is the CLAUDE.md rule one layer up from the
 * engine. The report below is guarded on `require.main` so requiring this file runs nothing. */
module.exports = { runScript, projMedi, projShowdown, compare, set, mediTeam, sdTeam, dex,
  needsTarget, NOT_COMPARED, VOL_MAP, fillerFor, FILLERS, norm };

if (require.main !== module) return;

/* ---- REPORT ------------------------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const doPairs = argv.includes('--pairs') || argv.includes('--all');
const doGames = !argv.includes('--pairs') || argv.includes('--all');

console.log('FULL-GAME DIFFERENTIAL — medicham2 against the official pinned Showdown engine\n');
console.log('  NOT COMPARED, deliberately:');
for (const [what, why] of NOT_COMPARED) console.log('    - ' + what.padEnd(24) + why);
console.log('');

/* TRAP 4 FIRST, ALWAYS. */
const proof = injectedDivergenceProof();
console.log('  INJECTED-DIVERGENCE PROOF (trap 4):');
console.log('    clean run of "' + GAMES[0].name + '": '
  + (proof.clean ? 'diverged at turn ' + proof.clean.turn : 'no divergence'));
console.log('    same run with ONE extra turn of Tailwind injected on turn 2: '
  + (proof.dirty ? 'caught at turn ' + proof.dirty.turn + ' — ' + proof.dirty.diffs.map(d => d[0]).join(' ')
                 : 'NOT CAUGHT'));
console.log('    comparator ' + (proof.ok ? 'CAN find a planted divergence, at the turn it happened'
  : 'FAILED ITS OWN PROOF — every result below is worthless'));
console.log('');

const artifact = { generated: new Date().toISOString(), by: 'tests/test-game-diff.js',
  showdown_commit: CS.PINNED_COMMIT, not_compared: NOT_COMPARED.map(x => x[0]),
  injected_divergence_proof: proof.ok, games: [], pairs: null };

if (doGames) {
  console.log('  SCRIPTED GAMES — the FIRST turn each one parts (trap 3):');
  for (const g of GAMES) {
    let r = null, err = null;
    try { r = runScript(g.name, g.A, g.B, g.script); }
    catch (e) { err = e.message; }
    const line = err ? 'THREW: ' + err.slice(0, 120)
      : r ? 'turn ' + r.turn + '  ' + r.diffs.slice(0, 4).map(d => d[0] + ' medi=' + d[1] + ' sd=' + d[2]).join('  |  ')
          : 'AGREES for all ' + g.script.length + ' turns';
    console.log('    ' + (r || err ? 'DIVERGES' : 'ok      ') + '  ' + g.name.padEnd(46) + line);
    artifact.games.push({ name: g.name, turns: g.script.length, threw: err || null,
      first_divergence: r ? { turn: r.turn, diffs: r.diffs } : null });
  }
  console.log('');
}

if (doPairs) {
  const pairs = generatePairs(+((argv.find(a => a.startsWith('--n=')) || '--n=40').slice(4)));
  console.log('  GENERATED PAIRS — printed BEFORE they are run, per docs/LESSONS.md 4:');
  for (const p of pairs) console.log('    ' + p.key.padEnd(13) + p.move.padEnd(16) + '(' + String(p.uses).padStart(6)
    + ' uses, ' + p.user + ')  x  ' + p.reactor.padEnd(16) + '(' + p.holder + ')');
  console.log('    ' + pairs.length + ' pairs generated from the SPLIT linkage index\n');
  const rows = runPairs(pairs);
  const bad = rows.filter(r => r.diverged || r.err);
  const blocked = rows.filter(r => r.blocked).length;
  const spread = rows.filter(r => r.statSpread).length;
  console.log('  PAIRS THAT PART:   (' + (rows.length - blocked) + ' of ' + rows.length
    + ' staged so the reactor actually TAKES the hit; ' + blocked
    + ' fell back to Protect and only test a blocked move — see fillerFor; '
    + spread + ' excluded as KO-TIMING, a DAMAGE disagreement that belongs to tests/test-engine-diff.js)');
  if (!bad.length) console.log('    none of ' + rows.length);
  for (const r of bad) console.log('    ' + (r.err ? 'THREW  ' : 'DIVERGE') + '  ' + r.key + ' ' + r.move
    + ' -> ' + r.reactor + '  ' + (r.err || r.first.map(d => d[0] + ' medi=' + d[1] + ' sd=' + d[2]).join('  |  ')));
  artifact.pairs = rows.map(r => ({ key: r.key, move: r.move, user: r.user, reactor: r.reactor,
    holder: r.holder, uses: r.uses, filler: r.filler, reactor_took_the_hit: !r.blocked,
    stat_spread: r.statSpread, diverged: r.diverged, threw: r.err || null, first: r.first || null }));
  console.log('');
}

fs.writeFileSync(D('data', 'game-diff.json'), JSON.stringify(artifact, null, 2) + '\n');
console.log('  wrote data/game-diff.json');

/* A FAILED PROOF IS THE ONLY THING THAT MAKES THIS FILE EXIT NON-ZERO. A divergence is a FINDING and
 * is reported, exactly like the census reports a MISSING mechanic -- a file that went red and got
 * ignored would be worthless. A broken comparator is not a finding; it is the instrument lying. */
if (!proof.ok) {
  console.log('\n  FAILED: the comparator could not find a divergence that was planted in it.');
  process.exitCode = 1;
}
