/* fixture_preflight.js — CAN THIS SCENARIO HAPPEN AT ALL?
 *
 * Will, 2026-08-11: **"i for sure alreayd told you about those awkward ones last session bro i aint
 * doing this again"** — after correcting three fixtures in a row that could never have run:
 *
 *     "spore aint in the game but yes, sleep powder it for insomnia"
 *     "gliscor aint in the game"
 *     "jolteon cant be paralyzed we have to burn it or something"
 *
 * EVERY ONE OF THOSE WAS DERIVABLE AND NONE OF THEM WAS DERIVED. Spore passes
 * `exists && !isNonstandard && tier !== 'Illegal'` and **zero legal species can learn it**. Jolteon is
 * Electric, so paralysis cannot land whatever you click. Asking him a fourth time is not a fix; the
 * fix is that a scenario has to pass this before anyone spends a run on it.
 *
 * THE FAILURE MODE THIS CLOSES IS SPECIFIC AND THE REPO ALREADY HAS A NAME FOR IT.
 * `docs/LESSONS.md` §5 and the memory note "construct the fixture, don't find it": a COULD-NOT-STAGE
 * verdict is a claim about the FIXTURE, never about the mechanic. But the inverse is just as bad and
 * has no name yet — a fixture that LOOKS staged, runs, reads "identical", and was never capable of
 * showing anything. That is 80 INERT rows in the ability roster and it is why they are inert.
 *
 * WHAT IT REFUSES, and each clause exists because a real scenario died on it:
 *   1. species not legal in Reg M-B                       ("gliscor aint in the game")
 *   2. ability not on that species in this format          — a body cannot carry what it does not have
 *   3. move not learnable by that species                  ("spore aint in the game") — THE ONE THE
 *      STANDARD FILTER MISSES, because a move can be `isNonstandard: null` and have no legal learner
 *   4. target is IMMUNE to the status the move inflicts    ("jolteon cant be paralyzed")
 *   5. target is immune by TYPE to the move itself         — a Ground move into a Flying body
 *
 * IT DERIVES, IT DOES NOT REMEMBER. Every answer comes from `Dex.forFormat`, so it self-corrects when
 * the mod updates. There is no list of awkward cases in this file, deliberately — a hand-list is what
 * went stale in the first place.
 *
 * Reads the format. Writes nothing. */
