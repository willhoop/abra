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

  /* 3. A MECHANIC THAT READS OR CURES A STATUS NEEDS ONE PRESENT. */
  if (/cureStatus|\.status\b/.test(src) && sc.targetStatus === undefined && sc.status === undefined) {
    note.push('"' + subj + '" reads a status — a board whose bodies are healthy '
      + 'shows nothing whatever the engine does. Declare `status` (Natural Cure read 419 identical '
      + 'leaves for exactly this reason)');
    cl.push({ clause: 'status-present', blocking: false, need: { status: 'any status on the body it reads' },
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
    for (const n of nd.needs) {
      const tries = n.by === 'actor' ? [[A, myT, thT]]
                  : n.by === 'receiver' ? [[R, thT, myT]]
                  : [[A, myT, thT], [R, thT, myT]];
      const met = tries.some(([list, u, t]) =>
        list.some(m => satisfiesNeed(m, n, { userTypes: u, targetTypes: t })));
      if (met) continue;
      const what = n.kind + (n.values.length ? ' (' + n.values.join(' or ') + ')' : '');
      note.push('"' + subj + '" is gated on ' + what + ' in `' + n.handler + '`, and the '
        + n.by + ' throws nothing that supplies it — the trigger cannot be reached on this board, '
        + 'which reads exactly like a dead mechanic');
      cl.push({ clause: 'trigger-move', blocking: false,
                need: { by: n.by, kind: n.kind, values: n.values, handler: n.handler },
                got: { actor: A, receiver: R } });
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
    const eff = [...src.matchAll(/effect\??\.(?:name|id)\s*===\s*["']([A-Za-z ]+)["']/g)]
      .map(m => m[1]).filter(x => id(x) !== 'zpower');
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
  /* THE CUES WHOSE SIGN CANNOT BE READ. Recorded, never acted on — see the header. */
  if (/move\.category\s*===/.test(src)) undet.push('move.category');
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
    for (const u of c.undet) undetermined.push({ handler: k, cue: u });
    for (const n of c.needs) {
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
  switch (need.kind) {
    case 'type': return need.values.includes(mv.type);
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
                   moveNeeds, satisfiesNeed, learnsetOf, EVENT_ROLE };

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
