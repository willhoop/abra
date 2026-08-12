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
function triggerClauses(sc, sp, why, note) {
  const ab = sc.ability ? D.abilities.get(sc.ability) : null;
  const src = ab && ab.exists
    ? Object.entries(ab).filter(([k, v]) => /^on/.test(k) && typeof v === 'function')
        .map(([, v]) => String(v)).join(' ')
    : '';

  /* 1. A SWITCH NEEDS A BENCH, and the engine's own slicing is the trap. */
  if (sc.switchesOut || /onSwitchOut/.test(src)) {
    const team = +sc.teamSize || 0;
    if (team && team < 3) {
      why.push('THE TRIGGER IS A SWITCH AND THIS TEAM HAS NO BENCH — `battleInit` slices its bench at '
        + '`teamA.slice(2)`, so a team of ' + team + ' puts every body on the field and the switch '
        + 'silently does nothing. Give it at least 3.');
    } else if (!team) {
      note.push('the trigger is a switch — the team needs 3+ bodies or `battleInit` leaves an empty '
        + 'bench and the switch is a no-op (declare `teamSize` and this becomes a refusal)');
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
      why.push('"' + (ab.name || sc.ability) + '" READS `.gender` and this board declares '
        + (mine || 'none') + ' against ' + (theirs || 'none') + ' — the authority\'s own guard fails '
        + 'on a genderless body, so the ability correctly does nothing and the board cannot tell that '
        + 'apart from a dead mechanic. Declare both.');
    }
  }

  /* 3. A MECHANIC THAT READS OR CURES A STATUS NEEDS ONE PRESENT. */
  if (/cureStatus|\.status\b/.test(src) && sc.targetStatus === undefined && sc.status === undefined) {
    note.push('"' + (ab.name || sc.ability) + '" reads a status — a board whose bodies are healthy '
      + 'shows nothing whatever the engine does. Declare `status` (Natural Cure read 419 identical '
      + 'leaves for exactly this reason)');
  }

  /* 4. A WEATHER- OR TERRAIN-GATED MECHANIC NEEDS THE SKY SET. */
  const wx = (src.match(/'(sunnyday|raindance|sandstorm|hail|snowscape|desolateland|primordialsea)'/g) || []);
  if (wx.length && !sc.weather) {
    note.push('"' + (ab.name || sc.ability) + '" is gated on ' + [...new Set(wx.map(w => w.replace(/'/g, '')))].join('/')
      + ' — declare `weather` or the arm is measuring an ability that is switched off');
  }
}

function check(sc) {
  const why = [];   /* reasons the scenario CANNOT show anything */
  const note = [];  /* things worth knowing that do not block it */
  const sp = D.species.get(sc.species || '');
  if (!legal(sp)) why.push('SPECIES "' + sc.species + '" is not legal in Reg M-B'
    + (sp && sp.exists ? ' (isNonstandard=' + sp.isNonstandard + ', tier=' + sp.tier + ')' : ' (not in the dex)'));

  if (sc.ability && legal(sp)) {
    const has = Object.values(sp.abilities || {}).some(a => id(a) === id(sc.ability));
    if (!has) why.push('"' + sp.name + '" cannot carry ' + sc.ability
      + ' — it has ' + Object.values(sp.abilities || {}).join(' / '));
  }

  /* THE ITEM IS PART OF THE FIXTURE AND IT WAS NOT CHECKED. Will, 2026-08-11, on Poison Heal:
   * "gliscor is in the game its just useless without its toxic orb" — and TOXIC ORB IS BANNED in
   * this format. The PREVIOUS session had already established that (its transcript reads
   * "Toxic Orb BANNED"), and it was re-derived here anyway, which is the exact cost he objected to.
   * A scenario whose whole mechanism is an item the format forbids can never run. */
  if (sc.item) {
    const it = D.items.get(sc.item);
    if (!legal(it)) why.push('ITEM "' + sc.item + '" is not legal in Reg M-B'
      + (it && it.exists ? ' (isNonstandard=' + it.isNonstandard + ')' : ' (not in the dex)')
      + ' — if the mechanism depends on it, the scenario cannot run');
  }

  let mv = null;
  if (sc.move) {
    mv = D.moves.get(sc.move);
    if (!legal(mv)) why.push('MOVE "' + sc.move + '" is not legal in Reg M-B');
    else if (!learnable().has(mv.id) && mv.id !== 'struggle')
      why.push('MOVE "' + mv.name + '" is legal but NOTHING in this format can learn it'
        + ' — this is the clause the standard filter misses');
    else if (legal(sp)) {
      const ls = learnsetOf(sp);
      if (!ls[mv.id]) why.push('"' + sp.name + '" cannot learn ' + mv.name);
    }
  }

  if (sc.target) {
    const tg = D.species.get(sc.target);
    if (!legal(tg)) why.push('TARGET "' + sc.target + '" is not legal in Reg M-B');
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
          else why.push('TARGET "' + tg.name + '" ' + imm + ' — the scenario cannot show anything');
        } else if (sc.targetAbility) {
          const ab = D.abilities.get(sc.targetAbility);
          if (ab && ab.exists) note.push('nothing refuses ' + st + ' here, so the status WILL land — '
            + 'if this scenario is meant to prove ' + ab.name + ' refuses it, the fixture is wrong');
        }
      }
      if (mv.category !== 'Status') {
        const eff = D.getEffectiveness(mv.type, tg.types);
        const noEff = !D.getImmunity(mv.type, tg.types);
        if (noEff) why.push('TARGET "' + tg.name + '" is IMMUNE to ' + mv.type + ' — ' + mv.name + ' does nothing');
        else void eff;
      }
    }
  }
  /* THE TRIGGER CLAUSES RUN LAST, so a scenario that is illegal fails on the illegality first —
   * "this body cannot carry that ability" is a more useful sentence than "declare a gender". */
  triggerClauses(sc, sp, why, note);


  return { ok: why.length === 0, why, note };
}

module.exports = { check, legal, learnable, statusOf };

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