'use strict';
const SD = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const { Dex } = require(SD + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');

const legal = (x) => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
const id = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* A MEGA FORME HAS NO LEARNSET OF ITS OWN — RESOLVE TO THE BASE FORME.
 *
 * Will caught this by opening the Showdown teambuilder and putting Double-Edge on a Feraligatr-Mega,
 * which it accepted, while this file was confidently reporting "Feraligatr-Mega cannot learn
 * Double-Edge". Measured after: `feraligatrmega` has **0** learnset entries and `feraligatr` has 82,
 * including `doubleedge`. The moves live on the base forme and the mega inherits them by evolving.
 *
 * This mattered more than one bad answer. A preflight that REFUSES a valid fixture is worse than no
 * preflight — it sends people away from scenarios that would have worked, silently, with an
 * authoritative-sounding reason. And it would have refused EVERY mega scenario, which is very
 * probably part of why four mega-only abilities sit at COULD-NOT-STAGE. */
function learnsetOf(sp) {
  if (!sp || !sp.exists) return {};
  const own = (D.species.getLearnsetData(sp.id) || {}).learnset || {};
  if (Object.keys(own).length) return own;
  const base = sp.baseSpecies && sp.baseSpecies !== sp.name ? D.species.get(sp.baseSpecies) : null;
  if (base && base.exists) return (D.species.getLearnsetData(base.id) || {}).learnset || {};
  return own;
}

/* Built once. A move is PLAYABLE only if something legal can learn it — see clause 3. */
let LEARNABLE = null;
function learnable() {
  if (LEARNABLE) return LEARNABLE;
  LEARNABLE = new Set();
  for (const sp of D.species.all()) {
    if (!legal(sp)) continue;
    for (const m of Object.keys(learnsetOf(sp))) LEARNABLE.add(m);
  }
  return LEARNABLE;
}

/* The status a move inflicts, if any — read off the move rather than named here. */
function statusOf(mv) {
  if (mv.status) return mv.status;
  const secs = mv.secondaries || (mv.secondary ? [mv.secondary] : []);
  for (const s of secs || []) if (s && s.status) return s.status;
  return null;
}

/* Status immunity, derived from typing and from the ability's own text. */
function immuneToStatus(sp, status, abilityId) {
  const t = sp.types || [];
  if (status === 'par' && t.includes('Electric')) return 'is Electric — paralysis cannot land';
  if (status === 'brn' && t.includes('Fire')) return 'is Fire — burn cannot land';
  if ((status === 'psn' || status === 'tox') && (t.includes('Poison') || t.includes('Steel')))
    return 'is ' + (t.includes('Poison') ? 'Poison' : 'Steel') + ' — poison cannot land';
  if (status === 'frz' && t.includes('Ice')) return 'is Ice — freeze cannot land';
  const ab = D.abilities.get(abilityId || '');
  if (ab && ab.exists) {
    const src = String(ab.onSetStatus || '') + String(ab.onTrySetStatus || '') + String(ab.onImmunity || '');
    if (src.includes("'" + status + "'") || src.includes('"' + status + '"'))
      return 'its own ability ' + ab.name + ' refuses ' + status;
  }
  return null;
}

/** check({species, ability, move, target, targetAbility}) -> {ok, why[]} */
/* ---- THE TRIGGER CLAUSES — WILL, 2026-08-12: "so fix the instrument" -----------------------------
 *
 * THE FIVE CLAUSES ABOVE ALL ASK "IS THIS LEGAL". NONE OF THEM ASKS "CAN THE TRIGGER FIRE", AND THAT
 * IS THE OTHER HALF OF THE SAME FAILURE.
 *
 * On 2026-08-12 the probe was wrong before the engine SIX TIMES, and three of those were a fixture
 * that was entirely legal and structurally incapable of firing its own trigger:
 *
 *   NATURAL CURE  A probe switched a burned carrier out and printed "THE MECHANIC IS DEAD — 114
 *                 corpus uses". `battleInit` SLICES ITS OWN BENCH at `teamA.slice(2)`, so the
 *                 two-body team had an EMPTY bench, the "bench" Pokemon was standing on the field as
 *                 the partner, and the switch silently did nothing. Every arm read identical, which
 *                 is exactly what a dead mechanic looks like.
 *   CUTE CHARM    0 fires in 4,166 trials against a declared 30%. Every fixture in the repo declared
 *                 `gender: 'N'` and the authority gates the mechanic on two real genders, so the
 *                 ability was correctly doing nothing. Filed as ABSENT until Will said to add gender.
 *   RIVALRY       Same cause. Its guard is `attacker.gender && defender.gender`, so a genderless
 *                 board is arm three of a three-arm probe — the arm where the answer is 1.0x.
 *
 * A LEGAL BOARD THAT CANNOT FIRE ITS TRIGGER IS INDISTINGUISHABLE FROM A DEAD MECHANIC. That is the
 * inverse the header above says has no name, and these clauses are the name.
 *
 * DERIVED FROM THE HANDLER, NEVER FROM A LIST. Each clause reads what the ability's own source
 * requires and asks whether the scenario supplies it. A hand-list of awkward cases is what went stale
 * in the first place — that is this file's opening argument and it applies to its own new clauses. */
/* AN ITEM IS A MECHANIC WITH HANDLERS TOO, AND THESE CLAUSES READ ONLY ABILITIES UNTIL 2026-08-12.
 * `onSwitchOut`, `.gender`, `.status` and a weather literal are properties of a HANDLER, not of the
 * kind of thing that carries it — Toxic Orb reads status, Snow Cloak's item-shaped siblings read
 * weather. Nothing about the derivation was ability-specific; the SOURCE it was pointed at was. So the
 * handler text is gathered from whatever the scenario declares and the clauses are unchanged. */
function handlerSrc(e) {
  return e && e.exists
    ? Object.entries(e).filter(([k, v]) => /^on/.test(k) && typeof v === 'function')
        .map(([, v]) => String(v)).join(' ')
    : '';
}
/* WHICH STATUS A HANDLER READS, read off the handler rather than named here. `pokemon.status === "par"`
 * is Cheri Berry's whole guard; Lum Berry's is `pokemon.status || pokemon.volatiles["confusion"]`, which
 * names none and takes any — reported as `any` rather than as an empty answer, because an empty answer
 * reads like "no status is involved" and that is the opposite of the truth.
 *
 * BOTH QUOTE STYLES, as everywhere in this file: the handler is read off the COMPILED `dist/sim`. */
const STATUS_IDS = /["'](brn|par|psn|tox|slp|frz)["']/;
function statusesFromSrc(src) {
  const out = new Set();
  for (const m of String(src).matchAll(/\.status\s*===\s*["'](brn|par|psn|tox|slp|frz)["']/g)) out.add(m[1]);
  if (!out.size && /\.status\b/.test(String(src))) out.add('any');
  return [...out];
}
/** statusesRead(entity) -> ['par'] | ['any'] | [] — for a caller that wants to STAGE the status rather
 *  than only be told one is missing. Reads the entity's own handlers, including a berry's `onEat`. */
function statusesRead(entity) {
  if (!entity || !entity.exists) return [];
  const src = handlerSrc(entity)
    + ' ' + (typeof entity.onEat === 'function' ? String(entity.onEat) : '');
  return statusesFromSrc(src);
}
void STATUS_IDS;
function triggerClauses(sc, sp, why, note, cl) {
  const ab = sc.ability ? D.abilities.get(sc.ability) : null;
  const itemE = sc.item ? D.items.get(sc.item) : null;
  /* The NAME the refusal is written against. `ab.name` alone threw on an item-only scenario. */
  const subj = (ab && ab.exists && ab.name) || (itemE && itemE.exists && itemE.name)
            || sc.ability || sc.item || 'the mechanic';
  const src = handlerSrc(ab) + ' ' + handlerSrc(itemE)
    /* A BERRY'S WHOLE MECHANISM IS ITS `onEat`, WHICH IS NOT AN `on`-PREFIXED FUNCTION ON THE ITEM in
     * the compiled dex the way the others are — it is, but its condition text lives beside it. Both are
     * gathered so a status-curing berry reads as status-gated. */
    + ' ' + (itemE && itemE.exists && typeof itemE.onEat === 'function' ? String(itemE.onEat) : '');

  /* 1. A SWITCH NEEDS A BENCH, and the engine's own slicing is the trap. */
  if (sc.switchesOut || /onSwitchOut/.test(src)) {
    const team = +sc.teamSize || 0;
    if (team && team < 3) {
      why.push('THE TRIGGER IS A SWITCH AND THIS TEAM HAS NO BENCH — `battleInit` slices its bench at '
        + '`teamA.slice(2)`, so a team of ' + team + ' puts every body on the field and the switch '
        + 'silently does nothing. Give it at least 3.');
      cl.push({ clause: 'switch-needs-bench', blocking: true, need: { teamSize: 3 }, got: { teamSize: team } });
    } else if (!team) {
      note.push('the trigger is a switch — the team needs 3+ bodies or `battleInit` leaves an empty '
        + 'bench and the switch is a no-op (declare `teamSize` and this becomes a refusal)');
      cl.push({ clause: 'switch-needs-bench', blocking: false, need: { teamSize: 3 }, got: { teamSize: null } });
    }
  }

  /* 2. A GENDER-GATED MECHANIC NEEDS TWO DECLARED GENDERS — AND THE GATE MAY BE ONE HOP DOWN.
   *
   * The first version of this clause tested `/\.gender/` against the ability's own handlers and let
   * CUTE CHARM straight through, which is the very case it was written for. Cute Charm does not read
   * gender: it calls `addVolatile('attract')`, and ATTRACT'S OWN CONDITION is what refuses a
   * genderless body. Rivalry reads `.gender` directly, so the naive test caught that one and created
   * exactly the false confidence this file exists to prevent — a guard that passes its own worked
   * example while missing its sibling.
   *
   * Found by running the clause RED on the three boards that actually fooled somebody, which is the
   * repo's rule and which is the only reason this is not shipping half-broken. So: follow the
   * volatile the handler applies and read ITS source too. Still derived, one hop deeper. */
  /* BOTH QUOTE STYLES. The handler is read off the COMPILED `dist/sim` and TypeScript rewrites
   * `'attract'` as `"attract"` — the SAME trap that made the refusal family come out EMPTY in
   * million_targets.js earlier today, repeated here within the hour. */
  const viaVolatile = [...src.matchAll(/addVolatile\(\s*['"]([a-z]+)['"]/g)].map(m => m[1]);
  let reach = src;
  for (const v of viaVolatile) {
    const cond = D.conditions.get(v);
    if (cond && cond.exists) {
      reach += ' ' + Object.entries(cond).filter(([k, f]) => /^on/.test(k) && typeof f === 'function')
        .map(([, f]) => String(f)).join(' ');
    }
  }
  if (/\.gender/.test(reach)) {
    const mine = String(sc.gender || '').toUpperCase();
    const theirs = String(sc.targetGender || '').toUpperCase();
    const ok = (g) => g === 'M' || g === 'F';
    if (!ok(mine) || !ok(theirs)) {
      why.push('"' + subj + '" READS `.gender` and this board declares '
        + (mine || 'none') + ' against ' + (theirs || 'none') + ' — the authority\'s own guard fails '
        + 'on a genderless body, so the ability correctly does nothing and the board cannot tell that '
        + 'apart from a dead mechanic. Declare both.');
      cl.push({ clause: 'gender', blocking: true, need: { gender: 'M or F on BOTH bodies' },
                got: { gender: mine || null, targetGender: theirs || null } });
    }
  }

  /* 3. A MECHANIC THAT READS OR CURES A STATUS NEEDS ONE PRESENT.
   *
   * THE CLAUSE SAID *WHICH KIND* OF PRECONDITION WAS MISSING AND NEVER *WHICH ONE*, and that is the
   * difference between a reader knowing a row is unstageable and a HARNESS being able to stage it.
   * Cheri Berry's handler is `if (pokemon.status === "par")` — the status is written in the source and
   * was being thrown away. `statusesRead` returns it, so `need.values` now names the status a fixture
   * has to land, and `['any']` is the honest answer for Lum Berry's `if (pokemon.status || …)`. */
  if (/cureStatus|\.status\b/.test(src) && sc.targetStatus === undefined && sc.status === undefined) {
    const want = statusesFromSrc(src);
    note.push('"' + subj + '" reads a status'
      + (want.length && want[0] !== 'any' ? ' (' + want.join('/') + ')' : '')
      + ' — a board whose bodies are healthy '
      + 'shows nothing whatever the engine does. Declare `status` (Natural Cure read 419 identical '
      + 'leaves for exactly this reason)');
    cl.push({ clause: 'status-present', blocking: false,
              need: { status: 'any status on the body it reads', values: want },
              got: { status: null, targetStatus: null } });
  }

  /* 4. A WEATHER- OR TERRAIN-GATED MECHANIC NEEDS THE SKY SET.
   *
   * BOTH QUOTE STYLES, AND THIS CLAUSE MATCHED ZERO UNTIL 2026-08-12. It read `/'(sunnyday|…)'/` — SINGLE
   * QUOTES ONLY — against a handler string taken off the COMPILED `dist/sim`, where TypeScript has
   * rewritten every literal as `"sunnyday"`. Chlorophyll's own source reads
   * `if (["sunnyday", "desolateland"].includes(...))`, so the clause could not match it or anything else:
   * measured over the 187 legal abilities that have a carrier, it fired **0 times**.
   *
   * THAT IS THE TRAP THE GENDER CLAUSE 30 LINES ABOVE ALREADY DOCUMENTS, REPEATED INSIDE THE SAME
   * FUNCTION ON THE SAME DAY. A dead clause is worse than a missing one: it reports "nothing here is
   * weather-gated", which is a silent default wearing the costume of a measurement. Fixed, and the
   * weather ids are returned STRUCTURALLY so a harness can set the sky instead of only being told. */
  const wx = (src.match(/['"](sunnyday|raindance|sandstorm|hail|snowscape|desolateland|primordialsea)['"]/g) || []);
  if (wx.length) {
    const weathers = [...new Set(wx.map(w => w.replace(/['"]/g, '')))];
    /* AND THE FIRST THING THE REPAIRED CLAUSE MATCHED WAS FIVE ABILITIES THAT MUST NOT BE REPAIRED.
     * Drizzle, Drought, Snow Warning, Sand Stream and Sand Spit name a weather because they SET it.
     * Handing them a pre-set sky is not a repair, it is the ABOMASNOW BUG from all_mechanics_fire's own
     * carrier block: `setWeather` returns false when that weather is already up, the arm emits nothing,
     * and a working ability reads DID-NOT-FIRE. Derived from the handler calling `setWeather`, never
     * from a list of five names. */
    const setsItself = [...src.matchAll(/setWeather\(\s*['"]([a-z]+)['"]/g)].map(m => m[1]);
    if (setsItself.length && weathers.every(w => setsItself.includes(w))) {
      note.push('"' + subj + '" SETS ' + setsItself.join('/') + ' rather than needing it '
        + '— a fixture that pre-sets that sky SUPPRESSES it (`setWeather` returns false and the arm emits '
        + 'nothing), which reads exactly like a dead mechanic');
      cl.push({ clause: 'weather-setter', blocking: false, must_not_preset: setsItself,
                got: { weather: sc.weather ? id(sc.weather) : null } });
    } else if (!sc.weather) {
      note.push('"' + subj + '" is gated on ' + weathers.join('/')
        + ' — declare `weather` or the arm is measuring an ability that is switched off');
      cl.push({ clause: 'weather', blocking: false, need: { weather: weathers }, got: { weather: null } });
    } else if (!weathers.includes(id(sc.weather))) {
      note.push('"' + subj + '" is gated on ' + weathers.join('/') + ' and this board '
        + 'declares ' + sc.weather + ' — the wrong sky is the same as no sky');
      cl.push({ clause: 'weather', blocking: false, need: { weather: weathers }, got: { weather: id(sc.weather) } });
    }
  }

  /* 5. A HANDLER GATED ON A MOVE PROPERTY NEEDS THAT MOVE THROWN, AND BY THE RIGHT SIDE.
   *
   * The clause the abilities arm was missing entirely. `all_mechanics_fire.js` threw Facade, Endure,
   * Rest and Substitute at all 316 abilities, so Justified's `move.type === "Dark"` could not be reached
   * on any board — and the row read DID-NOT-FIRE, which is indistinguishable from a dead mechanic.
   *
   * ADVISORY, NEVER BLOCKING, and that is the same distinction clause 3 makes. A blocking clause says
   * the board can show nothing at all; this says a PRECONDITION the handler reads was not put on the
   * board, which explains a row that did not fire and says nothing about a row that did. `labelRow` in
   * the caller only applies an advisory clause to a row that came back inert, so a subject that fires
   * for some other reason is never argued with.
   *
   * `stagedMoves` is what the fixture PROVABLY clicks, read back off the built bodies — not what it
   * intends to. That distinction is the whole value of asking: the `faces.setsWeather` intent silently
   * failed to reach the board for the entire life of that table. */
  if (sc.stagedMoves) {
    const nd = moveNeeds((ab && ab.exists && ab) || (itemE && itemE.exists && itemE) || null);
    const tg = sc.target ? D.species.get(sc.target) : null;
    const myT = (sp && sp.types) || [];
    const thT = (tg && tg.types) || [];
    const A = (sc.stagedMoves.actor || []).map(id);
    const R = (sc.stagedMoves.receiver || []).map(id);
    /* ONE HANDLER IS ONE BOOLEAN, SO ITS NEEDS MUST BE MET BY ONE MOVE. Asking them separately clears
     * a board that holds a Fighting move AND a super-effective move and no super-effective Fighting
     * move — which is exactly the board nine of the sixteen resist berries were staged on, and the
     * clause said nothing because each half was satisfied by a different click. Needs from DIFFERENT
     * handlers stay independent, because they are. */
    const groups = new Map();
    for (const n of nd.needs) {
      const k = n.by + '|' + n.handler;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(n);
    }
    for (const g of groups.values()) {
      const by = g[0].by;
      const tries = by === 'actor' ? [[A, myT, thT]]
                  : by === 'receiver' ? [[R, thT, myT]]
                  : [[A, myT, thT], [R, thT, myT]];
      const met = tries.some(([list, u, t]) =>
        list.some(m => g.every(n => satisfiesNeed(m, n, { userTypes: u, targetTypes: t }))));
      if (met) continue;
      const what = g.map(n => n.kind + (n.values.length ? ' (' + n.values.join(' or ') + ')' : ''))
                    .join(' AND ');
      note.push('"' + subj + '" is gated on ' + what + ' in `' + g[0].handler + '`, and the '
        + by + ' throws no ONE move that supplies all of it — the trigger cannot be reached on this '
        + 'board, which reads exactly like a dead mechanic');
      cl.push({ clause: 'trigger-move', blocking: false,
                need: { by, kinds: g.map(n => n.kind), values: g[0].values, handler: g[0].handler },
                got: { actor: A, receiver: R } });
    }
  }

  /* 6. A HANDLER GATED ON A BOARD STATE NEEDS THAT STATE PUT ON THE BOARD.
   *
   * Clause 5 stages a MOVE. This one cannot be satisfied by anything anybody clicks: Focus Sash needs
   * a full-HP body taking a lethal hit, Shed Shell a trapped one, Mental Herb a volatile already
   * present, White Herb a stat already dropped, Leppa Berry a move at 0 PP, Light Ball a Pikachu.
   *
   * The caller declares what its fixture PROVABLY puts on the board in `sc.boardState`; anything it
   * does not declare is unmet, exactly as an undeclared `weather` is. Advisory, for the same reason
   * clause 3 and clause 5 are — it explains a row that did not fire and says nothing about one that
   * did. `species-gated` is the exception and BLOCKS, because no turn can make a Corviknight a
   * Pikachu. */
  const BN = boardNeeds((ab && ab.exists && ab) || (itemE && itemE.exists && itemE) || null);
  const BS = sc.boardState || {};
  for (const n of BN) {
    if (n.kind === 'species-gated') {
      const want = n.values.map(id);
      const got = sp && sp.exists ? id(sp.baseSpecies || sp.name) : null;
      if (want.includes(got)) continue;
      why.push('"' + subj + '" only functions on ' + n.values.join('/') + ' (`' + n.handler
        + '` reads `baseSpecies.baseSpecies`) and this board carries ' + (sp && sp.name || 'nothing')
        + ' — the mechanic is switched off by the CARRIER, not by the engine');
      cl.push({ clause: 'species-gated', blocking: true, need: { species: n.values }, got: { species: got } });
      continue;
    }
    if (n.kind === 'accuracy-roll' || n.kind === 'crit-roll') {
      /* THE ONE CLAUSE THAT READS A PROPERTY OF THE RUN RATHER THAN OF THE BOARD, and it is declared
       * by the caller rather than assumed, because it is false under real dice. */
      const forced = n.kind === 'accuracy-roll' ? sc.armForcesAccuracy : sc.armForcesCrit;
      if (!forced) continue;
      note.push('"' + subj + '" does nothing but move the '
        + (n.kind === 'accuracy-roll' ? 'ACCURACY' : 'CRIT-RATIO') + ' number, and this run\'s arm '
        + 'resolves that roll as a CONSTANT — every check has the same answer whatever the number is. '
        + 'The mechanic cannot change a line of either log under this arm, however correct both are');
      cl.push({ clause: 'arm-constant-roll', blocking: false,
                need: { arm: 'an arm that rolls this die' }, got: { roll: n.kind, handler: n.handler } });
      continue;
    }
    if (n.kind === 'speed-order') {
      /* COMPUTED, NOT DECLARED. Both bodies are 0 SP under a neutral nature everywhere this clause is
       * used, so the two BASE speeds decide the order and the question "does the multiplier cross it"
       * has an arithmetic answer. If the caller cannot supply a target, the clause stays quiet rather
       * than guessing. */
      const tg = sc.target ? D.species.get(sc.target) : null;
      if (!legal(sp) || !legal(tg) || !n.multiplier) continue;
      const mine = sp.baseStats.spe, theirs = tg.baseStats.spe;
      /* ---- A SPEED TIE IS ALREADY WON, AND THE CLAUSE COULD NOT SEE THAT (2026-08-19) -------------
       *
       * "Does the multiplier change who moves first" is a question about the ORDER, and the order at
       * equal Speed is decided by the ARM'S TIE RULE rather than by arithmetic. `bottom-tie-first`
       * declares `tieToSecondBody: false` — *"the tie goes to the earlier body"* — and every subject
       * this harness stages is the earlier body, p1a.
       *
       * MEASURED: SWIFT SWIM's carrier is Basculegion at base 78 and the receiver is Feraligatr at
       * base 78. A strict `>` reads that as "slower, then faster" — a crossing — so the clause stayed
       * quiet and the row sat in `did_not_fire_unexplained`, reading as an engine gap. Under the arm
       * actually being played the subject moves first at 78 AND at 156, and doubling changes not one
       * line. The tie rule is DECLARED by the caller off the arm's own field, never assumed, because
       * it is false for an arm that hands ties to the later body. */
      const first = (a, b) => (sc.armTieFirst ? a >= b : a > b);
      if (first(mine, theirs) !== first(mine * n.multiplier, theirs)) continue;   /* it DOES cross — fine */
      const tied = mine === theirs && sc.armTieFirst;
      note.push('"' + subj + '" does nothing but multiply Speed by ' + n.multiplier + ', and on this '
        + 'board ' + sp.name + ' (' + mine + ') is '
        + (tied ? 'TIED with ' : first(mine, theirs) ? 'already faster than ' : 'still slower than ')
        + tg.name + ' (' + theirs + ') either way'
        + (tied ? ' — and this run\'s arm gives the tie to the EARLIER body, which is the subject' : '')
        + ' — the order does not change, so neither log can');
      cl.push({ clause: 'speed-order', blocking: false,
                need: { crossing: theirs }, got: { base: mine, multiplier: n.multiplier,
                                                   tie: tied || null, armTieFirst: !!sc.armTieFirst } });
      continue;
    }
    const met = n.kind === 'ko-hit' ? !!BS.koHit
              : n.kind === 'trapped' ? !!BS.trapped
              : n.kind === 'pp-exhausted' ? !!BS.ppExhausted
              : n.kind === 'own-stat-dropped' ? !!BS.ownStatDropped
              : n.kind === 'item-consumed' ? !!BS.itemConsumed
              : n.kind === 'ally-only' ? !!BS.allyIsLive
              : n.kind === 'volatile-present' ? n.values.some(v => (BS.volatiles || []).map(id).includes(v))
              : n.kind === 'heal-effect' ? n.values.some(v => (BS.healEffects || []).map(id).includes(v))
              /* DECLARED AS A FRACTION THE FIXTURE PROVABLY DROVE THE BAR BELOW — `hpBelow: 1/3` means
               * "a body on this board reached a third or less". Anything smaller than the handler's
               * own fraction satisfies it; anything larger does not. */
              : n.kind === 'hp-threshold' ? (+BS.hpBelow > 0 && +BS.hpBelow <= 1 / (n.fraction || 3))
              : false;
    if (met) continue;
    const what = n.kind === 'ko-hit' ? 'a hit that would take the holder\'s LAST HP'
                   + (n.atFullHp ? ', thrown while it is at FULL HP' : '')
               : n.kind === 'trapped' ? 'the holder to be TRAPPED by something'
               : n.kind === 'pp-exhausted' ? 'one of the holder\'s moves to be at 0 PP'
               : n.kind === 'own-stat-dropped' ? 'a stat already DROPPED on the holder'
               : n.kind === 'item-consumed' ? 'an item on the holder for it to lose or eat'
               : n.kind === 'ally-only' ? 'a PARTNER that is actually played — every handler it owns '
                   + 'fires on an ally, and this fixture\'s ally clicks Protect and is never touched'
               : n.kind === 'volatile-present' ? 'the volatile ' + n.values.join(' or ') + ' already on the body'
               : n.kind === 'heal-effect' ? 'a heal from ' + n.values.join(' or ')
               : n.kind === 'hp-threshold' ? 'the holder\'s HP bar to have travelled BELOW a '
                   + (n.fraction || 3) + 'rd/th of its maximum — the safe rung multiplies the pool by '
                   + 'six so nothing can faint, and the real-pool rung\'s beats do not reliably get a '
                   + 'bulky carrier there'
               : n.kind;
    note.push('"' + subj + '" needs ' + what + ' (`' + n.handler + '`), and this board does not '
      + 'declare it — a board that never reaches the state shows nothing whatever the engine does');
    cl.push({ clause: 'board-state', blocking: false,
              need: { state: n.kind, values: n.values, handler: n.handler },
              got: { declared: Object.keys(BS).length ? BS : null } });
  }

  /* 7. THE MECHANIC WHOSE CODE IS SOMEBODY ELSE'S, AND WHOSE EFFECT IS A CLOCK.
   *
   * Six in-scope items expose no functional handler at all. A derivation that read only what an entity
   * OWNS would report them as untriggerable; the reverse scan says otherwise, with a citation. Every
   * reading site for the rocks and the clay is a `durationCallback` returning 8 instead of 5, so the
   * mechanic is a DURATION EXTENSION and it is invisible in a game that never reaches turn 6 of the
   * thing being extended. That is a fixture limit with a NUMBER on it. */
  const handlerless = (itemE && itemE.exists && !handlerSrc(itemE).trim() && ['item', itemE.id])
                   || (ab && ab.exists && !handlerSrc(ab).trim() && ['ability', ab.id]) || null;
  if (handlerless) {
    const sites = readByOthers(handlerless[1], handlerless[0]);
    if (!sites.length) {
      note.push('"' + subj + '" exposes no handler AND nothing in the authority\'s own sources reads '
        + 'it by name — this instrument cannot say what would trigger it');
      cl.push({ clause: 'read-by-nobody', blocking: false, got: { entity: handlerless[1] } });
    } else {
      const durs = sites.filter(s => s.durations.length);
      const longest = Math.max(...durs.map(s => Math.max(...s.durations)), 0);
      const turns = +sc.turns || 0;
      if (durs.length === sites.length && (!turns || turns < longest)) {
        note.push('"' + subj + '" owns no handler; its whole effect is a DURATION, extended to '
          + longest + ' turns at ' + durs.map(s => s.file + ':' + s.line).join(', ')
          + (turns ? ' — and this fixture plays ' + turns + ' turns' : '')
          + '. The two arms cannot part before the shorter clock runs out');
        cl.push({ clause: 'duration-extension', blocking: false,
                  need: { turns: longest }, got: { turns: turns || null },
                  read_at: durs.map(s => s.file + ':' + s.line) });
      } else {
        note.push('"' + subj + '" owns no handler — its effect lives in '
          + sites.map(s => s.file + ':' + s.line + ' (' + s.fn + ')').join(', '));
        cl.push({ clause: 'read-elsewhere', blocking: false,
                  read_at: sites.map(s => s.file + ':' + s.line + ' (' + s.fn + ')') });
      }
    }
  }
}

/* ================= WHAT MOVE THE TRIGGER NEEDS, AND WHICH SIDE MUST CLICK IT =======================
 *
 * WILL, 2026-08-12: **"but we are staging it so a dark move hits a justified mon right? thats the
 * whole point"**. It was not. `all_mechanics_fire.js` threw the SAME four moves — Facade, Endure, Rest,
 * Substitute — at all 316 abilities, and none of them is Dark, so Justified could not fire on any board
 * this repository has ever built. The MOVES arm derives a team per move; the ABILITIES arm was a shared
 * gauntlet. Two standards in one runner.
 *
 * THE HANDLER SAYS WHAT IT NEEDS:
 *
 *     onDamagingHit(damage, target, source, move) { if (move.type === "Dark") this.boost({atk:1}); }
 *
 * — a Dark move, thrown BY THE OTHER SIDE. Both halves of that sentence are derivable and neither was
 * derived. This block derives both.
 *
 * ---- WHICH SIDE, AND WHY IT IS NOT A GUESS ------------------------------------------------------
 * Showdown's handler names carry the direction already. `onX` means the holder IS the event's target;
 * `onSourceX` and `onFoeX` mean it is the other participant; `onAllyX` means the ALLY is; `onAnyX`
 * means either. What that resolves to depends on WHOSE EVENT it is, and that is a property of the
 * SIMULATOR rather than of Pokemon: `BasePower` is raised on the ATTACKER, `TryHit` on the DEFENDER.
 * So one table of event->role, and an event missing from it falls to `either` LOUDLY (both sides are
 * handed the move and the need records `undetermined: true`) rather than silently picking a side.
 *
 * Worked through, which is the only way to know the table is the right way round:
 *   Iron Fist       onBasePower           attacker + no prefix  -> the HOLDER punches
 *   Thick Fat       onSourceModifyAtk     attacker + Source     -> the OTHER body throws Ice/Fire
 *   Justified       onDamagingHit         defender + no prefix  -> the OTHER body throws Dark
 *   Compound Eyes   onSourceModifyAccuracy defender + Source    -> the HOLDER throws a sub-100 move
 *   Queenly Majesty onFoeTryMove          attacker + Foe        -> the OTHER body throws priority
 *   Flower Veil     onAllyTryBoost        defender + Ally       -> the OTHER body drops a stat
 *
 * ---- WHAT IS DELIBERATELY NOT DERIVED, BECAUSE THE POLARITY IS NOT READABLE ----------------------
 * `move.category === "Status"` and `move.ohko` are recorded as UNDETERMINED CUES and never turned into
 * a need. Telepathy's guard is `if (!target.isAlly(source) || move.category === "Status") return;` —
 * the literal names Status and the requirement is the OPPOSITE of it. A derivation that cannot read
 * the sign of its own match must not pretend to; the cue is reported so the gap is visible.
 * This is the `refusesStatusMoves` lesson (docs/ENGINE.md) applied before rather than after. */

/* THE EVENT'S TARGET. `attacker` = the event is raised on the body USING the move; `defender` = on the
 * body it is aimed at. Read off the simulator's own `runEvent` call sites, not off a mechanic. */
const EVENT_ROLE = {
  basepower: 'attacker', modifyatk: 'attacker', modifyspa: 'attacker', modifymove: 'attacker',
  modifytype: 'attacker', modifydamage: 'attacker', modifystab: 'attacker', preparehit: 'attacker',
  trymove: 'attacker', aftermovesecondaryself: 'attacker', fractionalpriority: 'attacker',
  modifypriority: 'attacker', hitprotect: 'attacker',
  tryhit: 'defender', tryhitside: 'defender', tryprimaryhit: 'defender', damaginghit: 'defender',
  afterdamage: 'defender', aftermovesecondary: 'defender', criticalhit: 'defender',
  effectiveness: 'defender', modifyaccuracy: 'defender', accuracy: 'defender',
  invulnerability: 'defender', modifysecondaries: 'defender', flinch: 'defender',
  tryboost: 'defender', changeboost: 'defender', aftereachboost: 'defender', afterboost: 'defender',
};
/* THE EVENTS THAT ONLY A DAMAGING MOVE EVER REACHES, AND A STATUS MOVE OF THE RIGHT TYPE WAS
 * SATISFYING THEM.
 *
 * MEASURED 2026-08-18, and it is the shape of every over-match this file has already had: Twisted
 * Spoon's `onBasePower` needs a PSYCHIC move, `satisfiesNeed('type')` reads `move.type`, and **REST IS
 * A PSYCHIC MOVE**. It is in `GAUNTLET_ACTOR_MOVES`, so the need read as SATISFIED on every board, no
 * clause was emitted, and the row sat in `did_not_fire_unexplained` — the one bucket the whole
 * preflight exists to empty. `onBasePower` runs inside `getDamage` and a status move never enters it.
 *
 * Read off the simulator's call sites like `EVENT_ROLE` beside it, and for the same reason: it is a
 * property of where the event is RAISED, not of any mechanic. An event absent from this set is treated
 * as reachable by anything, which is the permissive direction and matches the previous behaviour. */
const DAMAGE_PATH = new Set(['basepower', 'modifydamage', 'damaginghit', 'afterdamage',
  'criticalhit', 'effectiveness', 'modifystab', 'weathermodifydamage', 'sourcemodifydamage']);
/* The events whose very NAME is the requirement — no literal in the body to read. */
const EVENT_CUE = {
  modifystab: 'stab', modifyaccuracy: 'subaccuracy', accuracy: 'subaccuracy',
  modifysecondaries: 'secondary', flinch: 'flinch',
  tryboost: 'statDrop', changeboost: 'statDrop', aftereachboost: 'statDrop', afterboost: 'statDrop',
};
function splitHandler(name) {
  const m = /^on(Ally|Foe|Source|Any)?([A-Z][A-Za-z]*)$/.exec(name);
  if (!m) return null;
  return { prefix: m[1] || '', base: m[2].toLowerCase() };
}
/* Who has to CLICK the move. See the worked table above. */
function whoClicks(prefix, role) {
  if (!role || prefix === 'Any') return 'either';
  if (prefix === 'Ally') return role === 'defender' ? 'receiver' : 'ally';
  const flip = prefix === 'Source' || prefix === 'Foe';
  const holderIsUser = role === 'attacker' ? !flip : flip;
  return holderIsUser ? 'actor' : 'receiver';
}
/* ---- POLARITY, AND THE FIRST DRAFT OF THIS FUNCTION GOT IT WRONG ON SIX ABILITIES ---------------
 *
 * A literal naming a flag is not the same as a flag being REQUIRED, and the naive version of this
 * derivation over-matched exactly the way docs/ENGINE.md says a new predicate always does. What it
 * printed before it was wired:
 *
 *     Cursed Body     receiver:flag=futuremove          `!move.flags["futuremove"]` — must be ABSENT
 *     Protean/Libero  actor:flag=futuremove             same, in a bare-return guard
 *     Parental Bond   actor:flag=noparentalbond|charge|futuremove   THREE exclusions in one guard
 *     Lightning Rod   either:flag=pledgecombo           an exclusion beside the real Electric need
 *     Ice Face        receiver:flag=bypasssub           a substitute check, not a requirement
 *
 * Six rows would have been handed a Future Sight or a Pledge to stage a trigger that refuses both.
 *
 * THE POLARITY IS STRUCTURAL AND IS READ RATHER THAN LISTED. Every one of those is a GUARD whose
 * consequent is a bare `return;`, and every genuine requirement is either negated inside such a guard
 * (Magic Bounce: `!move.flags["reflectable"] ... return`) or positive inside a guard that DOES
 * something (Bulletproof: `move.flags["bullet"] -> this.add(...); return null`). So:
 *
 *     required  =  negated  ==  the guard's consequent is a bare return
 *
 * THIS WAS WRITTEN AS AN XOR FIRST AND THE PRINT-BEFORE-WIRING CAUGHT IT: with the sign flipped the
 * derivation went from 38 type needs to ZERO — Justified, Sap Sipper, Thick Fat, Volt Absorb, Iron Fist
 * and Sharpness all silently disappeared, which is the under-match that looks exactly like "no ability
 * needs a move". It was visible only because the matches were printed rather than trusted.
 *
 * and an occurrence outside any guard is required only when it is positive. Naming `futuremove` and
 * `pledgecombo` in an exclusion list would have worked today and rotted the first time an ability was
 * added — the same argument this file's opening paragraph makes about hand lists. */
function guardsOf(src) {
  const out = [];
  for (let i = 0; i < src.length; i++) {
    if (!/^if\s*\(/.test(src.slice(i, i + 5))) continue;
    const j = src.indexOf('(', i);
    let depth = 0, k = j;
    for (; k < src.length; k++) { if (src[k] === '(') depth++; else if (src[k] === ')') { depth--; if (!depth) break; } }
    const cond = src.slice(j + 1, k);
    const after = src.slice(k + 1).replace(/^\s*/, '');
    const body = after[0] === '{' ? after.slice(1, 300) : after.slice(0, 200);
    out.push({ cond, bare: /^\s*return\s*(;|\})/.test(body) });
    i = k;
  }
  return out;
}
/* Is this literal REQUIRED on the board? `re` must capture nothing; it is used only to locate. */
function polarity(src, guards, re) {
  let required = false, seen = false;
  const check = (text, bare) => {
    for (const m of text.matchAll(re)) {
      seen = true;
      const before = text.slice(Math.max(0, m.index - 3), m.index);
      const negated = /!\s*$/.test(before) || /!\s*\(\s*$/.test(text.slice(Math.max(0, m.index - 4), m.index))
                   || /!==/.test(m[0]);
      if (bare === null) { if (!negated) required = true; }
      else if (negated === bare) required = true;
    }
  };
  let covered = '';
  for (const g of guards) { check(g.cond, g.bare); covered += g.cond + '\u0000'; }
  /* whatever is not inside a guard condition */
  check(src.split(/if\s*\(/).map((s, i) => i ? s.slice(s.indexOf(')') + 1) : s).join(' '), null);
  void covered;
  return { seen, required };
}
/* BOTH QUOTE STYLES, EVERY TIME. The handler is read off the COMPILED `dist/sim`, where TypeScript has
 * rewritten `'Dark'` as `"Dark"`. A single-quote regex here finds NOTHING — the bug this file's weather
 * clause carried for its whole life and that the gender clause documents 200 lines up. */
function cuesOf(base, src) {
  const out = [], undet = [];
  const G = guardsOf(src);
  const need = (kind, re, values) => {
    const p = polarity(src, G, re);
    if (p.seen && p.required) out.push({ kind, values: values || [] });
    return p;
  };
  /* TYPES. `===` and `.includes()` are the positive forms, `!==` the negated one — and `!==` inside a
   * bare-return guard is a REQUIREMENT (Lightning Rod: `if (move.type !== "Electric" ...) return`). */
  const types = new Set();
  for (const m of src.matchAll(/move\.type\s*[!=]==\s*["']([A-Za-z?]+)["']/g)) {
    if (m[1] === '???') continue;
    const p = polarity(src, G, new RegExp('move\\.type\\s*[!=]==\\s*["\']' + m[1] + '["\']', 'g'));
    if (p.required) types.add(m[1]);
  }
  for (const m of src.matchAll(/\[([^\]]{0,120}?)\]\s*\.includes\(\s*move\.type\s*\)/g)) {
    const p = polarity(src, G, new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    if (p.required) for (const t of m[1].matchAll(/["']([A-Za-z]+)["']/g)) types.add(t[1]);
  }
  if (types.size) out.push({ kind: 'type', values: [...types] });
  /* FLAGS, each judged on its own polarity — Parental Bond names three and requires none. */
  const flags = new Set();
  for (const m of src.matchAll(/move\.flags(?:\[\s*["']([a-z]+)["']\s*\]|\.([a-z]+))/g)) {
    const f = m[1] || m[2];
    const p = polarity(src, G, new RegExp('move\\.flags(?:\\[\\s*["\']' + f + '["\']\\s*\\]|\\.' + f + ')', 'g'));
    if (p.required) flags.add(f);
  }
  if (flags.size) out.push({ kind: 'flag', values: [...flags] });
  need('recoil', /move\.recoil|hasCrashDamage/g);
  need('multihit', /move\.multihit\b/g);
  need('drain', /move\.drain\b/g);
  need('secondary', /move\.secondaries\b/g);
  need('priority', /move\.priority\b/g);
  need('supereffective', /typeMod\s*>\s*0/g);
  /* THE BOOST FAMILY. The SIGN decides both the need and which side has to click it: a DROP arrives
   * from the opposite body, a RAISE the body does to itself. Opportunist reads `boost[i] > 0` and is
   * the row that proves the two cannot share a rule. A handler gated on `isBerry` (Ripen) is reading an
   * EFFECT rather than a move and gets no need at all. */
  if (EVENT_CUE[base] === 'statDrop') {
    /* GATED ON AN EFFECT RATHER THAN ON A MOVE, and this is a whole family. Oblivious, Own Tempo,
     * Inner Focus and Scrappy all read `effect.name === "Intimidate"`, and Ripen reads `isBerry` — no
     * move whatsoever supplies those, so a statDrop need would stage a stat-dropping attack that the
     * handler then ignores. MEASURED: all four were staged with Breaking Swipe and all four stayed
     * inert, which is a WRONG trigger recorded as staged — worse than no trigger, because it moves the
     * row out of the fixture-gap column while explaining nothing. They need an adversary CARRYING the
     * named effect, which is an engine/faces.js job, so the cue is reported and no need is emitted.
     * `zpower` is excluded because every `onChangeBoost` guards on it and none is about it. */
    /* AND THE EFFECT GATE TAKES THE SAME POLARITY TEST AS THE FLAGS, because the first version did not
     * and immediately over-corrected: Mirror Armor's `effect.name === "Mirror Armor" ... return` and
     * Opportunist's `effect?.name === "Opportunist" || … "Mirror Herb"` are self-exclusion guards —
     * "do not recurse on my own effect" — and reading them as requirements dropped both rows back out
     * of FIRED. Oblivious's `if (effect.name === "Intimidate" && boost.atk) { delete boost.atk; … }` is
     * the genuine one and it is not a bare return. Same rule, same helper, one line apart. */
    const eff = [...src.matchAll(/effect\??\.(?:name|id)\s*===\s*["']([A-Za-z ]+)["']/g)]
      .map(m => m[1]).filter(x => id(x) !== 'zpower')
      .filter(x => polarity(src, G, new RegExp('effect\\??\\.(?:name|id)\\s*===\\s*["\']'
        + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']', 'g')).required);
    if (/isBerry/.test(src)) undet.push('the boost is gated on isBerry, not on a move');
    else if (eff.length) undet.push('the boost is gated on effect "' + eff.join('/')
      + '", not on a move — the ADVERSARY has to carry it');
    else if (/boost(\[\s*\w+\s*\]|\.\w+)\s*>\s*0/.test(src) && !/boost(\[\s*\w+\s*\]|\.\w+)\s*<\s*0/.test(src))
      out.push({ kind: 'statRaise', values: [] });
    else {
      /* WHICH STAT, when the handler names one. Big Pecks reads `boost.def < 0`, Keen Eye and
       * Illuminate `boost.accuracy < 0`, Hyper Cutter `boost.atk < 0` — and a generic `boost[i] < 0`
       * loop (Clear Body, Defiant, White Smoke) names none and takes any. Staging an ATTACK drop
       * against Big Pecks satisfies "a stat went down" and satisfies nothing the handler is watching. */
      const stats = [...new Set([...src.matchAll(/boost\.(\w+)\s*<\s*0/g)].map(m => m[1]))];
      out.push({ kind: 'statDrop', values: stats });
      /* A GATE THIS DERIVATION CAN SEE AND CANNOT SUPPLY. Flower Veil additionally needs the body it
       * protects to BE Grass; the need is still real, so it is emitted, and the shortfall is named. */
      if (/hasType\(/.test(src)) undet.push('the boost handler also gates on the target\'s TYPE '
        + '(`hasType`) — a stat-dropping move alone does not satisfy it');
    }
  } else if (EVENT_CUE[base]) out.push({ kind: EVENT_CUE[base], values: [] });
  /* CATEGORY. The header retired this to the undetermined pile in August with Telepathy as the worked
   * example — `if (!target.isAlly(source) || move.category === "Status") return;` names Status and
   * requires the OPPOSITE. That was right at the time and it is no longer, because `polarity` was
   * built afterwards and answers exactly this question: Telepathy's guard is a BARE RETURN so the
   * literal is an exclusion, while Wise Glasses' `if (move.category === "Special") return
   * this.chainModify(…)` is a guard that DOES something, so the literal is a requirement. Same helper,
   * same rule as the flags directly above, and Wise Glasses was one of the last three unexplained item
   * rows. PRINTED over all 316 abilities and all 73 items before it was wired: 4 abilities and 1 item,
   * every one of them a positive guard, and Telepathy is correctly not among them. */
  {
    const cats = new Set();
    for (const m of src.matchAll(/move\.category\s*[!=]==\s*["'](Physical|Special|Status)["']/g)) {
      const p = polarity(src, G, new RegExp('move\\.category\\s*[!=]==\\s*["\']' + m[1] + '["\']', 'g'));
      if (p.required) cats.add(m[1]);
    }
    if (cats.size) out.push({ kind: 'category', values: [...cats] });
    else if (/move\.category\s*===/.test(src)) undet.push('move.category (read, and not required)');
  }
  if (/move\.ohko/.test(src)) undet.push('move.ohko');
  if (/move\.willCrit/.test(src)) undet.push('move.willCrit');
  /* dedupe by kind: a handler naming two types is ONE need with two acceptable values */
  const seen = new Map();
  for (const n of out) {
    if (!seen.has(n.kind)) seen.set(n.kind, n);
    else for (const v of n.values) if (!seen.get(n.kind).values.includes(v)) seen.get(n.kind).values.push(v);
  }
  return { needs: [...seen.values()], undet };
}
/** moveNeeds(entity) -> {needs:[{kind,values,by,handler,undetermined}], undetermined:[...]}
 *  `entity` is a Dex ability or item. Reads its OWN handlers; no list anywhere. */
function moveNeeds(entity) {
  const needs = [], undetermined = [];
  if (!entity || !entity.exists) return { needs, undetermined };
  for (const [k, v] of Object.entries(entity)) {
    if (!/^on/.test(k) || typeof v !== 'function') continue;
    const h = splitHandler(k);
    if (!h) continue;
    const role = EVENT_ROLE[h.base];
    const by = whoClicks(h.prefix, role);
    const c = cuesOf(h.base, String(v));
    const damaging = DAMAGE_PATH.has(h.base);
    for (const u of c.undet) undetermined.push({ handler: k, cue: u });
    for (const n of c.needs) {
      if (damaging) n.damagingOnly = true;
      /* THE BOOST FAMILY DOES NOT TAKE THE ATTACKER/DEFENDER FLIP, and pretending it did put
       * Opportunist on the wrong side of the field. A boost EVENT names the body whose stats moved; a
       * DROP is thrown at it by the other side, a RAISE is something it did to itself. */
      let side = by;
      if (n.kind === 'statDrop' || n.kind === 'statRaise') {
        const tgt = h.prefix === '' ? 'actor'
                  : (h.prefix === 'Foe' || h.prefix === 'Source') ? 'receiver'
                  : h.prefix === 'Ally' ? 'ally' : 'either';
        side = n.kind === 'statRaise' ? tgt
             : tgt === 'actor' ? 'receiver' : tgt === 'receiver' ? 'actor' : 'receiver';
      }
      needs.push(Object.assign({}, n, { by: side, handler: k, undetermined: side === 'either' }));
    }
  }
  /* Two handlers asking for the same thing from the same side are one need. */
  const key = n => n.by + '/' + n.kind + '/' + n.values.slice().sort().join(',');
  const uniq = new Map();
  for (const n of needs) if (!uniq.has(key(n))) uniq.set(key(n), n);
  return { needs: [...uniq.values()], undetermined };
}

/* DOES THIS MOVE SUPPLY THAT NEED? `ctx` carries the two typings, because STAB is a property of the
 * USER and super-effectiveness a property of the TARGET — neither is readable off the move alone. */
function satisfiesNeed(moveId, need, ctx) {
  const mv = D.moves.get(moveId);
  if (!mv || !mv.exists) return false;
  /* A DAMAGE-PATH HANDLER IS NOT REACHED BY A STATUS MOVE, WHATEVER TYPE IT IS. See `DAMAGE_PATH` —
   * Rest is Psychic, and it was clearing Twisted Spoon's requirement without ever entering the code
   * that reads it. Applied here rather than inside each case so no kind can forget it. */
  if (need.damagingOnly && mv.category === 'Status') return false;
  switch (need.kind) {
    case 'type': return need.values.includes(mv.type);
    case 'category': return need.values.includes(mv.category);
    case 'flag': return need.values.some(f => !!(mv.flags || {})[f]);
    case 'recoil': return !!(mv.recoil || mv.hasCrashDamage);
    case 'multihit': return Array.isArray(mv.multihit);
    case 'drain': return !!mv.drain;
    /* A SECONDARY THAT DOES SOMETHING TO THE TARGET, and the narrower test was measured rather than
     * assumed. The first version accepted any `secondaries` entry and picked Ancient Power for Shield
     * Dust — whose only secondary is `{chance:10, self:{boosts:…}}`, and whose handler is
     * `secondaries.filter(effect => !!effect.self)`, i.e. it KEEPS exactly that one. The staged trigger
     * was the one move in the pool the mechanic is defined to ignore, and the row read DID-NOT-FIRE
     * with a trigger recorded as staged — the worst of both labels. */
    case 'secondary':
      return [].concat(mv.secondaries || [], mv.secondary ? [mv.secondary] : [])
        .some(s => s && (s.status || s.volatileStatus || s.boosts || s.dustproof === false));
    case 'priority': return (mv.priority || 0) > 0;
    case 'subaccuracy': return mv.accuracy !== true && +mv.accuracy > 0 && +mv.accuracy < 100;
    case 'stab': return !!(ctx && ctx.userTypes && ctx.userTypes.includes(mv.type));
    case 'supereffective':
      return !!(ctx && ctx.targetTypes && mv.category !== 'Status'
                && D.getEffectiveness(mv.type, ctx.targetTypes) > 0
                && D.getImmunity(mv.type, ctx.targetTypes));
    case 'flinch':
      return (mv.secondaries || []).some(s => s && s.volatileStatus === 'flinch')
          || (mv.volatileStatus === 'flinch');
    case 'statDrop': {
      /* A move that LOWERS a stat ON THE TARGET. `boosts` with a negative value and a target that is
       * not the user; or a secondary that does the same. `self` boosts are the user's own and would
       * stage the opposite of what an `onTryBoost` guard is waiting for. */
      const want = need.values || [];
      const neg = b => b && Object.entries(b).some(([k, x]) => x < 0 && (!want.length || want.includes(k)));
      if (neg(mv.boosts) && mv.target !== 'self') return true;
      return (mv.secondaries || []).some(s => s && !s.self && neg(s.boosts));
    }
    case 'statRaise': {
      const pos = b => b && Object.values(b).some(x => x > 0);
      if (pos(mv.boosts) && mv.target === 'self') return true;
      return (mv.secondaries || []).some(s => s && s.self && pos(s.self.boosts));
    }
    default: return false;
  }
}
/* ================= WHAT THE BOARD MUST HOLD, AS OPPOSED TO WHAT SOMEBODY MUST CLICK ================
 *
 * `moveNeeds` above answers "which MOVE reaches this trigger". A whole family of mechanics — and it is
 * the family the ITEMS arm is made of — needs nothing clicked at all. It needs the board to be in a
 * STATE: Focus Sash needs a body at full HP taking a lethal hit, Shed Shell needs a trapped body,
 * Mental Herb needs one of six volatiles present, White Herb needs a stat already dropped, Leppa Berry
 * needs a move at 0 PP, Light Ball needs the holder to BE Pikachu.
 *
 * MEASURED 2026-08-18: 55 of the 73 in-scope item rows read `did_not_fire_unexplained`, and the
 * `trigger-move` clause could not have explained one of them, because `runItems` never handed the
 * preflight a `stagedMoves` at all. The mechanism was built for abilities and pointed at abilities.
 *
 * DERIVED FROM THE HANDLER, SAME RULE AS EVERY CLAUSE ABOVE. A board need is a literal the handler
 * reads that no move supplies, so it is a different SHAPE of requirement, not a different source of
 * truth. Each kind below names the regex that finds it, and the whole set was PRINTED over all 316
 * abilities and all 73 in-scope items before it was wired to anything — the `refusesStatusMoves`
 * lesson, which this file has already had to learn twice inside `cuesOf`. */
function boardNeeds(entity) {
  const out = [], undet = [];
  if (!entity || !entity.exists) return out;
  const add = (kind, values, handler, extra) =>
    out.push(Object.assign({ kind, values: values || [], handler }, extra || {}));
  const handlers = Object.entries(entity).filter(([k, v]) => /^on/.test(k) && typeof v === 'function');
  const allSrc = handlers.map(([, v]) => String(v)).join(' ');
  /* A VOLATILE THE MECHANIC APPLIES ITSELF IS NOT A PRECONDITION, AND THE FIRST PRINT OF THIS
   * DERIVATION GOT THAT WRONG ON EIGHT ROWS. `flashfire.onEnd` removes `flashfire`, `truant.onStart`
   * reads `truant`, Choice Scarf's `onStart` reads `choicelock` — every one of them is the mechanic
   * looking at its OWN mark, which it puts there. Reading those as "the board must already hold this"
   * would have labelled eight working mechanics as fixture gaps. Derived, not listed: anything the
   * entity `addVolatile`s anywhere in its own handlers is its own. */
  const selfVol = new Set([...allSrc.matchAll(/addVolatile\(\s*["']([a-z]+)["']/g)].map(m => m[1]));
  for (const [k, v] of handlers) {
    const src = String(v);
    const h = splitHandler(k);
    const base = h ? h.base : '';
    const prefix = h ? h.prefix : '';
    /* THE HOLDER MUST BE THAT SPECIES. `pokemon.baseSpecies.baseSpecies === "Pikachu"` is Light Ball's
     * entire guard, and it is the one board need that BLOCKS: no turn, no sky and no status can make a
     * Corviknight a Pikachu. */
    for (const m of src.matchAll(/baseSpecies\.baseSpecies\s*===\s*["']([A-Za-z-]+)["']/g))
      add('species-gated', [m[1]], k, { blocking: true });
    /* A LETHAL HIT ON A FULL-HP BODY. Focus Sash and Sturdy both read it; the fixture's rung 1 is built
     * so nothing can faint and its rung 2 beats a body down over several turns, so "full HP AND a hit
     * that would take all of it" is a state neither rung reaches by accident. */
    if (/damage\s*>=\s*target\.hp/.test(src))
      add('ko-hit', [], k, { atFullHp: /target\.hp\s*===\s*target\.maxhp/.test(src) });
    /* TRAPPED, AND THE PREFIX IS THE POLARITY. `onTrapPokemon` with no prefix means the HOLDER is the
     * one being trapped and is escaping — Shed Shell. `onFoeTrapPokemon` is the opposite mechanic
     * entirely: Arena Trap, Magnet Pull and Shadow Tag DO the trapping and need no trapped body at all.
     * The first print handed all four the same need, which is a requirement invented for three rows
     * that already work. */
    if ((base === 'trappokemon' || base === 'maybetrappokemon') && !prefix) add('trapped', [], k);
    /* A HEAL FROM ONE OF A NAMED SET OF EFFECTS. Big Root lists five by `effect.id`, which is not a
     * move id: `drain` is the sub-effect the simulator passes when a drain move heals
     * (sim/battle-actions.ts — `this.battle.heal(..., 'drain')`), so a drain move supplies it.
     *
     * RESTRICTED TO A HEAL-SHAPED HANDLER, because `[...].includes(effect.id)` is a shape and not a
     * meaning. The first print matched Damp's `["explosion","mindblown",…]` in `onAnyTryMove` and Cud
     * Chew's `["bugbite","pluck"]` in `onEatItem` — neither is a heal, and both would have been handed
     * a requirement about healing. Those are recorded as UNDETERMINED cues, which is what this file
     * already does with `move.category` and `move.ohko`: a match whose meaning cannot be read is
     * reported so the gap is visible, never acted on. */
    for (const m of src.matchAll(/\[([^\]]{0,200}?)\]\s*(?:\.includes\(\s*effect\.id\s*\)|;[\s\S]{0,80}?includes\(effect\.id\))/g)) {
      const vals = [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]);
      if (/heal/.test(base)) add('heal-effect', vals, k);
      else undet.push({ handler: k, cue: 'a list of effect ids (' + vals.join('|')
        + ') outside a heal handler — the sign and the supplier are not readable here' });
    }
    /* A MOVE AT 0 PP. Leppa Berry's whole mechanism. */
    if (/\.pp\s*===?\s*0/.test(src)) add('pp-exhausted', [], k);
    /* A VOLATILE ALREADY ON THE BODY. Mental Herb reads six and Persim Berry one; both cure rather
     * than read a `status`, so the `status-present` clause above cannot see either of them. */
    {
      const vs = new Set();
      for (const m of src.matchAll(/(?:removeVolatile|volatiles)\s*[([]\s*["']([a-z]+)["']/g)) vs.add(m[1]);
      for (const m of src.matchAll(/\[([^\]]{0,200}?)\]\s*\.(?:filter|some|forEach)\(/g))
        if (/removeVolatile|volatiles/.test(src.slice(m.index, m.index + 400)))
          for (const x of m[1].matchAll(/["']([a-z]+)["']/g)) vs.add(x[1]);
      /* AND THE ONE THAT READS THE LIST THROUGH A LOOP VARIABLE. Mental Herb — six volatiles, the only
       * item in the format whose whole mechanism they are — writes
       * `const conditions = ["attract", …]; for (const c of conditions) if (pokemon.volatiles[c])`, so
       * NO literal ever appears inside a `volatiles[...]` subscript and the two matchers above find
       * nothing. It was the last unexplained item row on the 2026-08-18 run. The array literal is
       * bound to a name and the subscript is that name, so both halves are read. */
      for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[([^\]]{0,300}?)\]/g))
        if (new RegExp('volatiles\\[\\s*\\w*' + m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                       + '\\w*\\s*\\]|volatiles\\[\\s*(?:first|second)?[A-Za-z]*\\s*\\]').test(src))
          for (const x of m[2].matchAll(/["']([a-z]+)["']/g)) vs.add(x[1]);
      for (const v of selfVol) vs.delete(v);
      if (vs.size && /removeVolatile|cureStatus/.test(src)) add('volatile-present', [...vs], k);
    }
    /* A STAT ALREADY DROPPED ON THE HOLDER. White Herb restores it; with nothing dropped it restores
     * nothing and the two arms are identical. */
    if (/boosts\[[^\]]+\]\s*<\s*0/.test(src)) add('own-stat-dropped', [], k);
    /* ---- THE HP BAR HAS TO HAVE TRAVELLED (2026-08-19) --------------------------------------------
     *
     * `if (attacker.hp <= attacker.maxhp / 3)` is Overgrow's entire guard and Swarm's, and it is the
     * one precondition the fixture's two rungs cannot promise: `safe-pool` multiplies the HP pool by
     * SIX precisely so nothing can faint, and `real-pool`'s three beats do not reliably take a bulky
     * carrier past a third. Both rows sat in `did_not_fire_unexplained` — which reads as an engine gap
     * — with nothing anywhere saying that the board never got low enough to ask.
     *
     * BLAZE AND TORRENT CARRY THE IDENTICAL GUARD AND BOTH FIRE, which is what makes this safe: an
     * advisory clause is only ever applied to a row that did NOT fire (see `labelRow` in the caller),
     * so the two that reach the threshold are never argued with and the two that do not can say why.
     * The DENOMINATOR is read out of the handler rather than assumed to be 3. */
    {
      const hg = /\.hp\s*<=?\s*\w+\.maxhp\s*\/\s*(\d+)/.exec(src);
      if (hg) add('hp-threshold', [hg[1]], k, { fraction: +hg[1] });
    }
  }
  /* AN ACCURACY OR CRIT-RATIO MULTIPLIER, AND THE JUDGEMENT IS ABOUT THE WHOLE ENTITY RATHER THAN ONE
   * HANDLER. Under a CORNER arm of the differential the accuracy roll is a constant — `random(m)`
   * returns 0 at the bottom corner and `m-1` at the top (game_differential.js `makeArm`), so
   * `random(100) < accuracy` has the same answer whatever the accuracy is, and `randomChance(1,ratio)`
   * has the same answer whatever the ratio is. A mechanic whose ONLY effect is to move one of those two
   * numbers therefore cannot change a single line of either engine's log, however correct both are.
   *
   * "ONLY" IS LOAD-BEARING AND THE FIRST PRINT PROVED IT. Hustle carries `onSourceModifyAccuracy` AND
   * `onModifyAtk`; per-handler, it looked arm-inert, and Hustle is one of the rows that FIRES. So the
   * need is emitted only when every functional handler the entity owns is in this family. */
  const ACC = /^(?:modifyaccuracy|accuracy)$/, CRIT = /^modifycritratio$/;
  const bases = handlers.map(([k]) => (splitHandler(k) || { base: '' }).base);
  if (bases.length && bases.every(b => ACC.test(b) || CRIT.test(b))) {
    add(bases.some(b => ACC.test(b)) ? 'accuracy-roll' : 'crit-roll', [], handlers[0][0],
        { onlyEffect: true, alsoCrit: bases.some(b => CRIT.test(b)) });
  }
  /* AN ITEM THE HOLDER HAS TO CONSUME. Cheek Pouch, Cud Chew, Ripen, Unburden and Symbiosis all key on
   * an item leaving a body; the abilities arm builds both of its bodies with `item: ''` unless a
   * `thenWhat` row asks otherwise, so there is nothing to eat. Per-handler and event-named, the same
   * shape as `trapped`, not an entity-level guess. */
  /* NO PREFIX AND NOT `tryeatitem`, AND BOTH RESTRICTIONS WERE MEASURED. The first print matched 11
   * abilities: `onFoeTryEatItem` (As One, Unnerve) is the holder STOPPING somebody else's berry, and
   * `onTryEatItem` on Berserk and Anger Shell is a veto hook beside an `onDamage` that is the real
   * mechanism. Neither is "this ability needs an item to be consumed", and labelling Berserk that way
   * would have parked a threshold ability in the item column. */
  for (const [k] of handlers) {
    const h = splitHandler(k) || { base: '', prefix: '' };
    if (h.prefix || !/^(?:eatitem|afteruseitem|takeitem|useitem)$/.test(h.base)) continue;
    add('item-consumed', [], k);
    break;
  }
  /* EVERYTHING IT DOES, IT DOES TO ITS PARTNER. Aroma Veil, Flower Veil, Sweet Veil, Friend Guard,
   * Symbiosis, Telepathy and Receiver are ally mechanics, and this fixture's ally is a pad that clicks
   * Protect every turn and is never hit, statused or dropped. Entity-level and `every`, because a
   * mechanic with one ally handler among several is not an ally mechanic — the same "only" that
   * Hustle forced onto the accuracy clause. `Ally` in the handler NAME or an `isAlly`/`hasAlly`/
   * `allies()` gate in its body; Friend Guard is `onAnyModifyDamage` and is only findable the second
   * way.
   *
   * THE SOURCE-GATE ROUTE IS DELIBERATELY NOT TAKEN, AND THAT IS A NAMED GAP RATHER THAN AN OVERSIGHT.
   * Matching `isAlly`/`hasAlly` in a handler body caught 26 abilities and most of them mean the
   * OPPOSITE: Competitive's `if (!source || target.isAlly(source)) return;` EXCLUDES an ally, while
   * Telepathy's `if (!target.isAlly(source) …) return;` requires one — identical text, opposite sign.
   * `polarity` recovered most of it and still cleared Queenly Majesty, Dazzling, Armor Tail, Mummy and
   * Toxic Debris, whose `isAlly` sits in a nested call the guard splitter does not bracket cleanly.
   * A WRONG EXPLANATION IS WORSE THAN NONE — it moves a row out of the unexplained column while
   * explaining nothing, which is the exact failure this whole clause set exists to undo. So the clause
   * takes only the route that cannot be misread, the `Ally` PREFIX in the handler's own name, and
   * FRIEND GUARD AND TELEPATHY ARE NOT COVERED BY IT. They stay unexplained and are visible as such. */
  if (handlers.length && handlers.every(([k]) => /^onAlly/.test(k)))
    add('ally-only', [], handlers[0][0], { onlyEffect: true });
  /* A SPEED MULTIPLIER IS OBSERVABLE ONLY WHERE IT CHANGES WHO MOVES FIRST. Swift Swim and Slush Rush
   * double Speed and do nothing else; both bodies here are built at 0 SP under a neutral nature, so
   * base Speed is the whole order and a doubling that leaves the order alone changes not one line of
   * either log. The MULTIPLIER is read off the handler rather than assumed to be 2. */
  if (bases.length && bases.every(b => b === 'modifyspe')) {
    const m = /chainModify\(\s*([\d.]+)\s*\)/.exec(allSrc);
    add('speed-order', [], handlers[0][0], { onlyEffect: true, multiplier: m ? +m[1] : null });
  }
  const key = n => n.kind + '/' + n.values.slice().sort().join(',');
  const uniq = new Map();
  for (const n of out) if (!uniq.has(key(n))) uniq.set(key(n), n);
  const needs = [...uniq.values()];
  needs.undetermined = undet;
  return needs;
}

/* ================= AND THE HALF A HANDLER SCAN CANNOT SEE =========================================
 *
 * SIX IN-SCOPE ITEMS EXPOSE NO FUNCTIONAL HANDLER WHATSOEVER — `smoothrock`, `heatrock`, `icyrock`,
 * `damprock`, `lightclay`, and `ironball` exposes two that are not where its grounding rule lives. A
 * derivation that reads only what the entity OWNS would report "this cannot be triggered", confidently
 * and wrongly. Their effect lives in somebody else's code:
 *
 *     data/conditions.ts:633   sandstorm.durationCallback -> `if (source?.hasItem('smoothrock'))`
 *
 * So the scan runs in BOTH directions. This half greps the authority's own sources for who READS
 * `hasItem('<id>')`, and reports the reading site with its file and line, so the finding is a citation
 * rather than a claim. `data/items.ts` is excluded because the item's own definition is already read
 * off the dex above; every other file is fair game.
 *
 * WHERE IT IS READ DECIDES WHAT THE FIXTURE NEEDS. Every one of the five rocks and clays is read
 * inside a `durationCallback` that returns 8 instead of 5 — so the mechanic is a DURATION EXTENSION,
 * and it is invisible in any game that does not reach turn 6 of that weather or screen. That is a
 * fixture limit with a number attached, which is a different thing from an unexplained inert row. */
const SRC_FILES = [
  'data/mods/champions/abilities.ts', 'data/mods/champions/moves.ts',
  'data/mods/champions/conditions.ts', 'data/mods/champions/scripts.ts',
  'data/mods/champions/rulesets.ts',
  'data/abilities.ts', 'data/moves.ts', 'data/conditions.ts', 'data/scripts.ts', 'data/rulesets.ts',
  'sim/pokemon.ts', 'sim/battle.ts', 'sim/battle-actions.ts', 'sim/field.ts', 'sim/side.ts',
];
let SRC_CACHE = null;
function srcCorpus() {
  if (SRC_CACHE) return SRC_CACHE;
  const fs = require('fs'), path = require('path');
  SRC_CACHE = [];
  for (const rel of SRC_FILES) {
    const p = path.join(SD, rel);
    let txt; try { txt = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    SRC_CACHE.push({ rel, lines: txt.split(/\r?\n/) });
  }
  /* LOUD, NOT SILENT. A corpus that failed to load would report "nothing reads this item" for every
   * row — a silent default wearing the costume of a measurement, which is the failure this repo is
   * named after. */
  if (!SRC_CACHE.length) throw new Error('fixture_preflight: could not read ANY authority source under '
    + SD + ' — the reverse item scan would silently report "read by nobody" for every row');
  return SRC_CACHE;
}
/** readByOthers(id, kind) -> [{file,line,text,fn}] — who else's code reads this item or ability.
 *  `kind` is 'item' (default) or 'ability'. Early Bird and Stall expose no handler either, and their
 *  rules live in `conditions.ts` and in the queue sorter respectively — the same shape as the rocks. */
function readByOthers(itemId, kind) {
  const k = id(itemId);
  if (!k) return [];
  const re = kind === 'ability'
    ? new RegExp('(?:hasAbility|getAbility)\\s*\\(\\s*["\']' + k + '["\']'
               + '|ability\\s*===\\s*["\']' + k + '["\']'
               + '|ability\\.id\\s*===\\s*["\']' + k + '["\']', 'g')
    : new RegExp('(?:hasItem|getItem|useItem|takeItem)\\s*\\(\\s*["\']' + k + '["\']'
                      + '|item\\s*===\\s*["\']' + k + '["\']'
                      + '|item\\.id\\s*===\\s*["\']' + k + '["\']', 'g');
  const out = [];
  for (const f of srcCorpus()) {
    for (let i = 0; i < f.lines.length; i++) {
      if (!re.test(f.lines[i])) { re.lastIndex = 0; continue; }
      re.lastIndex = 0;
      /* THE ENCLOSING FUNCTION, walked backwards to the nearest declaration at a shallower indent.
       * `durationCallback` is the one that matters and it is read, not assumed. */
      let fn = null;
      for (let j = i; j >= 0 && j > i - 40; j--) {
        const m = /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(f.lines[j]);
        if (m && !/^(if|for|while|switch|return|catch)$/.test(m[1])) { fn = m[1]; break; }
      }
      const after = f.lines.slice(i, i + 8).join(' ');
      const rets = [...after.matchAll(/return\s+(\d+)\s*;/g)].map(x => +x[1]);
      out.push({ file: f.rel, line: i + 1, text: f.lines[i].trim(), fn,
                 durations: fn === 'durationCallback' ? rets : [] });
    }
  }
  return out;
}

/* THE CLAUSE RECORD — THE SAME VERDICT, SHAPED SO A HARNESS CAN ACT ON IT.
 *
 * `why` and `note` are PROSE, written for a person reading a refusal. A caller that wants to REPAIR the
 * fixture rather than only label it — set the sky, hand the body a status, declare a gender — cannot
 * parse an English sentence for the weather id without reintroducing exactly the brittleness this file
 * exists to remove. So every clause also pushes a record naming itself, whether it blocks, what it
 * NEEDS and what the board GOT. `why` and `note` are byte-identical to what they were; this is additive
 * and the two existing consumers (million_run.js, and the callers in tests/) read only `ok/why/note`. */
function check(sc) {
  const why = [];   /* reasons the scenario CANNOT show anything */
  const note = [];  /* things worth knowing that do not block it */
  const cl = [];    /* the same, structured: {clause, blocking, need, got} */
  const sp = D.species.get(sc.species || '');
  if (!legal(sp)) { why.push('SPECIES "' + sc.species + '" is not legal in Reg M-B'
    + (sp && sp.exists ? ' (isNonstandard=' + sp.isNonstandard + ', tier=' + sp.tier + ')' : ' (not in the dex)'));
    cl.push({ clause: 'species-legal', blocking: true, got: { species: sc.species } }); }

  if (sc.ability && legal(sp)) {
    const has = Object.values(sp.abilities || {}).some(a => id(a) === id(sc.ability));
    if (!has) { why.push('"' + sp.name + '" cannot carry ' + sc.ability
      + ' — it has ' + Object.values(sp.abilities || {}).join(' / '));
      cl.push({ clause: 'ability-on-species', blocking: true,
                need: { ability: Object.values(sp.abilities || {}) }, got: { ability: sc.ability } }); }
  }

  /* THE ITEM IS PART OF THE FIXTURE AND IT WAS NOT CHECKED. Will, 2026-08-11, on Poison Heal:
   * "gliscor is in the game its just useless without its toxic orb" — and TOXIC ORB IS BANNED in
   * this format. The PREVIOUS session had already established that (its transcript reads
   * "Toxic Orb BANNED"), and it was re-derived here anyway, which is the exact cost he objected to.
   * A scenario whose whole mechanism is an item the format forbids can never run. */
  if (sc.item) {
    const it = D.items.get(sc.item);
    if (!legal(it)) { why.push('ITEM "' + sc.item + '" is not legal in Reg M-B'
      + (it && it.exists ? ' (isNonstandard=' + it.isNonstandard + ')' : ' (not in the dex)')
      + ' — if the mechanism depends on it, the scenario cannot run');
      cl.push({ clause: 'item-legal', blocking: true, got: { item: sc.item } }); }
  }

  let mv = null;
  if (sc.move) {
    mv = D.moves.get(sc.move);
    if (!legal(mv)) { why.push('MOVE "' + sc.move + '" is not legal in Reg M-B');
      cl.push({ clause: 'move-legal', blocking: true, got: { move: sc.move } }); }
    else if (!learnable().has(mv.id) && mv.id !== 'struggle') {
      why.push('MOVE "' + mv.name + '" is legal but NOTHING in this format can learn it'
        + ' — this is the clause the standard filter misses');
      cl.push({ clause: 'move-has-no-learner', blocking: true, got: { move: mv.id } }); }
    else if (legal(sp)) {
      const ls = learnsetOf(sp);
      if (!ls[mv.id]) { why.push('"' + sp.name + '" cannot learn ' + mv.name);
        cl.push({ clause: 'move-on-species', blocking: true, got: { species: sp.id, move: mv.id } }); }
    }
  }

  if (sc.target) {
    const tg = D.species.get(sc.target);
    if (!legal(tg)) { why.push('TARGET "' + sc.target + '" is not legal in Reg M-B');
      cl.push({ clause: 'target-legal', blocking: true, got: { target: sc.target } }); }
    else if (mv && legal(mv)) {
      const st = statusOf(mv);
      if (st) {
        /* A REFUSAL BY THE ABILITY UNDER TEST IS THE OBSERVABLE, NOT A BLOCKER.
         *
         * The first version of this file refused Will's OWN corrected scenario — Sleep Powder into an
         * Insomnia body — on the grounds that Insomnia refuses sleep so nothing could be seen. That is
         * exactly backwards: the refusal IS what the scenario exists to observe, and this tool had
         * just made the same category error it was written to catch.
         *
         * So the question is WHOSE immunity it is. If it comes from the ability the scenario is
         * testing, that is the point. If it comes from TYPING or from some unrelated ability, the
         * board is dead and nothing distinguishes a working engine from a broken one. */
        const imm = immuneToStatus(tg, st, sc.targetAbility);
        if (imm) {
          const testingIt = sc.targetAbility && imm.includes(D.abilities.get(sc.targetAbility).name || ' ');
          if (testingIt) note.push('the refusal by ' + D.abilities.get(sc.targetAbility).name
            + ' IS the observable — that is what this scenario tests');
          else { why.push('TARGET "' + tg.name + '" ' + imm + ' — the scenario cannot show anything');
            cl.push({ clause: 'target-status-immune', blocking: true,
                      got: { target: tg.id, status: st, reason: imm } }); }
        } else if (sc.targetAbility) {
          const ab = D.abilities.get(sc.targetAbility);
          if (ab && ab.exists) note.push('nothing refuses ' + st + ' here, so the status WILL land — '
            + 'if this scenario is meant to prove ' + ab.name + ' refuses it, the fixture is wrong');
        }
      }
      if (mv.category !== 'Status') {
        const eff = D.getEffectiveness(mv.type, tg.types);
        const noEff = !D.getImmunity(mv.type, tg.types);
        if (noEff) { why.push('TARGET "' + tg.name + '" is IMMUNE to ' + mv.type + ' — ' + mv.name + ' does nothing');
          cl.push({ clause: 'target-type-immune', blocking: true,
                    got: { target: tg.id, type: mv.type, move: mv.id } }); }
        else void eff;
      }
    }
  }
  /* THE TRIGGER CLAUSES RUN LAST, so a scenario that is illegal fails on the illegality first —
   * "this body cannot carry that ability" is a more useful sentence than "declare a gender". */
  triggerClauses(sc, sp, why, note, cl);


  return { ok: why.length === 0, why, note, clauses: cl };
}

module.exports = { check, legal, learnable, statusOf,
                   moveNeeds, satisfiesNeed, learnsetOf, EVENT_ROLE,
                   boardNeeds, readByOthers, statusesRead };

if (require.main === module) {
  const S = [
    { species: 'Banette', ability: 'Insomnia', move: 'Spore', target: 'Banette', label: "Will's rejected one" },
    { species: 'Venusaur', ability: 'Overgrow', move: 'Sleep Powder', target: 'Banette', targetAbility: 'insomnia', label: 'the replacement he gave' },
    { species: 'Jolteon', ability: 'Quick Feet', move: 'Nuzzle', target: 'Jolteon', label: "Will's other rejected one" },
    { species: 'Gliscor', ability: 'Poison Heal', move: 'Earthquake', target: 'Corviknight', label: 'disputed + a type immunity' },
  ];
  for (const s of S) {
    const r = check(s);
    console.log((r.ok ? '  CAN RUN  ' : '  REFUSED  ') + (s.label || '') );
    for (const w of r.why) console.log('             - ' + w);
  }
}
