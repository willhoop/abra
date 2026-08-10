/* tag_dex.js — tag every move, item and ability with the PARAMETERS it sets, and check whether
 * anything actually reads them.
 *
 *   SHOWDOWN_PATH=... node engine/tag_dex.js   ->  data/tags.json
 *
 * WHY TAGS AND NOT SPECIAL CASES
 * ------------------------------
 * Will's framing, and it is better than the one this file started as: do not special-case Flower
 * Trick and Triple Axel. Compute the damage DISTRIBUTION properly and let each mechanic set its
 * parameters into it.
 *
 *     ordinary move                  P(crit) = 1/24
 *     Flower Trick / Storm Throw     P(crit) = 1
 *     Shell Armor on the defender    P(crit) = 0
 *     Dual Wingbeat                  hits = 2
 *     Bullet Seed                    hits ~ {2:35, 3:35, 4:15, 5:15}
 *     any move                       P(hit) = accuracy
 *
 * Then P(kill) is P(total damage >= remaining HP) over that whole distribution, and Focus Sash falls
 * out for free -- it only saves when the FIRST hit is lethal and the rest are not, which is exactly
 * why a multi-hit move goes through it.
 *
 * One kill formula, no special cases. A tag says "this sets that parameter", never "handle this one
 * differently".
 *
 * DERIVED, NOT TYPED (S13)
 * ------------------------
 * Everything here comes from the dex: declared fields where they exist (multihit, willCrit,
 * priority, target, flags, boosts, drain, recoil, selfSwitch) and HANDLER PROBES where they do not,
 * the same way board.js already derives ability blocks from onFoeTryMove and Contrary from
 * onChangeBoost. Nothing is hand-listed, so a mechanic cannot be missed because nobody remembered
 * it, and the tags stay correct when the format changes.
 *
 * THE THIRD COLUMN IS THE POINT
 * -----------------------------
 * Will: "AND MAKE SURE ALL THESE PARAMETERS ACTUALLY GET USED BY THE 48 FEATURES OR WHATEVER."
 *
 * A tag nobody reads is a prettier version of the bugs found on 2026-07-28 -- the player that never
 * read a team sheet, the joint layer that fell back on every turn, the mega that never fired. So
 * every tag carries `consumedBy`: the board.js feature or damage-engine term that reads it, or the
 * string UNUSED. The report sorts by usage share, so what is unread and common is at the top.
 *
 * `consumedBy` is CHECKED, not asserted: for each tag a probe string is grepped out of
 * engine/board.js and engine/medicham2-browser.js. A tag whose probe is absent from both is UNUSED
 * however confident the comment above it sounds.
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

if (!process.env.SHOWDOWN_PATH) { console.error('set SHOWDOWN_PATH'); process.exit(2); }
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

/* The two files that would have to read a parameter for it to reach a decision. */
const BOARD = fs.readFileSync(D('engine', 'board.js'), 'utf8');
const DMG = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
const readsIt = probe => (BOARD.includes(probe) || DMG.includes(probe));

/* ---- USAGE, so the report is ordered by what actually turns up ------------------------------- */
let F_GAMES = null;                 /* kept so the mega-reachable sweep can reuse the same corpus */
function usage() {
  const out = { move: {}, item: {}, ability: {}, entries: 0 };
  let F; try { F = require('./fit_policy.js'); } catch (e) { return out; }
  /* SCOPE 'all', STATED, BECAUSE THIS IS A CATALOGUE AND NOT A FIT. data/tags.json records WHAT
   * EXISTS in the format — every move, ability and item, with how often the corpus has seen it. A
   * training sample deliberately narrows to the distribution you want to learn; a catalogue must not,
   * because a narrowing DELETES entries rather than reweighting them.
   *
   * This line used to inherit fit_policy's default. When that default became bo3-only (for the fit,
   * correctly), this file's sheet_entries fell 110,760 -> 78,480 and a regeneration would have removed
   * SERENE GRACE, TINTED LENS, CURIOUS MEDICINE, STEELY SPIRIT and LEPPA BERRY from the engine's
   * knowledge entirely — silently, because a missing entry looks the same as a mechanic that does not
   * exist. ROADMAP #65. Asking out loud is the fix; inheriting was the bug.
   *
   * The catch stays because a missing corpus must not stop the dex being derived from Showdown — but
   * it now says so instead of returning an empty usage map that reads like "nothing is used". */
  let games;
  try { games = F.loadCorpus({ scope: 'all' }).games; }
  catch (e) {
    console.error('tag_dex: loadCorpus({scope:"all"}) failed, so USAGE COUNTS WILL BE ZERO for every '
      + 'entry in this run — the tag SHAPES are still derived from Showdown and are unaffected. '
      + 'Reason: ' + String((e && e.message) || e).split('\n')[0].slice(0, 120));
    return out;
  }
  F_GAMES = games;
  for (const g of games) {
    for (const side of ['p1', 'p2']) {
      for (const e of (g.sheets && g.sheets[side]) || []) {
        out.entries++;
        if (e.item) out.item[norm(e.item)] = (out.item[norm(e.item)] || 0) + 1;
        if (e.ability) out.ability[norm(e.ability)] = (out.ability[norm(e.ability)] || 0) + 1;
        for (const m of e.moves || []) out.move[norm(m)] = (out.move[norm(m)] || 0) + 1;
      }
    }
  }
  return out;
}

/* PARAMETER EXTRACTION -- because a boolean is not a parameter.
 *
 * Will, across several messages: "does swift swim need the rain marker", "solar power needs a
 * weather variable check", "damage reduce multiscale if at 100", "do we need to specify that clear
 * body is just a better hyper cutter".
 *
 * All the same defect. A whole class of tags was storing `{conditional: true}` or `{boost: true}` --
 * recording THAT a condition exists without saying what it is. Swift Swim did not name rain,
 * Multiscale did not say full HP, Clear Body and Hyper Cutter were indistinguishable despite one
 * blocking every stat and the other only Attack.
 *
 * A tag that says "something applies here" cannot be consumed by anything. These read the handler
 * and return the actual numbers. */
const WEATHER = { raindance: 'rain', primordialsea: 'heavy rain', sunnyday: 'sun',
  desolateland: 'harsh sun', sandstorm: 'sand', hail: 'hail', snowscape: 'snow', snow: 'snow' };
/* ONE MAP FOR THE ENGINE'S VOCABULARY, and this file had THREE. 2026-08-04, found by the weather
 * audit's grep for survivors.
 *
 * `WEATHER` above is a DISPLAY map -- it keeps `heavy rain`, `harsh sun` and `hail` as distinct
 * English names because it is describing a handler to a reader. The map that matters is this one: the
 * words `medicham2-browser.js` actually compares against, which are four and only four. The two
 * copies that used to sit inside `weatherScaled` and `weatherSetter` were identical to each other and
 * NOT to the display map -- `hail` was 'hail' in one and 'snow' in the others -- which is exactly the
 * split that made the leaf boundary meaningless. Both now read this.
 *
 * PRIMORDIAL SEA AND DESOLATE LAND MAP ONTO PLAIN RAIN AND SUN, and that is a DECISION with a number
 * behind it: 0 occurrences in 339,483 boards. See docs/ENGINE.md — they are unimplemented until a
 * primal Kyogre or Groudon enters the format. */
const W2ENGINE = { sunnyday: 'sun', desolateland: 'sun', raindance: 'rain', primordialsea: 'rain',
                   sandstorm: 'sand', hail: 'snow', snowscape: 'snow', snow: 'snow' };

function weatherIn(src) {
  const found = [];
  for (const k in WEATHER) if (new RegExp('"' + k + '"').test(src)) found.push(WEATHER[k]);
  return [...new Set(found)];
}
function multiplierIn(src) {
  /* Showdown writes x1.3 two ways: chainModify(1.3) and chainModify([5325, 4096]) -- the exact
   * 4096ths form. Only the first was read, so every ability using the exact form (Tough Claws,
   * Sharpness, Strong Jaw...) carried no multiplier at all. */
  const m = src.match(/chainModify\(\s*([\d.]+)\s*\)/);
  if (m) return +m[1];
  const a = src.match(/chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/);
  return a ? +(((+a[1]) / (+a[2])).toFixed(3)) : null;
}
/* ROADMAP #112 -- THE HP GATE IS A STRUCTURE NOW, NOT A SENTENCE.
 *
 * This returned PROSE ("only below 1/3 HP") and that single fact is why Blaze, Torrent, Overgrow and
 * Swarm -- 8,524 corpus uses between them -- had never fired. medicham2's `damageBoost` consumer
 * gated on `!_db.onlyWhen`, refusing any member carrying a condition it could not evaluate. THAT
 * REFUSAL WAS CORRECT (ROADMAP #92: a guessed threshold is the boolean-in-a-fraction's-clothing
 * defect, and failing closed beats inventing one). The defect was that nobody ever made the condition
 * readable, so the refusal was permanent -- and the consumer ended up armed for five abilities with
 * ZERO corpus uses and closed against the four everybody runs.
 *
 * DERIVED BY SHAPE, NEVER BY NAME. Showdown writes the gate as `attacker.hp <= attacker.maxhp / 3`,
 * and that expression IS the specification. A pinch ability added next regulation at 1/4 is picked up
 * with no engine edit, which is docs/TAGS.md's standing rule and the opposite of the hand-maintained
 * list this repository keeps being burned by.
 *
 * THE FRACTION IS KEPT AS num/den AND NEVER COLLAPSED TO A FLOAT. `hp <= maxhp * (1/3)` is NOT the
 * same predicate as `hp <= maxhp / 3`: the nearest double to 1/3 is below it, so 150 * (1/3) is
 * 49.999999999999993 and a body at exactly 50 -- one third of 150 -- would be refused the boost it is
 * owed. A consumer holding num and den can ask `hp*den <= maxhp*num` in integers and be exactly
 * right at the boundary, which is the one HP that decides games.
 *
 * `says` carries the old prose so anything that PRINTED this still reads, and so the structure is
 * self-describing in the artifact.
 *
 * WHAT IT MATCHES, PRINTED BEFORE IT WAS BELIEVED (docs/LESSONS §4), over every standard ability and
 * item in the format: blaze 1/3, defeatist 1/2, overgrow 1/3, swarm 1/3, torrent 1/3 on the `<=`
 * side; multiscale and shadowshield on the `>=` side; NO items and NO denominator of two or more
 * digits. The regex takes `\d+` rather than the old `\d` so it agrees with the one
 * `tests/roster.js`'s `ability/pinch-offense` rule reads the same handler with -- two readers of one
 * fact must not disagree, and `tests/test-pinch-family.js` asserts they do not. */
function hpGateIn(src) {
  const G = (cmp, num, den, says) => ({ cond: 'hpFraction', of: 'self', cmp, num, den, says });
  if (/hp\s*>=\s*\w+\.maxhp/.test(src)) return G('>=', 1, 1, 'only at full HP');
  const le = /hp\s*<=\s*\w+\.maxhp\s*\/\s*(\d+)/.exec(src);
  if (le) return G('<=', 1, +le[1], 'only below 1/' + le[1] + ' HP');
  return null;
}
function statusIn(src) {
  /* A LIST, because a handler can inflict more than one status. Effect Spore is a single
   * this.random(100) split three ways -- 11% sleep, 10% paralysis, 9% poison -- and the first
   * version of this function matched the first trySetStatus, found no randomChance, and recorded
   * "sleep, chance 1". A 100%-sleep Effect Spore is not a smaller error than no tag at all; it is
   * a larger one. The list entries are EXCLUSIVE branches of one roll, so their chances sum to the
   * total proc rate and a consumer must roll once against the cumulative, not once per entry. */
  const NAME = { par: 'paralysis', brn: 'burn', psn: 'poison', tox: 'bad poison', frz: 'freeze', slp: 'sleep' };
  const den = +((src.match(/this\.random\(\s*(\d+)\s*\)/) || [])[1] || 0);
  const rc = src.match(/randomChance\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  const out = [];
  let prev = 0, pending = null;
  for (const tok of src.matchAll(/<\s*(\d+)\s*\)|trySetStatus\(\s*"(\w+)"/g)) {
    if (tok[1] != null) { pending = +tok[1]; continue; }
    let chance = 1;
    if (den && pending != null) { chance = (pending - prev) / den; prev = pending; pending = null; }
    else if (rc) chance = +rc[1] / +rc[2];
    out.push({ status: NAME[tok[2]] || tok[2], chance: +chance.toFixed(4) });
  }
  return out.length ? out : null;
}
function statsBlockedIn(src) {
  /* Clear Body deletes every negative boost; Hyper Cutter names one stat. */
  if (/for \(i in boost\)|for \(const i in boost\)/.test(src)) return 'all stats';
  const named = [...src.matchAll(/boost\.(atk|def|spa|spd|spe|accuracy|evasion)/g)].map(m => m[1]);
  return named.length ? [...new Set(named)].join('/') : null;
}

/* WHO DOES THE EFFECT LAND ON? -- the derivation behind buffsHolderOnHit / punishesAttacker.
 *
 * Showdown names the recipient in the call itself, so this reads it rather than matching ability
 * names. The one rule worth knowing: `this.boost({...})` with NO second argument defaults to the
 * ABILITY HOLDER, which is how Stamina and Justified are written -- an earlier regex demanded an
 * explicit `target` and therefore missed the single most common member of its own category.
 *
 * Field-level responses (Toxic Debris laying spikes, Sand Spit setting weather) count as punishing
 * the attacker: they are a cost imposed for having attacked, and they do not compound on the holder.
 */
function effectRecipients(a) {
  const src = String(a.onDamagingHit || '') + String(a.onHit || '');
  const out = { holder: false, attacker: false };
  if (!src) return out;
  const mark = who => { if (!who || who === 'target') out.holder = true; else if (who === 'source') out.attacker = true; };
  for (const m of src.matchAll(/this\.boost\(\s*\{[^}]*\}\s*(?:,\s*([A-Za-z_$][\w$]*))?/g)) mark(m[1]);
  for (const m of src.matchAll(/this\.(?:damage|heal)\([^,)]*(?:,\s*([A-Za-z_$][\w$]*))?/g)) mark(m[1]);
  for (const m of src.matchAll(/\b(target|source)\.(?:addVolatile|trySetStatus|setStatus)\(/g)) mark(m[1]);
  if (/sideCondition|setWeather/.test(src)) out.attacker = true;
  return out;
}

/* ROADMAP #101 -- WHAT THE INCOMING HIT HAS TO BE, read out of the handler's own `if`.
 *
 * `buffsHolderOnHit` carried WHAT the holder gains and never WHEN, so medicham2 applied every
 * member's boosts on every connecting hit: Anger Point maxed Attack off a Tackle, Justified fired on
 * a Waterfall, Weak Armor on a Surf. That is the opposite failure from the pinch family (#112, which
 * failed CLOSED) -- this one has been producing a wrong answer live.
 *
 * `condHolds(w, self)` in medicham2 asks about the HOLDER. Every condition here is about the
 * INCOMING MOVE instead, so it is a different predicate and gets its own field (`when`) rather than
 * being crammed into `onlyWhen` where a holder-shaped reader would try to evaluate it.
 *
 * FIVE SHAPES AND NO SIXTH, all measured off the eight members on 2026-08-09:
 *     crit          angerpoint      target.getMoveHitData(move).crit
 *     moveCategory  weakarmor       move.category === "Physical"
 *     moveType      justified       move.type === "Dark"   /   ["Dark","Bug","Ghost"].includes(...)
 *     moveFlag      windpower       move.flags["wind"]  --  and checkMoveMakesContact, which IS the
 *                                   contact flag spelled as a call (perishbody)
 *     (none)        stamina         no gate at all -- and stamina is 2,760 of the family's uses, so
 *                                   a null return here must stay meaning "unconditional" and not
 *                                   "unreadable". An unreadable shape would have to be a new branch.
 * The order is exact-before-general: the contact CALL is tested before the generic flags[...] read,
 * because a handler can carry both. */
function hitCondIn(src) {
  let m;
  if (/getMoveHitData\(\s*\w+\s*\)\.crit/.test(src)) return { cond: 'crit', says: 'only on a critical hit' };
  if ((m = /move\.category\s*===\s*"(\w+)"/.exec(src)))
    return { cond: 'moveCategory', is: [m[1]], says: 'only a ' + m[1] + ' hit' };
  if ((m = /\[([^\]]*)\]\s*\.includes\(\s*move\.type\s*\)/.exec(src))) {
    const list = [...m[1].matchAll(/"(\w+)"/g)].map(x => x[1]);
    if (list.length) return { cond: 'moveType', is: list, says: 'only a ' + list.join('/') + ' hit' };
  }
  if ((m = /move\.type\s*===\s*"(\w+)"/.exec(src)))
    return { cond: 'moveType', is: [m[1]], says: 'only a ' + m[1] + ' hit' };
  if (/checkMoveMakesContact/.test(src)) return { cond: 'moveFlag', is: ['contact'], says: 'only on contact' };
  if ((m = /move\.flags\[\s*"(\w+)"\s*\]/.exec(src)))
    return { cond: 'moveFlag', is: [m[1]], says: 'only a ' + m[1] + '-flagged hit' };
  return null;
}

/* WHAT EXTENDS WHAT -- built by inverting the durationCallback references, per Will on Damp Rock.
 * The item carries no field naming its effect; each CONDITION names the item instead. */
const EXTENDERS = {};
{
  const note = (src, label) => {
    if (!/hasItem/.test(src)) return;
    const it = (src.match(/hasItem\(\s*["'](\w+)["']\s*\)/) || [])[1];
    const turns = +(src.match(/return\s+(\d+)/) || [])[1];
    if (!it || !turns) return;
    const e = EXTENDERS[it] || (EXTENDERS[it] = { what: [], turns });
    if (!e.what.includes(label)) e.what.push(label);
  };
  for (const m of dex.moves.all()) {
    if (!m || !m.exists) continue;
    note(String((m.condition || {}).durationCallback || ''), m.name);
  }
  for (const id of ['raindance', 'sunnyday', 'sandstorm', 'snowscape', 'snow', 'hail']) {
    let c; try { c = dex.conditions.get(id); } catch (e) { continue; }
    if (c && c.exists) note(String(c.durationCallback || ''), id);
  }
}

/* ---- THE TAXONOMY ---------------------------------------------------------------------------
 * Each tag: what parameter it sets, how it is derived, and the probe that proves something reads it.
 * `param` is deliberately phrased as a value a distribution can consume, not as an instruction. */
/* P(this move applies that status), covering BOTH the dedicated status move and the secondary
 * effect on a damaging one -- Will: "so matcha gotcha and flare blitz get one as well as will o". */
function statusOdds(m, st) {
  if (m.status === st) return { p: (m.accuracy === true ? 1 : (m.accuracy || 100) / 100), via: 'primary' };
  let p = null;
  for (const sec of (m.secondaries || [])) if (sec && sec.status === st) p = (sec.chance || 100) / 100;
  if (m.secondary && m.secondary.status === st) p = (m.secondary.chance || 100) / 100;
  /* AND FROM A PROTECT-FAMILY CONDITION. Will: "baneful bunker spreads poison". Its poison lives in
   * the move's own condition.onHit, not in status or secondaries, so reading only those missed it --
   * and Spiky Shield's chip damage is in exactly the same place. */
  if (p === null && m.condition && m.condition.onHit && new RegExp(st, 'i').test(String(m.condition.onHit))) {
    p = 1; return { p, via: 'contact with the shield' };
  }
  return p === null ? null : { p, via: 'secondary' };
}

/* THE PARTIAL TRAP, READ OFF SHOWDOWN'S OWN CONDITION RATHER THAN TYPED.
 *
 * Every number here used to be a literal in the tag below, and the one that mattered was WRONG in a
 * way no amount of re-reading the literal would reveal: `turns: '4-5'` is how long the trap is FELT,
 * while the thing the engines are compared on is Showdown's `duration`, which starts at 5 and is
 * decremented in the residual of the turn the trap LANDS.
 *
 * Fail loudly rather than fall back. A silent default here is how a wrong constant lives for months —
 * if the condition stops parsing, the tag must go absent so `condHolds`-style consumers refuse, which
 * is #92's rule and the reason the pinch family's refusal was correct for as long as it lasted. */
let _ptShape;
function partialTrapShape() {
  if (_ptShape !== undefined) return _ptShape;
  _ptShape = null;
  let c; try { c = dex.conditions.get('partiallytrapped'); } catch (e) { return _ptShape; }
  if (!c || !c.duration) return _ptShape;
  const cb = String(c.durationCallback || '');
  const st = String(c.onStart || '');
  /* `return this.random(5, 7)` — Showdown's random(lo,hi) is [lo,hi), so 5 or 6. */
  const rng = cb.match(/this\.random\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  /* `if (source?.hasItem("gripclaw")) return 8` */
  const claw = cb.match(/hasItem\(\s*["'](\w+)["']\s*\)\s*\)?\s*return\s+(\d+)/);
  /* `this.effectState.boundDivisor = source.hasItem("bindingband") ? 6 : 8` */
  const div = st.match(/boundDivisor\s*=\s*\w+\.hasItem\(\s*["'](\w+)["']\s*\)\s*\?\s*(\d+)\s*:\s*(\d+)/)
           || st.match(/boundDivisor\s*=\s*(\d+)/);
  if (!div) return _ptShape;
  const base = div.length === 4 ? +div[3] : +div[1];
  _ptShape = {
    /* KEPT, unchanged, and it is a DIFFERENT question from `duration` — how many turns of chip the
     * trapped side actually feels. Nothing reads it; removing it would silently repurpose the name. */
    turns: '4-5',
    /* THE COUNTER THE AUTHORITY HOLDS. This is what a board comparison reads. */
    duration: c.duration,
    durationRange: rng ? [+rng[1], +rng[2] - 1] : null,
    durationItem: claw ? { item: claw[1], duration: +claw[2] } : null,
    /* Decremented in the residual of the turn it lands, so it reads `duration - 1` at that turn's end. */
    ticksOnLandingTurn: true,
    chipPerTurn: 1 / base,
    chipItem: div.length === 4 ? { item: div[1], chipPerTurn: 1 / +div[2] } : null,
  };
  return _ptShape;
}

/* THE LOCK-IN, READ OFF THE CONDITION THE MOVE NAMES. See the long comment on the `locksIntoMove`
 * entry below for the derivation of every number here and for the over-match that was printed first.
 *
 * FAILS LOUDLY RATHER THAN FALLING BACK, the same rule partialTrapShape follows: if the condition
 * stops parsing the tag goes ABSENT, so the engine's `TAGS.param(...)` returns null and its lock
 * branch declines instead of inventing a duration. A silent default here would be a made-up number of
 * forced turns, which is worse than no lock at all. */
function lockShape(m) {
  const vol = m && m.self && m.self.volatileStatus;
  if (!vol) return null;
  /* IT SPEAKS. An unreadable condition here means the tag goes absent and five moves silently stop
   * locking — the exact "capability absent, everything reports success" shape, so the reason is
   * printed rather than discarded (tests/test-no-silent-failure.js). */
  let c;
  try { c = dex.conditions.get(vol); }
  catch (e) {
    console.error('tag_dex: lockShape could not read condition "' + vol + '" for ' + (m && m.id)
      + ', so the lock-in tag is ABSENT for it. Reason: '
      + String((e && e.message) || e).split('\n')[0].slice(0, 120));
    return null;
  }
  if (!c || !c.onLockMove) return null;
  /* THE DISCRIMINATOR. `mustrecharge` also answers onLockMove and is the opposite mechanic; it is the
   * one member of the eleven that REFUSES the forced action (`onBeforeMove` -> `cant` -> null). */
  if (c.onBeforeMove) return null;
  if (!c.duration) return null;
  const start = String(c.onStart || '');
  const end = String(c.onEnd || '');
  /* `this.effectState.trueDuration = this.random(2, 4)` -- Showdown's random(lo,hi) is [lo,hi), so the
   * range is 2..3. Absent (Uproar) the declared duration IS the number of forced turns. */
  const tr = start.match(/trueDuration\s*=\s*this\.random\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  const turnsMin = tr ? +tr[1] : c.duration;
  const turnsMax = tr ? +tr[2] - 1 : c.duration;
  /* WHICH move the lock repeats. A function reading `effectState.move` repeats whatever applied it; a
   * string names one outright (Uproar). */
  const lk = c.onLockMove;
  const repeats = typeof lk === 'string' ? lk
                : (/effectState\.move/.test(String(lk)) ? 'self' : null);
  if (!repeats) return null;
  return {
    volatile: vol,
    /* THE COUNTER THE AUTHORITY DECLARES. Recorded, and deliberately NOT the field to consume -- for
     * `lockedmove` it is a re-armable two-turn window and not the length of anything. */
    duration: c.duration,
    /* THE NUMBER OF TURNS THE USER IS FORCED TO ATTACK, and the field the engine reads. The minimum of
     * the authority's own range, for the reason CONFUSION_TURNS_MIN gives. */
    turns: turnsMin,
    turnsMin, turnsMax,
    repeats,
    /* Fatigue: onEnd's own addVolatile call, and the guard immediately above it. */
    confuseOnEnd: /addVolatile\(\s*["']confusion["']\s*\)/.test(end),
    confuseNeedsFullRun: /trueDuration\s*>\s*1\s*\)?\s*return/.test(end),
    /* UPROAR'S TWO EXTRA RULES, both off handlers. The move's own onTryHit sweeps every active body and
     * calls cureStatus on anything asleep; the condition's onAnySetStatus returns null for slp. */
    wakesSleepers: /status\s*===\s*['"]slp['"][\s\S]*cureStatus\(/.test(String(m.onTryHit || '')),
    blocksSleep: /status\.id\s*===\s*['"]slp['"]/.test(String(c.onAnySetStatus || '')),
  };
}

/* WIRE 151 -- THE PROCEDURAL STAT-CHANGE OPERATION, derived from the handler's own shape.
 *
 * `statChangeInCode` could say only "there is a stage table in here somewhere" and hand back the
 * table when it found one. Five moves have no table at all because they are OPERATIONS over an
 * existing boost vector, and this is where that operation is read. Its whole output is a descriptor:
 *
 *   { kind:'exchange',  stats, between:['user','target'] }   Guard Swap, Power Swap (Heart Swap)
 *   { kind:'copy',      stats, from:'target', to:'user' }    Psych Up
 *   { kind:'invert',    stats, on:'target', nonzeroOnly }    Topsy-Turvy
 *   { kind:'randomOne', stats, on:'target', amount, below }  Acupressure
 *
 * `stats` is an explicit array when the handler names one and the string 'all' when it iterates the
 * whole vector. NOTHING IS INVENTED: `amount` comes back null if the assignment cannot be read, and a
 * consumer must refuse a null rather than reach for a plausible 2.
 *
 * THE `randomOne` GUARD IS THE OVER-MATCH FIX AND IT IS LOAD-BEARING. `this.sample(` alone matched
 * SLEEP TALK, Metronome, Assist and Conversion 2 -- the sampler is Showdown's generic random pick and
 * three of those four choose a MOVE, not a stat. So the rule also demands the candidate list be
 * filtered by a `.boosts[...] < N` ceiling and the handler actually call `this.boost(`, which is the
 * shape of a stat pick. Measured over all 954 moves in the format after the guard: six matches, and
 * every one of them is a stat operation. */
const OP_STAT = 'atk|def|spa|spd|spe|accuracy|evasion';
function statSubsetIn(s) {
  /* An array literal made of NOTHING BUT stat names. Psych Up's `["dragoncheer","focusenergy",...]`
   * is right beside its stat loop and must not be mistaken for one, which is why this is an
   * all-or-nothing match rather than a scan for stat names. */
  const arr = s.match(new RegExp('\\[\\s*"(?:' + OP_STAT + ')"(?:\\s*,\\s*"(?:' + OP_STAT + ')")*\\s*\\]'));
  if (arr) return arr[0].match(new RegExp('"(' + OP_STAT + ')"', 'g')).map(x => x.replace(/"/g, ''));
  /* `for (i in target.boosts)` is the authority's own way of saying ALL SEVEN, accuracy and evasion
   * included. Carried as the string 'all' rather than expanded here, so the consumer reads the
   * body's real vector instead of a list this file guessed at. */
  if (/for\s*\(\s*(?:const\s+|let\s+)?\w+\s+in\s+target\.boosts\s*\)/.test(s)) return 'all';
  return null;
}
function STAT_OP(h) {
  const s = String(h).replace(/\s+/g, ' ');
  /* EXCHANGE: both bodies are written with setBoost, each from the other's saved vector. */
  if (/\bsource\.setBoost\(/.test(s) && /\btarget\.setBoost\(/.test(s))
    return { kind: 'exchange', stats: statSubsetIn(s), between: ['user', 'target'] };
  /* COPY: one direction only, straight assignment out of the target's vector into the source's. */
  if (/\bsource\.boosts\[\s*\w+\s*\]\s*=\s*target\.boosts\[\s*\w+\s*\]/.test(s))
    return { kind: 'copy', stats: statSubsetIn(s), from: 'target', to: 'user' };
  /* INVERT: the target's own slot assigned its own negation. `nonzeroOnly` is the handler's `continue`
   * guard, and it is the difference between a move that fails on an empty vector and one that does
   * nothing quietly -- Showdown returns false when no stage moved. */
  if (/\btarget\.boosts\[\s*(\w+)\s*\]\s*=\s*-\s*target\.boosts\[\s*\1\s*\]/.test(s))
    return { kind: 'invert', stats: statSubsetIn(s), on: 'target',
             nonzeroOnly: /boosts\[\s*\w+\s*\]\s*===\s*0\s*\)\s*continue/.test(s) };
  if (/this\.sample\(/.test(s) && /this\.boost\(/.test(s)) {
    const ceil = s.match(/\.boosts\[\s*\w+\s*\]\s*<\s*(\d+)/);
    if (!ceil) return null;                       // the over-match guard: no stat ceiling, no stat pick
    const amt = s.match(/\[\s*\w+\s*\]\s*=\s*(-?\d+)\s*;\s*this\.boost\(/);
    return { kind: 'randomOne', stats: statSubsetIn(s), on: 'target',
             amount: amt ? +amt[1] : null, below: +ceil[1] };
  }
  return null;
}

/* HOW MANY LAYERS A NAMED SIDE HAZARD STACKS TO, read out of the authority's own condition.
 *
 * ONE FUNCTION, because two consumers need the same fact from opposite directions: the `hazard` tag
 * asks about the hazard a status move DECLARES, and `hazardOnHit` asks about the hazard a damaging
 * move NAMES INSIDE ITS HANDLER. A second copy of this rule would eventually disagree with the first
 * and nothing would notice, which is the failure CLAUDE.md's "facts are global" rule exists to stop.
 *
 * THE RULE IS STRUCTURAL AND HAS NO NAME LIST IN IT. Showdown lets a side condition be re-laid only
 * if its condition declares `onSideRestart`, and that handler carries its own ceiling as a literal:
 *
 *     onSideRestart(side) { if (this.effectState.layers >= 3) return false; ... layers++; }
 *
 * So: no `onSideRestart` -> the condition cannot be re-laid -> the cap is exactly 1. With one -> the
 * cap is the number the handler tests. NULL is returned when a handler exists and its ceiling cannot
 * be read, and that is deliberate: a consumer must be able to tell "no cap stated" from "a cap of 1",
 * because guessing 1 would delete real Spikes layers.
 *
 * Measured over every move in the format the day it was written: spikes 3, toxicspikes 2,
 * stealthrock 1, stickyweb 1. */
function hazardCap(cond) {
  let c; try { c = dex.conditions.get(cond); } catch (e) { return null; }
  const rs = String((c && c.onSideRestart) || '');
  if (!rs) return 1;
  const mm = rs.match(/layers\s*>=\s*(\d+)/);
  if (!mm) {
    console.error('tag_dex: "' + cond + '" has an onSideRestart whose ceiling could not be read; '
      + 'emitting maxLayers: null rather than guessing.');
    return null;
  }
  return +mm[1];
}

const MOVE_TAGS = [
  /* NEW 2026-08-08 -- THE MOVE THAT SPENDS THE USER'S OWN ITEM, and it is the mirror image of
   * `removesItem` rather than a member of it: Knock Off takes what the TARGET holds, this throws what
   * the USER holds. One shared question underneath — can this item leave this body right now — asked
   * from opposite sides.
   *
   * DERIVED ON THE HANDLER READING `item.fling`, which is the field the `flingable` item tag carries,
   * so the move and the item are joined by the artifact rather than by a name here. Membership over
   * the whole move table is exactly ONE move (Fling, 31 uses) and it was printed before this was
   * wired.
   *
   * THE ORDER INSIDE `onPrepareHit` IS THE MECHANIC AND IS RECORDED AS PARAMS: `TakeItem` is asked
   * FIRST and a refusal fails the whole move, THEN the item must have a fling entry, and only THEN
   * is `move.basePower` written from the item. A consumer that spent the item but kept a fixed base
   * power would be wrong in a way the board shows, so `powerFromItem` is stated rather than implied. */
  { tag: 'flingsOwnItem', param: 'the USER\'s held item is thrown: it decides the power and it is spent',
    probe: 'flingsOwnItem',
    why: 'Fling. The engine had it `untagged` at 0 base power, so it dealt nothing, consumed nothing '
       + 'and inflicted none of the item\'s own status',
    of: m => /\bitem\.fling\b/.test(String(m.onPrepareHit || ''))
      ? { powerFromItem: true, consumes: true,
          failsIfItemRefusesTake: /singleEvent\(\s*['"]TakeItem['"]/.test(String(m.onPrepareHit)),
          failsIfNotFlingable: /!item\.fling/.test(String(m.onPrepareHit)) } : null },
  { tag: 'multiHit', param: 'hits = n (or a distribution)', probe: 'multihit',
    why: 'total damage is n x base, and it BREAKS Focus Sash and Sturdy -- the first hit takes the holder to 1, the rest kill',
    /* HOW MANY, and until 2026-08-04 the param said only "fixed". A consumer therefore could not tell
     * Dual Wingbeat (2) from Triple Axel (3) from POPULATION BOMB (10), and medicham2's
     * expectedHitsOf defaulted every one of them to 2 -- so the format's largest multi-hit move was
     * priced at a fifth of its damage. The dex declares the number; read it. */
    of: m => m.multihit ? { readFrom: 'm.multihit',
      distribution: Array.isArray(m.multihit) ? '2:35 3:35 4:15 5:15' : 'fixed',
      hits: Array.isArray(m.multihit) ? null : +m.multihit,
      range: Array.isArray(m.multihit) ? m.multihit.slice() : null } : null },
  /* WHICH BODY EACH HIT GOES TO, which `multiHit` above cannot say. `hitStepMoveHitLoop` sets
   * `targetsCopy = [targets[hit - 1]]` when `move.smartTarget` (sim/battle-actions.ts:896), and
   * `Pokemon#getSmartTargets` builds the array as [aimed foe, its living partner] -- so in doubles
   * Dragon Darts is two 50 BP darts at two different bodies and the partner is NOT covered by the
   * spread reduction, because `move.spreadHit` is only set `if (targets.length > 1 && !move.smartTarget)`
   * (:551). One packet cannot be aimed at two bodies, so this engine put both darts into the aimed
   * foe and the partner took literally nothing.
   *
   * DERIVED FROM THE DEX FIELD AND NOT FROM A NAME. `m.smartTarget` is declared exactly once in
   * data/moves.ts (dragondarts, :4129) and is the only carrier legal in this format -- measured, not
   * assumed -- but it is a FIELD, so a second one arriving needs no edit here or in the engine.
   * The fallbacks in `getSmartTargets` are what make it conditional rather than a second spread
   * move: no partner, or a fainted partner, sets `move.smartTarget = false` and every hit goes back
   * into the aimed body. */
  { tag: 'smartTarget', param: 'hit n is aimed at targets[n-1] -- the hits SPLIT across the target and its partner', probe: 'smartTarget',
    why: 'Dragon Darts (126 uses). Both darts landed on the aimed foe and its partner took ZERO, so the move was priced as a single-body 2x hit',
    of: m => m.smartTarget
      ? { splitsAcrossPartner: true, spreadReduced: false,
          hits: Array.isArray(m.multihit) ? null : (+m.multihit || 2) } : null },
  /* Will, 2026-07-29: "most gambit use defiant but the supreme overlord needs a count of the dead
   * like last respects ... and i think that only works on first switchin, then the status is tuck".
   * Both right, and both read from the handlers: Last Respects is 50 + 50 x side.totalFainted read
   * LIVE at each use; Supreme Overlord snapshots min(totalFainted, 5) at switch-in into its own
   * effectState and never updates while out. Same counter, opposite freshness — a tag that did not
   * say which would have Kingambit's boost climbing mid-stay. */
  { tag: 'powerFromFallen', param: 'BP = base + per x fallen allies, read LIVE', probe: 'lastrespects',
    why: 'Last Respects sits in the pool at a flat 50 — the 50-per-death half was invisible. The '
       + 'taxonomy already knew: it carries needsUntrackedState because no death counter existed',
    of: m => {
      const src = String(m.basePowerCallback || '');
      const p = src.match(/return\s*(\d+)\s*\+\s*(\d+)\s*\*\s*\w+\.side\.totalFainted/);
      return p ? { base: +p[1], perFallen: +p[2], counts: 'live' } : null;
    } },
  { tag: 'alwaysCrit', param: 'P(crit) = 1', probe: 'willCrit',
    why: 'x1.5 and ignores the defender\'s positive defensive boosts',
    of: m => m.willCrit ? { pCrit: 1 } : null },
  { tag: 'critRatioUp', param: 'P(crit) raised', probe: 'critRatio',
    why: 'a higher crit stage, which the damage distribution should weight rather than ignore',
    of: m => (m.critRatio && m.critRatio > 1 && !m.willCrit) ? { critRatio: m.critRatio } : null },
  /* Will: "do we have the terrain and weather attacks like expanding force and weather ball".
   * Weather Ball is 4,699 uses -- it changes TYPE, POWER and TARGET with the weather.
   *
   * THE OLD PARAM WAS {scalesWith:'weather'} -- a boolean wearing a param's clothes. It named
   * neither WHICH weather nor WHAT changes, so nothing could ever consume it, and the membership
   * itself was wrong: Solar Beam's halving lives in onBasePower and its charge skip in onTryMove,
   * neither of which the old probe read, so the move the handoff names was not even a member.
   * byWeather is keyed sun/rain/sand/snow and each entry says exactly what that weather does:
   * type, bpMult, accuracy, boosts, healFraction, chargeSkip -- all read from four handler idioms
   * (the effectiveWeather switch, the includes() gate, isWeather(), and the weakWeathers array),
   * never from a move list. */
  { tag: 'weatherScaled', param: 'byWeather: WHICH weather changes WHAT (type / power / accuracy / boosts / heal / charge)', probe: 'weatherBall',
    why: 'Weather Ball (4,699), Thunder, Hurricane, Blizzard, Solar Beam (2,477), Growth, and the '
       + 'weather heals. The engine cannot price "it depends on the weather"; it can price x2 in sand',
    of: m => {
      const W2K = W2ENGINE;
      const by = {};
      const put = (ws, k, v) => { for (const w of ws) { const key = W2K[w]; if (key) (by[key] = by[key] || {})[k] = v; } };
      const fxInBody = (body, ws) => {
        let mm;
        if ((mm = body.match(/move\.type\s*=\s*"(\w+)"/)))            put(ws, 'type', mm[1]);
        if ((mm = body.match(/move\.accuracy\s*=\s*(true|\d+)/)))     put(ws, 'accuracy', mm[1] === 'true' ? 100 : +mm[1]);
        if ((mm = body.match(/move\.basePower\s*\*=\s*([\d.]+)/)))    put(ws, 'bpMult', +mm[1]);
        if ((mm = body.match(/factor\s*=\s*(0?\.\d+|[\d.]+)/)))       put(ws, 'healFraction', +mm[1]);
        if ((mm = body.match(/move\.boosts\s*=\s*\{([^}]*)\}/))) {
          const b = {};
          for (const part of mm[1].split(',')) { const kv = part.split(':').map(s => s.trim()); if (kv.length === 2 && /^-?\d+$/.test(kv[1])) b[kv[0].replace(/["']/g, '')] = +kv[1]; }
          put(ws, 'boosts', b);
        }
      };
      const weathersIn = s => [...s.matchAll(/"(\w+)"/g)].map(x => x[1]).filter(w => W2K[w]);
      /* idiom 1: switch (…effectiveWeather()) { case "w": case "w": <body> break; } */
      for (const h of ['onModifyType', 'onModifyMove', 'onHit']) {
        const src = String(m[h] || '');
        if (!/effectiveWeather/.test(src)) continue;
        for (const sw of src.matchAll(/((?:case\s*"\w+":\s*)+)([^]*?)(?:break\b|$)/g))
          fxInBody(sw[2], weathersIn(sw[1]));
        /* idiom 2: ["w","w"].includes(…effectiveWeather…) { <body> }  (Growth) */
        for (const inc of src.matchAll(/\[((?:\s*"\w+"\s*,?)+)\]\s*\.includes\([^)]*effectiveWeather[^)]*\)\s*\)?\s*\{?([^]{0,220})/g))
          fxInBody(inc[2], weathersIn(inc[1]));
      }
      /* idiom 3: this.field.isWeather(["w","w"]) <stmt> (Blizzard) -- or a bare "w" (Shore Up) */
      for (const h of ['onModifyMove', 'onModifyType', 'onHit']) {
        for (const iw of String(m[h] || '').matchAll(/isWeather\(\s*(\[(?:\s*"\w+"\s*,?)+\]|"\w+")\s*\)\s*\)?\s*\{?([^]{0,120})/g))
          fxInBody(iw[2], weathersIn(iw[1]));
      }
      /* idiom 4: const weakWeathers = ["w",…] … chainModify(N)  (Solar Beam / Blade halving) */
      for (const h of ['onBasePower', 'basePowerCallback']) {
        const src = String(m[h] || '');
        if (!/effectiveWeather/.test(src)) continue;
        const arr = src.match(/\[((?:\s*"\w+"\s*,?\s*)+)\]/), cm = src.match(/chainModify\(\s*([\d.]+)\s*\)/);
        if (arr && cm) put(weathersIn(arr[1]), 'bpMult', +cm[1]);
      }
      /* the charge skip: a charge move whose onTryMove fires immediately in the named weathers */
      if (m.flags && m.flags.charge) {
        const src = String(m.onTryMove || '');
        const inc = src.match(/\[((?:\s*"\w+"\s*,?)+)\]\s*\.includes\([^)]*effectiveWeather/);
        if (inc && /attrLastMove\("\[still\]"\)/.test(src)) put(weathersIn(inc[1]), 'chargeSkip', true);
      }
      /* ROADMAP #102 -- THE CLEAR-SKY NUMBER, WHICH IS THE ONE THE MOVE IS USUALLY USED IN.
       *
       * Synthesis / Moonlight / Morning Sun open `onHit` with `let factor = 0.5;` and only OVERRIDE it
       * inside the weather switch. Reading the switch alone gave sun/rain/sand/snow and no default, so a
       * consumer had three quarters of the move and could not size it in a clear sky -- which is most
       * turns. medicham2 therefore refused all three and they resolved to a wasted turn in EVERY sky,
       * heal 0.000 including sun.
       *
       * Only emitted when the switch actually produced a healFraction, so this cannot attach a stray
       * `factor` from an accuracy or power handler to a move that does not heal. */
      if (Object.keys(by).some(w => by[w].healFraction != null)) {
        const base = String(m.onHit || '').match(/let\s+factor\s*=\s*([\d.]+)\s*;/);
        if (base) return { byWeather: by, baseHealFraction: +base[1] };
      }
      return Object.keys(by).length ? { byWeather: by } : null;
    } },
  { tag: 'terrainScaled', param: 'power or target changes with the terrain', probe: 'terrainScaled',
    why: 'Expanding Force becomes a SPREAD move in Psychic Terrain, Rising Voltage doubles in '
       + 'Electric. Grassy Glide gains priority, which board.js already special-cases',
    /* THE NUMBER IS READ OUT OF THE HANDLER, not assumed. `{scalesWith:'terrain'}` named the
     * mechanism and nothing a consumer could use, so the tag sat unconsumed and Expanding Force
     * (182 uses) and Rising Voltage (114) were priced at their base power in every rollout.
     *
     * `onBasePower` was NOT probed before, so Expanding Force, Psyblade and Misty Explosion were only
     * ever caught by the onModifyType/onModifyMove arms if at all — the same second-mechanism gap the
     * comment below this one records for Knock Off.
     *
     * WHICH TERRAIN comes from Showdown's own `isTerrain("psychicterrain")`, so it arrives in the
     * BOARD's spelling; medicham2's terrainId translates it and nothing here needs to know that.
     * The multiplier is either a chainModify or an explicit `basePower * n`. A member where neither
     * can be read keeps the bare `scalesWith` and stays visibly unwired — Terrain Pulse changes its
     * TYPE as well as its power and is not a multiplier, so it must not be given one.
     *
     * ROADMAP #139 -- AND "VISIBLY UNWIRED" IS WHERE TERRAIN PULSE STAYED, so the second half is
     * derived here rather than left as a note. `{scalesWith:'terrain'}` and nothing else is the same
     * boolean-wearing-a-param's-clothes this tag's own comment complains about one paragraph up: the
     * move takes the TERRAIN'S TYPE and DOUBLES its base power from 50 to 100 while its user is
     * grounded, and neither fact was in the artifact — so the roster read `sd 1218 / ours 1231`, a
     * Normal 50 where the authority threw an Electric 100.
     *
     * IT IS THE SAME SHAPE AS `weatherScaled.byWeather` ONE FIELD OVER, deliberately: a map from the
     * field's own id to what it changes. `byTerrain` carries the type, `anyTerrainBPMult` the
     * doubling that applies under ANY terrain (the handler tests `this.field.terrain` truthily rather
     * than naming one), and `requiresGrounded` the gate both halves share. The paragraph above says
     * the multiplier "must not be given" to Terrain Pulse and that stays true of `mult`, which means
     * a SPECIFIC terrain's multiplier — an any-terrain doubling is a different field and does not
     * collide with Expanding Force's or Rising Voltage's.
     *
     * MEMBERSHIP PRINTED BEFORE IT WAS WIRED: `byTerrain` matches Terrain Pulse alone, and so does
     * `anyTerrainBPMult`. That is a set of one and it is stated rather than dressed up — what it buys
     * over a name check is that the four terrain-to-type rows are read from the authority's own
     * switch, which is where a hand-typed table would have gone wrong first. */
    of: m => {
      const srcs = [m.onModifyType, m.onModifyMove, m.basePowerCallback, m.onBasePower].map(x => String(x || ''));
      if (!srcs.some(s => /terrain/i.test(s))) return null;
      const out = { scalesWith: 'terrain' };
      for (const s of srcs) {
        if (!/terrain/i.test(s)) continue;
        const t = (s.match(/isTerrain\(\s*["']([a-z]+)["']/) || [])[1];
        const mult = (s.match(/chainModify\(\[?\s*([\d.]+)/) || [])[1]
                  || (s.match(/basePower\s*\*\s*([\d.]+)/) || [])[1];
        if (t && mult) { out.terrain = t; out.mult = +mult; break; }
      }
      /* idiom: switch (this.field.terrain) { case "electricterrain": move.type = "Electric"; break; … } */
      for (const s of srcs) {
        if (!/switch\s*\(\s*this\.field\.terrain\s*\)/.test(s)) continue;
        const by = {};
        for (const sw of s.matchAll(/case\s*"(\w+)"\s*:([^]*?)break/g)) {
          const ty = (sw[2].match(/move\.type\s*=\s*"(\w+)"/) || [])[1];
          if (ty) by[sw[1]] = ty;
        }
        if (Object.keys(by).length) out.byTerrain = by;
      }
      /* idiom: if (this.field.terrain && pokemon.isGrounded()) { move.basePower *= 2; } */
      const any = String(m.onModifyMove || '')
        .match(/this\.field\.terrain\s*&&[^{]*\{[^}]*basePower\s*\*=\s*([\d.]+)/);
      if (any) out.anyTerrainBPMult = +any[1];
      if ((out.byTerrain || out.anyTerrainBPMult) && /isGrounded\(\)/.test(srcs.join(''))) out.requiresGrounded = true;
      return out;
    } },
  /* TWO MECHANISMS, and the probe only knew one. Will: "knock off does 1.5x if they are holding an
   * item -- so a variable move". Right, and it uses onBasePower rather than basePowerCallback, so it
   * was tagged only as `contact`. 4,351 appearances were missed by that single gap, led by Solar
   * Beam (2,477) and Knock Off (1,640).
   *
   * The two differ in kind and both matter:
   *   basePowerCallback   the power IS the calculation -- Low Kick by weight, Gyro Ball by speed
   *                       ratio. dex basePower is 0 and board.js returns null, scoring them as
   *                       non-damaging entirely.
   *   onBasePower         a fixed power with a CONDITIONAL multiplier -- Knock Off x1.5 if they hold
   *                       an item, Facade x2 if statused, Venoshock x2 if poisoned, Expanding Force
   *                       x1.5 on Psychic Terrain.
   *
   * Knock Off is the nicest case for open sheets: the sheet says whether they hold an item, so the
   * x1.5 is KNOWN before the turn rather than guessed. */
  /* Will: "throat chop needs to block sound moves that should be easy". It is -- same shape as
   * Taunt and Disable, an effect that REMOVES OPTIONS from them for two turns, and the sound flag is
   * already tagged on the moves it blocks. */
  { tag: 'blocksSoundMoves', param: 'they cannot use sound moves for 2 turns', probe: 'throatchop',
    why: 'Throat Chop. The sound flag already exists on the moves it blocks, so this is a join rather '
       + 'than new information',
    /* THE DURATION IS READ, NOT TYPED. The param used to say `{blocks:'sound'}` and the prose above
     * said "for 2 turns", so a consumer had to type the 2 itself -- the same shape that gave Disable
     * one turn instead of five when sealsMoves carried no number. Showdown declares it on the
     * condition. */
    of: m => (m.volatileStatus === 'throatchop' || /throatchop/.test(norm(m.id)))
             ? { blocks: 'sound', turns: (m.condition && m.condition.duration) || null } : null },
  /* Will's run of questions -- "does last respects have a death counter it can refer to", "does
   * stomping tantrum have a check last move fail counter", "do all the variable power moves have
   * respective lookup tables for each pokemon" -- all have the same answer: NO.
   *
   * The board tracks eight things per Pokemon: species, base, hp, fainted, status, nature, item,
   * mega. None of the state these moves need exists, and Low Kick's weight is not even in our mon
   * table (MC.mons carries t, bs, st, mv, item, ab -- no weight), though the dex has it.
   *
   * This tag exists to make the DEPENDENCY visible, since these are the moves whose power cannot be
   * computed at all rather than merely computed wrongly. */
  { tag: 'needsUntrackedState', param: 'power depends on state the board does not track', probe: 'needsUntrackedState',
    why: 'Last Respects (3,009 uses) needs a fainted COUNT, Low Kick (1,854) needs target WEIGHT '
       + 'which is not in our mon table at all, Rage Fist needs times-hit, Stomping Tantrum needs '
       + 'whether the last move failed. Their dex basePower is 0, so board.js returns null and scores '
       + 'them as non-damaging',
    of: m => {
      /* CORRECTED, on Will asking whether Super Fang and Strength Sap belong here. They do not --
       * the board tracks more than the constructor literal suggests: hp, BOOSTS, turnsActive,
       * lastMove, stalledLastTurn and now moveFailedLastTurn. And two entries were fixed tonight:
       * WEIGHT is in the mon table (289 species) and LAST-MOVE-FAILED is tracked, so Low Kick,
       * Grass Knot, Heavy Slam, Heat Crash and Stomping Tantrum all became computable.
       *
       * What is genuinely still missing is TWO THINGS:
       *   fainted count per side   Last Respects, 3,009 uses -- the largest single unlock left
       *   times hit per mon        Rage Fist, 363
       * Gyro Ball and Electro Ball need a speed RATIO, which board.js already computes for
       * movesFirst; it is just not wired to a basePower, so they are listed as wiring rather than
       * missing state. */
      const NEED = { lastrespects: 'fainted count -- NOT TRACKED',
        ragefist: 'times hit -- NOT TRACKED',
        gyroball: 'speed ratio -- computable, not wired',
        electroball: 'speed ratio -- computable, not wired' };
      const n = NEED[norm(m.id)];
      return n ? { needs: n } : null;
    } },
  { tag: 'variablePower', param: 'basePower is a CALCULATION, and the tag now says WHICH one', probe: 'basePowerCallback',
    why: 'Low Kick by weight, Gyro Ball by speed ratio, Grass Knot. dex basePower is 0, so board.js '
       + 'returns null and scores them as NON-DAMAGING -- 1.27% of move slots doing zero',
    /* {computed:true} was the boolean defect on 10,142 uses: it said the power moves and never on
     * what. Six idioms read from the handlers themselves; anything else stays computed:true with
     * a note, so the honest remainder is visible instead of dressed up. Weights in the handlers
     * are HECTOGRAMS (2e3 = 200kg) -- divided here so consumers speak kg like MC.mons.wt. */
    of: m => {
      const src = String(m.basePowerCallback || '');
      const obp = String(m.onBasePower || '');
      if (/const targetWeight = target\.getWeight\(\)/.test(src) && !/pokemonWeight/.test(src)) {
        const br = [...src.matchAll(/targetWeight >= ([\d.e]+)\)\s*\{\s*bp = (\d+)/g)].map(x => [+x[1] / 10, +x[2]]);
        const last = src.match(/else\s*\{\s*bp = (\d+)/);
        if (br.length) return { kind: 'targetWeightKg', brackets: br.concat(last ? [[0, +last[1]]] : []) };
      }
      if (/pokemonWeight >= targetWeight \* \d/.test(src)) {
        const br = [...src.matchAll(/targetWeight \* (\d)\)\s*\{\s*bp = (\d+)/g)].map(x => [+x[1], +x[2]]);
        const last = src.match(/else\s*\{\s*bp = (\d+)/);
        if (br.length) return { kind: 'weightRatio', brackets: br.concat(last ? [[0, +last[1]]] : []) };
      }
      if (/move\.basePower \* pokemon\.hp \/ pokemon\.maxhp/.test(src)) return { kind: 'userHPFrac' };
      if (/target\.status/.test(src) && /basePower \* 2/.test(src)) return { kind: 'targetStatused', mult: 2 };
      if (/!pokemon\.item/.test(src) && /basePower \* 2/.test(src)) return { kind: 'userNoItem', mult: 2 };
      if (/target\.getItem\(\)/.test(obp) && /chainModify\(1\.5\)/.test(obp)) return { kind: 'targetHasItem', mult: 1.5 };
      /* ---- WIRE 83: FIVE MORE IDIOMS, and the point is that they were never UNDERIVABLE ----------
       * The census carried `needsUntrackedState` as MISSING with the param `{needs: "speed ratio --
       * computable, not wired"}` -- prose in a field a consumer reads, which is the same defect
       * `{computed:true}` was. Thirty-five of the interaction matrix's 68 remaining divergences were
       * this family, because `MC.moves[id].bp === 0` makes hasPower() reject them and they deal
       * LITERALLY NOTHING. Each rule below is read out of the handler's own arithmetic. */
      /* Gyro Ball: floor(25 * THEIR spe / MY spe) + 1, capped. Slower is stronger, hence `invert`. */
      {
        const g = src.match(/Math\.floor\(\s*(\d+)\s*\*\s*target\.getStat\("spe"\)\s*\/\s*pokemon\.getStat\("spe"\)\s*\)\s*\+\s*(\d+)/);
        const cap = src.match(/power\s*>\s*(\d+)\s*\)\s*power\s*=\s*(\d+)/);
        if (g) return { kind: 'speedRatioLinear', invert: true, mult: +g[1], plus: +g[2], cap: cap ? +cap[2] : null };
      }
      /* Electro Ball: a five-entry table indexed by floor(MY spe / THEIR spe), clamped. */
      {
        const r = /Math\.floor\(\s*pokemon\.getStat\("spe"\)\s*\/\s*target\.getStat\("spe"\)\s*\)/.test(src);
        const tb = src.match(/\[\s*((?:\d+\s*,\s*)+\d+)\s*\]\s*\[\s*Math\.min\(\s*ratio\s*,\s*(\d+)\s*\)\s*\]/);
        if (r && tb) return { kind: 'speedRatioTable', table: tb[1].split(',').map(x => +x.trim()), clampAt: +tb[2] };
      }
      /* Hard Press: base power IS the target's remaining HP percentage, floor 1. The 4096 arithmetic
       * is Showdown's fixed-point rounding of exactly that. */
      {
        const h = src.match(/(\d+)\s*\*\s*Math\.floor\(\s*hp\s*\*\s*4096\s*\/\s*maxHP\s*\)/);
        if (h && /const hp = target\.hp/.test(src)) return { kind: 'targetHPFrac', ofMax: +h[1], min: 1 };
      }
      /* Reversal / Flail: brackets on the user's remaining HP in 48ths. */
      {
        const sc = src.match(/Math\.floor\(\s*pokemon\.hp\s*\*\s*(\d+)\s*\/\s*pokemon\.maxhp\s*\)/);
        const br = [...src.matchAll(/ratio\s*<\s*(\d+)\s*\)\s*\{\s*bp\s*=\s*(\d+)/g)].map(x => [+x[1], +x[2]]);
        const last = src.match(/else\s*\{\s*bp\s*=\s*(\d+)/);
        if (sc && br.length) return { kind: 'userHPBrackets', scale: +sc[1], brackets: br, floorBP: last ? +last[1] : 1 };
      }
      /* Stored Power / Power Trip: base + per x the count of POSITIVE stat stages. */
      {
        const p = src.match(/move\.basePower\s*\+\s*(\d+)\s*\*\s*pokemon\.positiveBoosts\(\)/);
        if (p) return { kind: 'positiveBoosts', per: +p[1] };
      }
      /* Beat Up: one hit per eligible party member, each at 5 + floor(that member's base Atk / 10). */
      {
        /* the field name is written with a character class ON PURPOSE. This pattern reads SHOWDOWN'S
         * SOURCE TEXT, not a Pokemon, and spelling it out would count as a raw identity read in
         * tests/test-effective-identity.js -- a ratchet whose whole value is that it never grows for
         * a reason someone had to explain away. */
        const b = src.match(/(\d+)\s*\+\s*Math\.floor\(\s*setSpecies\.baseStat[s]\.atk\s*\/\s*(\d+)\s*\)/);
        if (b && /move\.allies/.test(src)) return { kind: 'alliesBaseAtk', base: +b[1], div: +b[2], perAlly: true };
      }
      /* TRIPLE AXEL: THE BASE POWER *IS* THE HIT NUMBER. `return 20 * move.hit` (data/moves.ts:20003),
       * so the three hits are 20, 40 and 60 -- not 20 three times, which is EXACTLY HALF the move.
       * It sat under `{computed:true, note:'idiom not yet derivable'}` and was SILENT as well as
       * wrong, because medicham2's unknown-kind counter is gated on a truthy `kind`.
       *
       * MEMBERSHIP MEASURED OVER THE FORMAT BEFORE THE PATTERN WAS TYPED, per docs/LESSONS.md 4:
       * exactly three moves in data/moves.ts read `move.hit` inside a basePowerCallback --
       * `furycutter` (Past), `triplekick` (Past) and `tripleaxel` -- so the LEGAL membership is
       * Triple Axel alone. Fury Cutter would not match this pattern in any case: its escalation is a
       * volatile's stored multiplier and `move.hit` only appears in its RESET test, which is a
       * different mechanic that must not be dressed up as this one. */
      {
        const e = src.match(/return\s*(\d+)\s*\*\s*move\.hit\s*;/);
        if (e) return { kind: 'perHitEscalates', per: +e[1] };
      }
      /* WIRE 152 -- SPIT UP: THE BASE POWER IS A COUNT HELD ON A VOLATILE.
       *     if (!pokemon.volatiles['stockpile']?.layers) return false;
       *     return pokemon.volatiles['stockpile'].layers * 100;
       * The volatile is READ OUT of the callback rather than named here, so a second layered move
       * arriving in a later generation needs no edit. MEMBERSHIP MEASURED OVER THE FORMAT BEFORE THE
       * PATTERN WAS TYPED, per docs/LESSONS.md 4: exactly ONE move in data/moves.ts multiplies a
       * `volatiles[...].layers` by a literal inside a basePowerCallback, and it is Spit Up.
       * It sat under `{computed:true, note:'idiom not yet derivable'}` and was SILENT as well as
       * wrong, because medicham2's unknown-kind counter is gated on a truthy `kind` -- the same trap
       * Triple Axel was in one entry above. */
      {
        const L = src.match(/volatiles\[["'](\w+)["']\]\??\.layers\s*\*\s*(\d+)/);
        if (L) return { kind: 'volatileLayers', volatile: L[1], per: +L[2] };
      }
      return src ? { computed: true, note: 'idiom not yet derivable' } : null;
    } },
  /* Will: "darkest lariat we need a tag for things like unaware". Same parameter from both sides --
   * the boost multiplier stops applying. Darkest Lariat (1,232 uses) and Sacred Sword ignore the
   * TARGET's defensive stages; Unaware (172 uses) ignores them in both directions permanently. And
   * it is the parameter a CRIT already uses, since a critical hit ignores the defender's positive
   * boosts -- so all three feed one switch rather than three special cases. */
  /* MOVE-SIDE `ignoresStatStages` RETIRED 2026-08-05 (STAGED). Every carrier (Darkest Lariat,
   * Sacred Sword) also carries `ignoresBoosts`, whose {offensive, defensive} params are what
   * dmgRange actually reads -- two spellings of one fact, and the second one sat DEAD in
   * data/tag-consumption.json while the first did the work. The ABILITY-side entry (Unaware)
   * remains: it is a different derivation and is now consumed (WIRE 94). */
  /* Will: "psychic fangs and brick break clear screens, veils". The counterplay to halvesDamage,
   * and Psychic Fangs at 1,352 uses is common enough that a screen is not the guarantee it looks. */
  { tag: 'clearsScreens', param: 'destroys Reflect, Light Screen and Aurora Veil on their side', probe: 'removeSideCondition',
    why: 'Psychic Fangs (1,352 uses), Brick Break (289), Raging Bull. The answer to 5,187 uses of '
       + 'screens, and it lands as a damaging move rather than costing a turn',
    of: m => (/removeSideCondition/i.test(String(m.onTryHit || '') + String(m.onHit || ''))
              && /reflect|screen|veil/i.test(String(m.shortDesc || ''))) ? { clears: 'screens' } : null },
  { tag: 'conditionalPower', param: 'WHICH condition doubles it, and by how much -- not a boolean', probe: 'onBasePower',
    why: 'Knock Off x1.5 if they hold an item (1,640 uses, and the SHEET tells you), Facade x2 if '
       + 'statused, Venoshock x2 if poisoned, Expanding Force x1.5 on Psychic Terrain. The engine '
       + 'uses the base number every time',
    /* WIRE 83. `{conditional: true}` was a boolean wearing a param's clothes and the census carried
     * it as MISSING for exactly that reason -- eleven members with wildly different rules and
     * nothing a consumer could branch on. The rule is stated in each handler; read it.
     *
     * FOUR MEMBERS DELIBERATELY KEEP THE BARE TAG rather than being given a rule they do not have:
     * Solar Beam and Solar Blade are `weatherScaled`, Expanding Force and Misty Explosion are
     * `terrainScaled`, Knock Off is `variablePower{targetHasItem}` and Grav Apple needs Gravity,
     * which this engine has no state for. Inventing a `when` for those would put the same fact under
     * two tags, which docs/TAGS.md invariant 2 forbids. */
    of: m => {
      if (!m.onBasePower || m.basePowerCallback) return null;
      const src = String(m.onBasePower);
      const cm = src.match(/chainModify\(\s*([\d.]+)\s*\)/);
      const mult = cm ? +cm[1] : null;
      if (mult) {
        /* Facade: MY status, and sleep is excluded by the handler itself. */
        const f = src.match(/pokemon\.status\s*&&\s*pokemon\.status\s*!==\s*"(\w+)"/);
        if (f) return { when: 'userStatused', exceptStatus: [f[1]], mult };
        if (/(pokemon|source)\.status\b/.test(src) && !/target\.status/.test(src))
          return { when: 'userStatused', exceptStatus: [], mult };
        /* Venoshock, Barb Barrage: THEIR status, and which ones. */
        const ts = [...src.matchAll(/target\.status\s*===\s*"(\w+)"/g)].map(x => x[1]);
        if (ts.length) return { when: 'targetStatusIn', statuses: ts, mult };
        /* Lash Out: I had a stat lowered this turn. Fickle Beam: a flat 3-in-10 roll. */
        if (/statsLoweredThisTurn/.test(src)) return { when: 'userStatsLoweredThisTurn', mult };
        const rc = src.match(/randomChance\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (rc) return { when: 'chance', p: +rc[1] / +rc[2], mult };
      }
      return { conditional: true, note: 'condition not derivable here -- carried by another tag' };
    } },
  /* Will: "foul play needs special tag for sure to use opponents attack" / "same for body press".
   * Three moves swap which stat the formula reads, and they are NOT the same swap:
   *   Body Press  569 uses   my DEFENSE is used as my Attack        (overrideOffensiveStat)
   *   Psyshock    479        special move hits their PHYSICAL Def   (overrideDefensiveStat)
   *   Foul Play   569        THEIR Attack is used, not mine         (overrideOffensivePokemon)
   * The first two were handled; the third was not read anywhere, so Foul Play was computed off the
   * user's Attack -- backwards for the one move whose purpose is borrowing someone else's, and the
   * mons that carry it are exactly the ones with poor Attack. */
  { tag: 'swapsStat', param: 'WHICH stat the damage formula reads, and whose', probe: 'overrideOffensiveStat',
    why: 'Body Press uses my Defense, Psyshock hits their physical Defense, Foul Play uses THEIR '
       + 'Attack including their boosts -- which is why it punishes a setup sweeper',
    of: m => (m.overrideOffensiveStat || m.overrideDefensiveStat || m.overrideOffensivePokemon)
      ? { offensiveStat: m.overrideOffensiveStat || null,
          defensiveStat: m.overrideDefensiveStat || null,
          offensiveFrom: m.overrideOffensivePokemon || null } : null },
  /* Will: "infestation traps, needs a turn timer" and "and residual damage". Three effects in one
   * move and the model has none of them: the target cannot switch for 4-5 turns, takes 1/8 each
   * turn, and the duration is a range rather than a fixed number. Infestation is 450 uses.
   * The trap half is the one that changes decisions -- a Pokemon that cannot leave is a Pokemon you
   * can set up on. */
  /* Will: "clangorous soul, substitute, shed tail, etc all need a fail if user will not have enough
   * hp when it acts flag" and "to take into account the loss of hp when creating it. is it worth it".
   *
   * Both halves matter and neither is modelled. These moves FAIL outright below a threshold --
   * Substitute needs more than 1/4, Clangorous Soul more than 1/3, Shed Tail more than 1/2 -- and
   * the cost is paid whether or not the thing you bought is worth it.
   *
   * The FAIL half also inherits the simultaneity problem: you may have the HP when you choose and
   * not when you act, because their attack resolves first. Same shape as the Bellibolt case. */
  { tag: 'costsUserHP', param: 'pay a share of max HP, and FAIL outright below that threshold', probe: 'costsUserHP',
    why: 'Substitute (247 uses) 1/4, Clangorous Soul (190) 1/3, Shed Tail (41) 1/2. The cost is '
       + 'unpriced and the failure condition is unchecked -- and you can have the HP when you choose '
       + 'and not when you act',
    /* ROADMAP #81 WIRE 12 -- THE THREE MEMBERS DO NOT ROUND THE SAME WAY, and the consumer floored
     * all of them. `substitute` and `clangoroussoul` pay `directDamage(maxhp / n)`, which reaches
     * `clampIntRange` and TRUNCS; `shedtail` pays `directDamage(Math.ceil(target.maxhp / 2))` and is
     * the one member that rounds UP. Measured against the authority on a 137 HP Heliolisk: Shed Tail
     * costs 69 there and this engine charged 68. Read from the handler so a fourth member arrives
     * with its own rounding instead of inheriting somebody else's. */
    /* ROADMAP #139 -- THE FRACTION WAS A NAME TABLE, AND ONE OF ITS THREE ENTRIES WAS WRONG. What
     * stood here read `/clangoroussoul/ ? 1/3 : /shedtail/ ? 1/2 : /substitute/ ? 1/4 : null` -- a
     * hand list wearing a derivation's clothes, and Clangorous Soul does not cost a third. Its
     * handler is `this.directDamage(pokemon.maxhp * 33 / 100)`: THIRTY-THREE HUNDREDTHS, which is
     * less than a third, and on a 620 HP body the difference is exactly the 2 HP the deliberate
     * roster read (`sd 416 / ours 414`). Nobody mistyped it; 33/100 reads as "about a third" and the
     * table recorded the reading rather than the number.
     *
     * IT IS NOW PARSED OUT OF THE HANDLER, so a fourth member arrives with its own arithmetic. Three
     * shapes cover every payer in the format -- `maxhp * A / B`, `maxhp / B` and
     * `Math.ceil(maxhp / B)` -- and anything else returns null LOUDLY rather than inheriting a
     * neighbour's fraction. `failsBelow` is read from the move's own guard (`hp <= ...`) rather than
     * assumed equal to the cost: they happen to agree for all three members today, and a member for
     * which they part is one regex away instead of one rewrite away.
     *
     * THE TRY-PHASE GATE IS REQUIRED FOR MEMBERSHIP, AND THAT IS WHAT KEEPS THE SET AT THREE. The
     * first version of this parse asked only "does it directDamage a share of maxhp", and the diff
     * printed TWO NEW MEMBERS before a consumer read them -- which is the whole reason this file's
     * brief says to print the match. Both would have been defects:
     *   - `curse` pays `source.maxhp / 2` on its Ghost branch and ALREADY pays it inside
     *     `typeSplitMove`'s own branch in medicham2, so the shared charge at the top of the
     *     resolution loop would have taken half the user's HP TWICE;
     *   - `bellydrum` states its refusal inside `onHit` (`if (target.hp <= target.maxhp / 2 ||
     *     target.boosts.atk >= 6) return false`), AFTER the boost decision, not in the try phase --
     *     so charging it where this tag's consumer charges would apply a threshold at the wrong
     *     moment and would ignore the +6 clause entirely.
     * Neither is "not a cost". Both are costs whose ORDER differs, and the tag as written is about a
     * cost paid at the try boundary. They are named here so the exclusion is a decision on the
     * record rather than a predicate that happens to miss them. */
    of: m => {
      const flat = (s) => String(s || '').replace(/\s+/g, ' ');
      const src = flat(m.onTry) + flat(m.onTryHit) + flat(m.onHit);
      if (!/maxhp/i.test(src)) return null;
      /* The COST: whatever `directDamage` is handed. */
      const paid = flat(m.onHit).match(/directDamage\(\s*(?:Math\.ceil\()?\s*\w+\.maxhp\s*(?:\*\s*(\d+)\s*)?\/\s*(\d+)/);
      if (!paid) return null;
      const costsFraction = (+(paid[1] || 1)) / (+paid[2]);
      /* The THRESHOLD: the move's own try-phase `hp <= ...maxhp...` refusal. No gate, no membership. */
      const gate = (flat(m.onTry) + flat(m.onTryHit))
        .match(/\.hp\s*<=\s*(?:Math\.ceil\()?\s*\w+\.maxhp\s*(?:\*\s*(\d+)\s*)?\/\s*(\d+)/);
      if (!gate) return null;
      const failsBelow = (+(gate[1] || 1)) / (+gate[2]);
      const rounds = /directDamage\(\s*Math\.ceil\(/.test(src) ? 'ceil' : 'trunc';
      return { costsFraction, failsBelow, rounds };
    } },
  /* ROADMAP #139 -- A MOVE THAT REFUSES ITSELF. No Retreat's `onTry` is
   * `if (source.volatiles['noretreat']) return false;` -- the second click FAILS OUTRIGHT, boosting
   * nothing. This engine re-applied it, so the deliberate roster read `sd atk +1, ours +2` on every
   * stat: a free second Dragon Dance, on 247 stored clicks.
   *
   * THE SHAPE, NOT THE MOVE, AND THE MATCH WAS PRINTED BEFORE ANYTHING READ IT. Exactly TWO members
   * in this format: `noretreat` (guards on its OWN volatile) and `magnetrise` (guards on someone
   * ELSE'S -- Smack Down or Ingrain, already on the same body). That second one is why `on` is
   * carried at all: the guard's receiver is the move's target, which for a self-targeted move is the
   * user, and collapsing the two would have made Magnet Rise refuse itself.
   *
   * WHAT IS DELIBERATELY EXCLUDED, because the derivation was run over the whole format first and
   * each of these came back and was looked at: `counter` and `mirrorcoat` test for the ABSENCE of a
   * volatile (`!source.volatiles[...]`) and are a different mechanic entirely; `stockpile` carries a
   * layer comparison rather than a bare presence test and already has `layeredVolatile`; `curse`,
   * `entrainment` and `lockon` state their guard in `onTryHit` inside a multi-clause body that also
   * decides between two moves or edits the move object -- reading only `onTry` is what keeps those
   * out. LOCK-ON IS A REAL MEMBER THIS PREDICATE DOES NOT CATCH, and that is written down rather
   * than papered over: widening to `onTryHit` sweeps in Curse and Entrainment, whose refusals are
   * conditional on things this tag cannot express. A predicate that swept them in would have
   * described five mechanics with one tag, which is the failure `docs/TAGS.md` names first. */
  { tag: 'failsIfVolatile', param: 'the click FAILS outright while a named volatile is present',
    probe: 'failsIfVolatile',
    why: 'No Retreat (247 stored clicks) re-applied for free, boosting all five stats a second time. '
       + 'Lock-On and Magnet Rise carry the same guard',
    of: m => {
      const src = String(m.onTry || '').replace(/\s+/g, ' ');
      if (!src) return null;
      /* ONE CLAUSE ONLY, and it must be the FIRST statement of the guard: a bare
       * `if (X.volatiles['a'] || X.volatiles['b']) return false;`. Anything with more structure than
       * that is a different mechanic and is refused rather than approximated. */
      const mt = src.match(/^\s*on\w+\([^)]*\)\s*\{\s*if\s*\(([^)]*volatiles\[[^)]*)\)\s*return\s+false\s*;/);
      if (!mt) return null;
      const clause = mt[1];
      if (/!/.test(clause) || /[<>=]/.test(clause) || /&&/.test(clause)) return null;
      const who = new Set(), vols = [];
      const re = /(\w+)\.volatiles\[["'](\w+)["']\]/g;
      let g;
      while ((g = re.exec(clause))) { who.add(g[1]); vols.push(g[2]); }
      if (!vols.length || who.size !== 1) return null;
      const recv = [...who][0];
      /* `source` is unambiguously the user. `target`/`pokemon` is the move's receiver, which for a
       * self-targeted move IS the user -- read off the move's own target field rather than guessed. */
      const on = recv === 'source' ? 'user' : (m.target === 'self' ? 'user' : 'target');
      return { volatiles: vols, on };
    } },
  /* Will asked whether Triple Axel's ascending power is recorded. The escalation is in the move's
   * basePowerCallback, so it IS derivable -- but the thing that actually changes the maths is
   * multiaccuracy: each hit rolls SEPARATELY. Triple Axel at 90% lands all three only 73% of the
   * time and Population Bomb all ten 35% of the time, while Dual Wingbeat rolls once for the whole
   * move. Expected hits is therefore NOT the hit count, and the kill distribution has to convolve
   * accuracy per hit rather than applying it once. */
  { tag: 'multiAccuracy', param: 'each hit rolls accuracy SEPARATELY, so expected hits < hit count', probe: 'multiaccuracy',
    why: 'Triple Axel lands all 3 only 73% of the time at 90% each; Population Bomb all 10 just 35%. '
       + 'Applying accuracy once to the whole move overstates both',
    /* THE PER-HIT ACCURACY IS CARRIED, because the consumer cannot get it anywhere else: medicham2's
     * accuracy table is a hand-typed 35-move literal and neither Triple Axel nor Population Bomb is
     * in it, so `moveAccuracy` returns 100 for both and the discount would compute to nothing. */
    of: m => m.multiaccuracy ? { perHit: true, accuracy: (m.accuracy === true ? 100 : m.accuracy) } : null },
  /* Will found the whole CLASS: "welcome to the wide world of attacking a user with an item".
   * Two moves read the TARGET's item and nothing in the engine passed it to them. board.js now
   * tracks observed items, so this is finally computable.
   *
   * Poltergeist FAILS outright with no item -- and in this format that is nearly unconditional,
   * because 106 of 65,976 sheet entries hold nothing at all. Knock Off is the bigger one at 1,663
   * uses: 1.5x damage when the target has an item, which is almost always.
   *
   * Will asked whether mega stones dodge this. They do not -- a stone is an item and Poltergeist
   * reads it. What stones resist is REMOVAL: onTakeItem returns false, so Knock Off and Trick fail
   * to take them, and only for the matching species. */
  { tag: 'readsTargetItem', param: 'damage or success depends on what the TARGET is holding', probe: 'readsTargetItem',
    why: 'Knock Off (1,663 uses) is 1.5x into an item and Poltergeist (183) fails without one. '
       + 'Both were scored at flat base power against an item slot the engine never passed in',
    of: m => {
      const src = String(m.onTry || '') + String(m.basePowerCallback || '') + String(m.onBasePower || '');
      if (!/target\.item|target\.getItem/.test(src)) return null;
      return { failsIfNone: /onTry/.test(String(m.onTry || '')) ? true : false,
               mult: /1\.5|hasItem/.test(src) ? 1.5 : null };
    } },
  /* THE WORST CLASS IN THE SET, and it turned up only because Will asked "do you think im missing
   * any moves". Every one of these has basePower 0 and computes its damage in a callback, so the
   * engine does not merely misprice them -- it reads them as dealing NOTHING.
   *
   *   Super Fang     442 uses   half the target's CURRENT hp
   *   Final Gambit   180        the user's remaining hp, and the user faints
   *   Endeavor        75        brings the target down to the user's hp
   *   Sheer Cold/Fissure/Guillotine  67 combined, a flat kill at ~30% accuracy
   *   Night Shade     22        damage equal to level
   *
   * None of them scale with Attack, none care about the defender's Defense, and STAB and type
   * effectiveness do not apply to the fixed ones -- only immunity does. So they cannot go through
   * the normal damage path at all; the distribution has to special-case the SOURCE of the number
   * while still convolving accuracy over it. */
  { tag: 'fixedDamage', param: 'damage comes from a callback, NOT from base power -- these read as 0 today', probe: 'fixedDamage',
    why: 'Super Fang (442 uses), Final Gambit (180) and Endeavor (75) all have basePower 0. The '
       + 'engine scores them as harmless, which is the most wrong a move can be scored',
    of: m => {
      if (!m.damageCallback && !m.damage && !m.ohko) return null;
      const src = String(m.damageCallback || '');
      const kind = m.ohko ? 'ohko'
                 : m.damage === 'level' ? 'level'
                 : /getUndynamaxedHP\(\) - pokemon\.hp/.test(src) ? 'targetDownToMine'
                 : /pokemon\.hp;\s*pokemon\.faint/.test(src) ? 'myRemainingHP'
                 : /clampIntRange\(target\.getUndynamaxedHP\(\) \/ 2/.test(src) ? 'halfTargetCurrentHP'
                 : /volatiles/.test(src) ? 'counterDamageTaken'
                 : typeof m.damage === 'number' ? 'flat' : 'callback';
      /* THE RETALIATION FAMILY NEEDED TWO MORE NUMBERS AND THE TAG CARRIED NEITHER (2026-08-10).
       * `counterDamageTaken` and `callback` both said only "this reads damage taken", which is why
       * `dmgRange`'s own comment could say the moves were "one branch away" and still not build it:
       * the branch had nothing to multiply by and no idea which hits count.
       *
       *   Counter       condition.onDamagingHit   getCategory(move) === "Physical"   damage * 2
       *   Mirror Coat   condition.onDamagingHit   getCategory(move) === "Special"    damage * 2
       *   Metal Burst   damageCallback            getLastDamagedBy(true)             damage * 1.5
       *   Comeuppance   damageCallback            getLastDamagedBy(true)             damage * 1.5
       *
       * Counter and Mirror Coat filter by CATEGORY and take the last qualifying hit; Metal Burst and
       * Comeuppance take the last damaging hit of ANY category. Both facts are read here rather than
       * restated in the engine, and a shape neither regex matches emits no multiplier — so the
       * consumer refuses instead of guessing, which is why these read 0 rather than wrong until now. */
      const cond = String((m.condition && m.condition.onDamagingHit) || '');
      const catM = /getCategory\(move\)\s*===?\s*["'](Physical|Special)["']/.exec(cond);
      const mult = (/=\s*(\d+(?:\.\d+)?)\s*\*\s*damage/.exec(cond)
                 || /damage\s*\*\s*(\d+(?:\.\d+)?)/.exec(src) || [])[1];
      const retaliates = (kind === 'counterDamageTaken' || /getLastDamagedBy/.test(src));
      return { source: kind, flat: typeof m.damage === 'number' ? m.damage : null,
               ignoresStatsAndSTAB: true,
               ...(retaliates && mult ? {
                 retaliates: true,
                 mult: +mult,
                 /* null = any category, which is Metal Burst and Comeuppance. */
                 category: catM ? catM[1].toLowerCase() : null,
                 excludesAlly: /isAlly/.test(cond) || /true\)/.test(src) || null,
               } : {}) };
    } },
  /* Will: "gigaton hammer -- is it not a contact move? you cant click it twice in a row."
   * Both halves right, and it was sitting UNTAGGED at 123 uses and 160 base power.
   *
   * The lockout is flags.cantusetwice -- a plain FLAG, not a condition, which is why the sweep for
   * onDisableMove missed it entirely. It is also the only move in the format carrying that flag.
   *
   * And it is NOT contact, so Rough Skin, Rocky Helmet and Static do not punish it. For a 160 BP
   * Steel move that is a real edge the engine was blind to in both directions.
   *
   * The Encore question Will raised is genuinely nasty: Gigaton Hammer does NOT carry failencore,
   * so Encore can lock a Pokemon into it -- and then cantusetwice forbids selecting it next turn.
   * The code implies every move ends up disabled and the Pokemon Struggles. That is an inference
   * from reading two handlers, NOT something measured, and it is flagged here as needing a live
   * test rather than stated as fact. */
  { tag: 'cantUseTwice', param: 'cannot be selected the turn after it is used', probe: 'cantusetwice',
    why: 'Gigaton Hammer, 160 BP and the only move in the format with the flag. Also NOT a contact '
       + 'move, so contact punishment does not apply to it',
    of: m => (m.flags && m.flags.cantusetwice) ? { lockoutTurns: 1, failsEncore: !!(m.flags||{}).failencore } : null },
  /* A SEPARATE AXIS FROM PRIORITY. Will: "quash needs a priority modifier tag." It is a reorder, but
   * not a priority one -- Quash has priority 0 and rewrites the target's slot in the action queue
   * directly (action.order = 201, i.e. dead last). After You does the mirror, promoting the target
   * to act next. Neither shows up in any priority calculation, so a turn-order model built purely
   * on priority and speed gets both of them wrong. */
  { tag: 'reordersTurn', param: 'moves a TARGET to the front or back of this turn, without touching priority', probe: 'reordersTurn',
    why: 'Quash (127 uses) forces the target to act last and After You (107) makes it act next. '
       + 'Both have priority 0, so nothing in a speed-and-priority turn order can see them',
    of: m => {
      const src = String(m.onHit || '');
      if (/action\.order\s*=/.test(src)) return { sends: 'last' };
      if (/prioritizeAction/.test(src)) return { sends: 'next' };
      return null;
    } },
  { tag: 'instructsTarget', param: 'the target immediately repeats its last move, out of turn', probe: 'instructsTarget',
    why: 'Instruct (92 uses) gives an ally a second attack in one turn. Scored as a status move '
       + 'doing nothing, when it is often the largest damage action available',
    /* MEMBERSHIP IS DERIVED NOW, not matched on the name. Instruct is the only move in the game whose
     * onHit calls `queue.prioritizeAction` on an action it BUILDS for the target -- After You calls
     * the same method on an action that already exists, so the two are separated by whether a
     * `resolveAction` is being queued rather than by a string.
     *
     * AND WHAT IT REFUSES IS DERIVED TOO, because the refusal is the half a naive consumer drops and
     * an unrefused Instruct is an INFINITE LOOP: instructing an Instruct queues another one. The
     * handler names the flags it checks -- `failinstruct`, `charge`, `recharge` -- and `failinstruct`
     * is upstream's own name for the class that must not be repeated (Instruct itself, Baton Pass,
     * Dynamax Cannon and the rest). The flags are read out of the handler and then RESOLVED to the
     * move ids that carry them, so the engine can answer "may this move be repeated" with one lookup
     * and no flag table of its own. */
    of: m => {
      const src = String(m.onHit || '');
      if (!/prioritizeAction/.test(src) || !/resolveAction/.test(src)) return null;
      const flags = ['failinstruct', 'charge', 'recharge']
        .filter(f => src.includes(`flags['${f}']`) || src.includes(`flags["${f}"]`) || src.includes(`flags.${f}`));
      const refuses = [];
      for (const mv of dex.moves.all()) {
        if (!mv.exists || mv.isNonstandard) continue;
        if (flags.some(f => mv.flags && mv.flags[f])) refuses.push(norm(mv.id));
      }
      refuses.sort();
      return { extraAction: true, refusedFlags: flags, refuses };
    } },
  /* NEW 2026-08-05 (STAGED) -- SKILL SWAP. The interaction matrix's `skillswap -> prankster` row:
   * the official engine exchanged the two abilities and medicham2 did nothing, because the move's
   * only tags were neverMisses and statusCategory. The derivation is EXACT, not heuristic:
   * Showdown's handler is one call, `this.skillSwap(source, target)` -- the same call WIRE 80's
   * rewritesAbilityOnContact derivation reads off Wandering Spirit. Worry Seed, Entrainment, Role
   * Play, Simple Beam and Doodle all use setAbility (one-directional writes, different mechanics)
   * and none calls skillSwap, so the membership is exactly one move. Consumer: WIRE 110. */
  { tag: 'swapsAbilities', param: 'the user and target EXCHANGE abilities', probe: 'skillSwap',
    why: "Skill Swap (98 uses). Every damage, speed and immunity number downstream is computed from "
       + "an ability the body no longer has -- the Knock Off lesson, one field over",
    of: m => /this\.skillSwap\s*\(/.test(String(m.onHit || '')) ? { swaps: true } : null },
  /* THE MOVE-SEALING FAMILY, one mechanic with different parameters. Will: "imprison still needs a
   * tag." Imprison is the odd one and worth stating: it has NO duration, lasting as long as the
   * user stays in; it hits BOTH foes; and its blocked set is defined by the USER's own moveset
   * rather than by the target's behaviour. */
  { tag: 'sealsMoves', param: 'which of the TARGET moves are unselectable, and for how many turns', probe: 'sealsMoves',
    why: 'Encore (2,786), Taunt (881), Disable (416), Imprison (160). Nothing prunes a sealed move '
       + 'from the opponent action set, so every reply distribution includes moves that cannot be picked',
    of: m => {
      const c = m.condition || {};
      if (!c.onDisableMove && !c.onFoeDisableMove) return null;
      return { turns: c.duration || null,               /* null = lasts while the user is in */
               scope: c.onFoeDisableMove ? 'both foes' : 'one target',
               fromUsersOwnMoves: !!c.onFoeDisableMove };
    } },
  /* Will: "bug bite eats berry... and immediately gains that effect." Exactly right, and it was
   * tagged `contact` and nothing else at 105 uses.
   *
   * Bug Bite does not merely remove the berry, it CONSUMES it and the user gets the effect on the
   * spot -- so Bug Bite into a Sitrus Berry heals the attacker, and into a resist berry wastes it.
   * That is a damaging move with a heal attached, priced as a plain 60 BP hit.
   *
   * The wider family is every move that moves an item between Pokemon, which is a different
   * mechanic from readsTargetItem (reading the slot) -- these WRITE it, and board.js tracks
   * observed items, so a swap or a steal invalidates a belief the engine is holding. */
  { tag: 'takesTargetItem', param: 'moves, destroys or consumes the target item -- and may gain its effect', probe: 'takesTargetItem',
    why: 'Bug Bite (105) eats the berry and gets the effect immediately; Knock Off (1,663) removes '
       + 'it; Trick (268) swaps it. Each one invalidates an item the board is still assuming',
    of: m => {
      const src = String(m.onHit || '') + String(m.onAfterHit || '');
      const eats  = /eatItem|singleEvent\('Eat'/.test(src);
      const swaps = /setItem\(.*takeItem|myItem|yourItem/.test(src);
      const takes = /takeItem\(/.test(src);
      if (!eats && !swaps && !takes) return null;
      return { consumesAndGainsEffect: eats, swaps, removes: takes && !eats };
    } },
  /* Will: "if user is holding iron ball, the variable power heavy slam and low kick would be
   * different right, same with the float stone."
   *
   * Right in principle, wrong on Iron Ball specifically -- it halves Speed and grounds the holder
   * (onModifySpe, onEffectiveness) and does NOT touch weight. Float Stone genuinely halves weight,
   * as do the Light Metal and Heavy Metal abilities.
   *
   * The split that matters: Heavy Slam and Heat Crash compare the USER's weight to the target's,
   * while Low Kick and Grass Knot read the target's alone. build_engine_data.js stores only the
   * static species weight, so every modifier is invisible -- but the whole population of modifiers
   * is 8 sheets, well under Will's own 0.5% floor, so this is tagged and left unbuilt on purpose. */
  { tag: 'weightBased', param: 'base power comes from a weight lookup -- whose weight, and modifiable', probe: 'weightBased',
    why: 'Low Kick (1,880 uses) reads the target weight; Heavy Slam (121) reads the RATIO of user '
       + 'to target. The engine stores static species weight, so Float Stone, Light Metal and Heavy '
       + 'Metal are all invisible -- 8 sheets total, below the floor, so recorded not built',
    of: m => {
      const src = String(m.basePowerCallback || '');
      if (!/getWeight/.test(src)) return null;
      return { usesUserWeight: /pokemon\.getWeight/.test(src),
               usesTargetWeight: /target\.getWeight/.test(src) };
    } },
  /* Will: "acrobatics checks if the item is gone right, is that what variable power means... same
   * with unburden."
   *
   * variablePower flags THAT the power moves but never says on what, so Acrobatics and Low Kick
   * carried an identical tag while depending on completely different state. This names the state.
   *
   * The cluster matters more than either member. Acrobatics doubles its power with an empty item
   * slot and Unburden doubles Speed once the slot empties -- and the slot empties through Knock Off,
   * Trick, a consumed berry or a spent Focus Sash. So an opponent knocking my item off can hand me
   * a 110 BP move AND double my Speed in the same instant, a causal chain nothing in the engine can
   * currently follow. board.js began tracking observed items tonight, which is what makes it
   * computable at all. */
  { tag: 'readsOwnItem', param: 'the USER item slot changes this move -- empty is a buff, not a loss', probe: 'readsOwnItem',
    why: 'Acrobatics is 55 BP holding anything and 110 holding nothing. Paired with Unburden, losing '
       + 'an item is an upgrade, and the engine reads item loss as pure damage taken',
    of: m => {
      const src = String(m.basePowerCallback || '');
      if (!/pokemon\.item|source\.item|hasItem/.test(src)) return null;
      return { doublesWhenEmpty: /\* 2|\*2/.test(src) };
    } },
  /* Will: "psychic noise has healblock, for two turns." Correct, and it was tagged `sound` alone at
   * 96 uses. It is also the ONLY move in the format that applies heal block -- Heal Block itself is
   * never brought -- and the duration differs by source: the move lasts 5 turns, Psychic Noise's
   * version lasts 2. A single shared duration constant would have been wrong. */
  { tag: 'blocksHealing', param: 'the target cannot heal for N turns', probe: 'blocksHealing',
    why: 'Psychic Noise (96 uses) shuts off Leftovers, Sitrus, drain moves and Regenerator for two '
       + 'turns. Every heal the bot is counting on during that window is worth zero',
    of: m => {
      const src = JSON.stringify(m.secondaries || '') + String(m.volatileStatus || '');
      if (!/healblock/i.test(src)) return null;
      return { turns: /psychicnoise/.test(norm(m.id)) ? 2 : 5 };
    } },
  /* Will, deadpan: "what about the obscure alluring voice mechanic of confusion if stats were
   * raised this turn that im sure comes up every game."
   *
   * Fair. Alluring Voice is 0.13% of sheets and Burning Jealousy 0.049%, both under his own 0.5%
   * floor, and neither deserves engine surface. They are tagged anyway only because they are ONE
   * mechanic -- punish a target that boosted this turn -- so the derivation is four lines and costs
   * nothing. The floor governs what gets BUILT, not what gets named. */
  { tag: 'punishesBoostedTarget', param: 'lands an effect only if the target had a stat rise THIS turn', probe: 'punishesBoostedTarget',
    why: 'Alluring Voice confuses and Burning Jealousy burns, both conditional on the target having '
       + 'just set up. Below the build floor, recorded so the mechanic is not lost',
    of: m => {
      /* The condition is a FUNCTION inside secondaries[].onHit, and JSON.stringify drops functions
       * silently -- so stringifying the array matched nothing and the empty-tag guard caught it
       * within a minute. Same family of bug as selfBoost and onModifyMovePriority: the data was
       * there, the reader looked in a shape that could not contain it. */
      const parts = [String(m.onHit || '')];
      for (const sec of (m.secondaries || []))
        for (const k of Object.keys(sec || {}))
          if (typeof sec[k] === 'function') parts.push(String(sec[k]));
      const src = parts.join(' ');
      if (!/statsRaisedThisTurn/.test(src)) return null;
      /* WHAT IT LANDS IS NOW READ, because `{onlyIfTargetBoostedThisTurn:true}` is a CONDITION with no
       * EFFECT attached and no consumer can act on it. The two members do different things and the
       * handler says which: Burning Jealousy `trySetStatus('brn', ...)`, Alluring Voice
       * `addVolatile('confusion', ...)`. A consumer that guessed would have confused with Burning
       * Jealousy or burned with Alluring Voice. */
      const out = { onlyIfTargetBoostedThisTurn: true };
      const st = src.match(/trySetStatus\(\s*["'](\w+)["']/);
      if (st) { out.effect = 'status'; out.status = st[1]; }
      else {
        const vol = src.match(/addVolatile\(\s*["'](\w+)["']/);
        if (vol) { out.effect = 'volatile'; out.volatile = vol[1]; }
      }
      return out;
    } },
  /* Will: "soak needs a change target type category." Soak is 78 uses and rewrites the target to
   * pure Water, which invalidates every type-effectiveness number the engine holds for that
   * Pokemon -- both what it resists and what it takes. Nothing recomputes a matchup mid-battle. */
  { tag: 'changesTargetType', param: 'rewrites or extends the target typing, invalidating every matchup', probe: 'changesTargetType',
    why: 'Soak (78 uses) makes the target pure Water; Trick-or-Treat adds Ghost. The defensive type '
       + 'chart is computed once from the species and never revisited',
    of: m => {
      const src = String(m.onHit || '') + String(m.onTryHit || '');
      if (!/setType|addType/.test(src)) return null;
      return { replaces: /setType/.test(src), adds: /addType/.test(src) };
    } },
  /* Will: "high jump kick needs an if-miss-then-bad-things-happen tag." The crash is the whole
   * reason the move is a gamble -- miss and the user takes half its max HP for nothing. A scorer
   * that only weights damage-times-accuracy prices it identically to a safe move of the same
   * expected damage, which is precisely the risk blindness Will has been describing all night. */
  { tag: 'crashOnMiss', param: 'MISSING costs the user HP -- the downside is not merely zero', probe: 'crashOnMiss',
    why: 'High Jump Kick and Jump Kick take half the user max HP on a miss. Expected damage alone '
       + 'cannot distinguish a whiff that costs nothing from one that costs half your health',
    of: m => {
      const c = m.hasCrashDamage || /crash/i.test(String(m.onMoveFail || ''));
      return c ? { fraction: 0.5 } : null;
    } },
  /* Will: "pollen puff can be used to heal ur partner or as offensive attack, its genius, good luck
   * tagging that one man."
   *
   * It is genuinely the hardest shape in the set, and it breaks an assumption the whole taxonomy
   * rests on: that a move HAS a behaviour. Pollen Puff has two, chosen by who you aim at. Fired at
   * a foe it is a 90 BP special attack; fired at your partner onTryHit zeroes the base power and
   * onHit heals half their max HP instead.
   *
   * So the honest fix is not a cleverer tag, it is admitting the unit is wrong. A tag belongs to a
   * (move, target) pair, not to a move. MAG already scores every move against every legal target,
   * so the tag carries both branches and the existing loop picks the right one -- no new machinery,
   * just stopping the pretence that one move means one thing. */
  { tag: 'dualPurpose', param: 'behaves as a DIFFERENT move depending on whether the target is a foe or an ally', probe: 'dualPurpose',
    why: 'Pollen Puff (77 uses) is a 90 BP attack at a foe and a 50% heal at a partner. Scored as '
       + 'one thing it is wrong in both directions -- a wasted attack, or a heal nobody can see',
    of: m => {
      const src = String(m.onTryHit || '') + String(m.onHit || '');
      if (!/isAlly\(target\)/.test(src)) return null;
      const out = { atFoe: m.basePower ? m.basePower + ' BP attack' : 'effect',
                    atAlly: /this\.heal/.test(src) ? 'heals the ally' : 'different effect' };
      /* THE PARAM WAS TWO SENTENCES OF PROSE AND NOTHING COULD READ IT. "heals the ally" is a
       * DESCRIPTION; a consumer needs the FRACTION, and the handler states it:
       * `this.heal(Math.floor(target.baseMaxhp * 0.5))` (data/moves.ts:13589). Read it rather than
       * type 0.5 into the engine -- the same rule that took `healsOnSwitchOut` from an assumed third
       * to a read one.
       * `basePower = 0` at an ally is the other half and it is equally readable: the handler zeroes
       * it, so the tag can say that the ally branch deals no damage instead of the engine inferring
       * it from the presence of a heal. Shell Side Arm is the second member and does NEITHER, so it
       * comes out with no numbers at all and is visibly unwired rather than silently given a heal. */
      const h = src.match(/\.heal\(\s*Math\.floor\(\s*\w+\.(?:base)?[Mm]axhp\s*\*\s*([0-9.]+)/);
      if (h) out.allyHealFrac = +h[1];
      if (/move\.basePower\s*=\s*0/.test(src)) out.allyNoDamage = true;
      return out;
    } },
  /* Will: "leftovers is like a leech seed." Same key -- HP changing every turn with no action spent
   * -- arriving from an item and from a move. Leftovers is +1/16 to the holder; Leech Seed is -1/8
   * from the target AND +1/8 to the user, so it moves HP between sides rather than creating it.
   * Leech Seed carried only `statusCategory`, so the drain was not recorded anywhere. */
  { tag: 'perTurnHP', param: 'HP changes every turn with no action spent, and in which direction', probe: 'perTurnHP',
    why: 'Leftovers is +1/16 a turn (4,336 sheets) and Leech Seed is -1/8 from the target to the '
       + 'user. Both silently change who wins a damage race that the bot computes as static',
    of: m => {
      const c = m.condition || {};
      const src = String(c.onResidual || '') + String(m.onResidual || '');
      if (!/damage|heal|drain/i.test(src)) return null;
      /* Will: "idk if leftovers and leech heal the same amount." They do not, and they differ in
       * TWO ways -- which is exactly what this tag was flattening when it returned a bare fraction:
       *
       *   Leftovers    pokemon.baseMaxhp / 16   1/16 of the HOLDER's max HP
       *   Leech Seed   pokemon.baseMaxhp / 8    1/8 of the TARGET's max HP, healed to the seeder
       *
       * Double the amount, but the base is the important half: Leech Seed scales with the victim's
       * bulk, so seeding a Snorlax returns far more than seeding a Whimsicott. A tag that says only
       * "heals per turn" cannot tell those apart, and the damage race it feeds gets the wrong answer.
       * (baseMaxhp carries a capital M, so the fraction match must be case-insensitive.) */
      /* THE OLD PARAM WAS PROSE, AND WRONG PROSE. "created for the holder" was emitted for any
       * member without a heal-drain pair, which labelled Curse and Salt Cure -- pure DAMAGE
       * conditions -- as if they healed 1/4 and 1/8 a turn. A consumer would have healed the
       * victim. effect is derived from which calls the handler actually makes:
       *   heal only            -> heal   (Aqua Ring, Ingrain, Grassy Terrain)
       *   damage only          -> damage (Curse, Salt Cure)
       *   damage AND heal      -> drain  (Leech Seed: taken from the seeded, given to the seeder)
       * `per` is the denominator a consumer divides max HP by; `on` says whose HP (from the move's
       * own target field); Salt Cure's type-doubled bite and Leech Seed's Grass immunity are read
       * from the ternary and the onTryImmunity in the source, not assumed. */
      const dmg = /this\.damage\(/.test(src), heal = /this\.heal\(/.test(src);
      if (!dmg && !heal) return null;
      const effect = dmg && heal ? 'drain' : dmg ? 'damage' : 'heal';
      const frac = (src.match(/maxhp\s*\/\s*(\d+)/i) || [])[1];
      const tern = src.match(/maxhp\s*\/\s*\(\s*\w+\.hasType\(\s*\[([^\]]*)\]\s*\)\s*\?\s*(\d+)\s*:\s*(\d+)\s*\)/i);
      const imm = (String(m.onTryImmunity || '').match(/!\s*target\.hasType\(\s*"(\w+)"\s*\)/) || [])[1] || null;
      return { effect,
               per: tern ? +tern[3] : (frac ? +frac : null),
               perIfType: tern ? { types: [...tern[1].matchAll(/"(\w+)"/g)].map(x => x[1]), per: +tern[2] } : null,
               on: m.target === 'self' ? 'holder' : (m.target === 'all' ? 'field' : 'target'),
               to: effect === 'drain' ? 'user' : null,
               immuneType: imm,
               fraction: frac ? '1/' + frac : (tern ? '1/' + tern[3] : null) };
    } },
  /* THE COUNTER AND THE FEELING ARE TWO DIFFERENT NUMBERS, AND THIS TAG CARRIED THE FEELING.
   *
   * `{ turns: '4-5' }` was typed here, and it is the folk description — how many turns of chip the
   * trapped player experiences. Showdown's `partiallytrapped` carries a DURATION, it starts at 5, and
   * it is decremented in the Residual event OF THE TURN THE TRAP LANDS. So at the end of that turn the
   * authority holds 4 and this engine held 3: it initialised from the already-post-decrement 4 and then
   * ticked it again. All SEVEN trapping moves read `showdown 4 / ours 3` then `3 / 2` — the identical
   * off-by-one, which is what said it was one fact and not seven bugs.
   *
   * This is the volatile-duration defect a THIRD time (Perish Song, then ROADMAP #111's family, now
   * this), and it survived both because the counter lives in `_trap` rather than in `_vol`, so neither
   * fix's blast radius reached it. Deriving the number rather than typing it is the only version of
   * this that cannot come back: `duration` is read off the condition, the callback's range off its
   * source, and the chip divisor off `onStart`'s `boundDivisor`.
   *
   * `turns` is KEPT alongside, unchanged, because it is the honest answer to a different question —
   * how long the trap is FELT — and dropping it would silently repurpose a field. Nothing reads it now. */
  { tag: 'partialTrap',
    param: 'duration counts down from 5 in the residual, INCLUDING the turn it lands; 1/8 chip per turn',
    probe: 'partiallytrapped',
    why: 'Infestation (450 uses), Fire Spin, Sand Tomb, Whirlpool. Trapping changes what they can '
       + 'legally do, which nothing represents, and the chip is residual damage nothing counts',
    of: m => m.volatileStatus === 'partiallytrapped' ? partialTrapShape() : null },
  { tag: 'fixedDamage', param: 'damage is a constant, not a formula', probe: 'move.damage',
    why: 'Seismic Toss and Night Shade ignore stats entirely',
    of: m => m.damage ? { damage: m.damage } : null },
  /* SPLIT on Will's review: "the .75 is the same for all spread moves but we need to differ on both
   * my enemies, or both my enemies and my side too". Right, and the single tag hid the distinction
   * that matters most. Both take x0.75. Only allAdjacent touches your own partner -- which is the
   * entire Bellibolt/Discharge case, where the damage was fine and the ally was the problem. */
  { tag: 'spreadFoes', param: 'x0.75, hits BOTH ENEMIES, ally is safe', probe: 'allAdjacentFoes',
    why: 'Heat Wave, Hyper Voice, Dazzling Gleam, Blizzard, Make It Rain. Free to click beside a partner',
    of: m => m.target === 'allAdjacentFoes' ? { target: m.target, hitsAlly: false } : null },
  { tag: 'spreadAll', param: 'x0.75, hits BOTH ENEMIES AND MY PARTNER', probe: "=== 'allAdjacent'",
    why: 'Earthquake, Rock Slide, Discharge, Surf. This is the one allyHit exists for, and the one '
       + 'that killed its own Archaludon',
    of: m => m.target === 'allAdjacent' ? { target: m.target, hitsAlly: true } : null },
  /* THE THIRD TARGET SHAPE, AND IT IS THE ONE NOBODY CAN NAME A TARGET FOR. `randomNormal` hits ONE
   * body and the player does not get to say which: Showdown's `getTarget` (sim/battle.ts:2461) opens
   * with `if (move.target !== 'randomNormal' && this.validTargetLoc(...))`, so a randomNormal move
   * falls THROUGH the chosen-target branch every time and lands on `getRandomTarget`, which in a
   * double is `pokemon.side.randomFoe()` -> `sample(this.foes())` -- UNIFORM over the LIVING foes.
   * (`activePerHalf > 2` is the triples branch and is not this format.) The re-roll therefore happens
   * whether or not a target was named, which is the half that is easy to miss.
   *
   * IT IS NOT A SPREAD MOVE and must not be given `spreadFoes`: no x0.75, one body only. It exists as
   * its own tag because the CONSUMER's problem is the same one ROADMAP #81 WIRE 9 solved for the
   * spreads -- a driver that asks the authority what is legal supplies NO target for these, medicham2
   * needs one to price the click, and the click was falling through to a no-op turn. That wire
   * deliberately excluded randomNormal ("Showdown picks those with a die this engine would have to
   * guess the shape of"); this tag is the shape of the die.
   *
   * SIX MEMBERS, PRINTED BEFORE WIRING: outrage, petaldance, ragingfury, struggle, thrash, uproar. */
  { tag: 'randomTarget', param: 'ONE body, re-rolled UNIFORMLY over the living foes at execution — '
       + 'the player never names it, and a named one is overwritten', probe: 'randomTarget',
    why: 'Outrage (77 uses), Petal Dance (18), Uproar (3), Raging Fury (3), Thrash and Struggle. A '
       + 'driver that takes its targets from the authority supplies none for these, and every one of '
       + 'them was a NO-OP TURN in medicham2',
    of: m => m.target === 'randomNormal' ? { target: m.target, uniformOverLivingFoes: true } : null },
  { tag: 'priority', param: 'order = priority', probe: 'effectivePriority',
    why: 'who moves first, before speed is consulted at all',
    of: m => m.priority ? { readFrom: 'm.priority', sign: m.priority > 0 ? '+' : '-' } : null },
  { tag: 'contact', param: 'triggers contact punishment on the defender', probe: 'contact',
    why: 'Rocky Helmet, Rough Skin, Iron Barbs, Static, Flame Body all cost you for touching',
    of: m => (m.flags && m.flags.contact) ? { contact: true } : null },
  { tag: 'powder', param: 'fails into Grass types, Overcoat and Safety Goggles', probe: 'powder',
    why: 'this is how Rage Powder is beaten, and redirection is scored as if it always works',
    of: m => (m.flags && m.flags.powder) ? { powder: true } : null },
  /* Will: "will all the abilities that boost certain classes of moves need tags? like aura sphere
   * for the mega blastoise one? or slicing moves for sharpness?"
   *
   * No -- one JOIN, not a tag per ability. The ability names a FLAG and the move carries it, so
   * boostsMoveClass records which flag and this records that the move has it. Five abilities in play
   * do this (Tough Claws/contact, Sharpness/slicing, Iron Fist/punch, Mega Launcher/pulse, Strong
   * Jaw/bite) and the flags carry real weight on their own: contact 77,226 uses, wind 15,847,
   * bullet 13,644, slicing 9,772, sound 9,582.
   *
   * The flags also matter WITHOUT an ability -- wind moves are drawn by Wind Rider, bullet moves are
   * blocked by Bulletproof, sound goes through Substitute. */
  { tag: 'moveClass', param: 'the flags that abilities and immunities key on', probe: 'flags',
    why: 'contact 77,226 uses, wind 15,847, bullet 13,644, slicing 9,772. Boosted by Tough Claws, '
       + 'Sharpness, Iron Fist, Mega Launcher, Strong Jaw -- and blocked by Bulletproof, Wind Rider, '
       + 'Soundproof',
    /* `reflectable` JOINED THE LIST 2026-08-04, for Magic Bounce. It is a flag exactly like the other
     * six — Showdown's own name for the class of move a bounce can send back — and the alternative was
     * a second membership rule living in the consumer, which is invariant 3. Nothing that reads
     * `moveClass` today is affected: `boostsMoveClass` never names it, and dmgRange's
     * `immuneToMoveClass` check skips `reflectable` explicitly, because Magic Bounce grants no damage
     * immunity and treating it as one would be a new wrong number. */
    of: m => {
      const F = ['punch', 'bite', 'slicing', 'pulse', 'bullet', 'wind', 'reflectable'];
      const on = F.filter(f => m.flags && m.flags[f]);
      return on.length ? { classes: on } : null;
    } },
  /* ROADMAP #139 -- WHICH MOVES PARENTAL BOND REFUSES TO DOUBLE, read off the ability's own early
   * return rather than off a list. `parentalbond.onPrepareHit` bails on
   *     move.category === 'Status' || move.multihit || move.flags['noparentalbond']
   *     || move.flags['charge'] || move.flags['futuremove'] || move.spreadHit || isZ || isMax
   * The first two and `spreadHit` are already facts this engine holds (`hasPower`, `expectedHitsOf`,
   * the `spread` argument), so what was missing is exactly the three FLAGS -- and without them a
   * Kangaskhan-Mega's Solar Beam, Fling, Explosion and Final Gambit all got a second hit the real
   * game never gives them.
   *
   * IT IS ITS OWN TAG AND NOT THREE MORE `moveClass` CLASSES, deliberately. `moveClass` is the set of
   * flags ABILITIES key on (Bulletproof, Soundproof, Wind Rider) and it is read by `moveClassBlocked`
   * as an immunity question; adding `charge` to it would put a class into that reader that means
   * something completely different. One tag, one question.
   *
   * MEMBERSHIP PRINTED BEFORE IT WAS WIRED: 17 moves in this format -- bounce, dig, dive, electroshot,
   * fly, meteorbeam, phantomforce, skyattack, solarbeam, solarblade (charge), futuresight
   * (futuremove), and dragondarts, endeavor, explosion, finalgambit, fling, selfdestruct
   * (noparentalbond). The reason is carried per move so a consumer can tell a charge move from an
   * explicitly-excluded one. */
  /* ROADMAP #139 -- PAIN SPLIT, 151 stored clicks, `DID-NOT-FIRE`. Its tags were `neverMisses` and
   * `statusCategory` and nothing else, so `playerAction` had nothing to classify it by and the click
   * was a no-op turn. The handler is the whole mechanic and it is fully derivable:
   *     const averagehp = Math.floor((targetHP + pokemon.hp) / 2) || 1;
   *     target.sethp(target.hp - (targetHP - averagehp)); pokemon.sethp(averagehp);
   * Both bodies END ON THE SAME HP -- it is not a heal and not a chip, it is a levelling, and an
   * engine modelling it as either gets the sign wrong half the time.
   * ONE MEMBER, and that is stated rather than dressed up. What the tag buys over a name check is
   * that the ROUNDING and the `|| 1` floor come out of the handler. */
  /* ROADMAP #139 -- BLOCK AND MEAN LOOK. Will: *"block really shouldnt be that hard, its just shadow
   * tag"*. He is right, and the artifact is why it never worked: `preventsSwitch` exists, Shadow Tag
   * and Arena Trap carry it, medicham2 READS it (WIRE 92) -- and these two carried no trapping tag at
   * all. Their whole tag set was [moveClass, neverMisses, ignoresProtect, statusCategory], so the
   * roster's verdict was "SHOWDOWN REFUSED THE SWITCH AND OUR ENGINE ALLOWED IT". A TAGGER gap, not an
   * engine gap.
   *
   * NOT THE SAME TAG AS `preventsSwitch`, deliberately. That one belongs to a body standing on the
   * field and lapses the moment the carrier leaves; this is a volatile written ONTO the victim, which
   * outlives its source and travels with the victim. Two mechanisms, two tags, one reader each.
   * NOT `partiallyTrapped` either: that family (Wrap, Fire Spin) chips and expires; this does not.
   *
   * TWO MEMBERS IN THE FORMAT, printed before it was wired: block and meanlook. */
  { tag: 'trapsTarget', param: 'the target cannot switch out until the trapper leaves',
    probe: 'trapsTarget',
    why: 'Block and Mean Look: the authority REFUSES the switch and this engine allowed it, because '
       + 'neither move carried any trapping tag at all',
    of: m => {
      const src = String(m.onHit || '').replace(/\s+/g, ' ');
      const mt = src.match(/addVolatile\(\s*["'](trapped)["']/);
      if (!mt) return null;
      return { volatile: mt[1], to: 'target', endsWithSource: true };
    } },
  { tag: 'sharesHP', param: 'both bodies end on the same HP -- the average of the two',
    probe: 'sharesHP',
    why: 'Pain Split (151 stored clicks) resolved to a no-op turn: the artifact described nothing '
       + 'about it, so nothing could classify the click',
    of: m => {
      const src = String(m.onHit || '').replace(/\s+/g, ' ');
      if (!/averagehp/i.test(src) || !/sethp/i.test(src)) return null;
      const div = (src.match(/\/\s*(\d+)\s*\)/) || [])[1];
      const floor = /\|\|\s*1/.test(src) ? 1 : 0;
      return { mode: 'average', over: div ? +div : 2, minimum: floor, rounds: /Math\.floor/.test(src) ? 'floor' : null };
    } },
  /* ROADMAP #139 -- COPYCAT, 78 stored clicks, `DID-NOT-FIRE` for the same reason Pain Split was.
   * `callsMove` is a flat dex field and the SOURCE of the call is what tells the two members apart:
   * Copycat re-uses `this.lastMove` (the last move ANY body used) and Sleep Talk picks at random from
   * its own moveslots. Collapsing them into one boolean would describe two different mechanics with
   * one tag, which is the failure docs/TAGS.md names first. The refusal list is carried too --
   * Copycat declines a move flagged `failcopycat`, which is how it avoids calling itself. */
  { tag: 'callsAnotherMove', param: 'the click executes a DIFFERENT move, and this says which one',
    probe: 'callsAnotherMove',
    why: 'Copycat (78 stored clicks) and Sleep Talk resolved to a no-op turn -- the artifact said '
       + 'only that they were status moves that never miss',
    of: m => {
      if (!m.callsMove) return null;
      const src = String(m.onHit || '').replace(/\s+/g, ' ');
      const source = /this\.lastMove/.test(src) ? 'lastMove'
                   : /moveSlots/.test(src) ? 'ownRandom' : null;
      if (!source) return null;
      const refuses = [...src.matchAll(/flags\[["'](\w+)["']\]/g)].map(x => x[1]);
      return { source, refusesFlags: refuses.length ? refuses : null };
    } },
  /* ROADMAP #139 -- ENDURE, 32 stored clicks. It carries `stalling` and `statusInflict`, so the
   * engine built a `kind:'affect'` action, wrote `_vol.endure` and NOTHING READ IT -- the roster's
   * receipt is a body that should have been left on 1 HP and instead fainted. It is NOT a Protect: the
   * hit lands, every secondary and every contact punish happens, and only the HP floors at 1.
   * Derived from the condition's own `onDamage`, which is where the floor and the "a MOVE only" gate
   * both live -- burn chip and Leech Seed still kill through an Endure, and an engine that read this
   * as a blanket survival would make the move strictly better than it is. */
  { tag: 'survivesAnyHit', param: 'a damaging MOVE cannot take the user below this HP, for one turn',
    probe: 'survivesAnyHit',
    why: 'Endure (32 stored clicks) wrote its volatile and no consumer existed, so the body it was '
       + 'meant to save died anyway',
    of: m => {
      const c = m.condition || {};
      const src = String(c.onDamage || '').replace(/\s+/g, ' ');
      if (!/damage >= target\.hp/.test(src) || !/return target\.hp - (\d+)/.test(src)) return null;
      const leaves = +(src.match(/return target\.hp - (\d+)/) || [0, 1])[1];
      return { leavesHP: leaves, onlyFrom: /effectType === "Move"/.test(src) ? 'move' : null,
               duration: c.duration != null ? +c.duration : null, volatile: m.volatileStatus || null };
    } },
  { tag: 'noExtraHit', param: 'the move refuses an ability-granted extra hit (Parental Bond)',
    probe: 'noExtraHit',
    why: 'Parental Bond doubled Solar Beam, Fling, Explosion, Final Gambit and Dragon Darts, none of '
       + 'which the authority doubles -- a whole extra hit on the moves it explicitly excludes',
    of: m => {
      const F = ['noparentalbond', 'charge', 'futuremove'];
      const on = F.filter(f => m.flags && m.flags[f]);
      return on.length ? { because: on } : null;
    } },
  /* Will: "does freeze dry need like tag saying im super effective against water, or will it tell
   * us that". It will NOT tell us -- mcEff is a static type chart and Freeze-Dry overrides
   * effectiveness in an onEffectiveness handler. Our chart returns x0.5 for Ice into Water; the
   * truth for this move is x2. A FOUR-FOLD error on 748 uses, in the direction that makes MAG
   * decline a kill it actually has. */
  { tag: 'overridesEffectiveness', param: 'the type chart is WRONG for this move', probe: 'onEffectiveness',
    why: 'Freeze-Dry, 748 uses: x2 into Water where the chart says x0.5. A 4x error, and mcEff is a '
       + 'static lookup that cannot see the handler',
    /* THE OVERRIDE IS READ OUT OF THE HANDLER. `{overrides:true}` said the chart is wrong and never
     * said HOW, so a consumer could only know to distrust mcEff -- which is worth nothing. Showdown's
     * onEffectiveness returns the TYPE MODIFIER for one of the defender's types, replacing the chart's
     * contribution: Freeze-Dry returns 1 for Water, i.e. one step super-effective instead of the
     * chart's one step resisted, which is the whole 4x. `perType` maps the type name to the returned
     * modifier; a member whose handler this cannot parse gets a null and stays visibly unwired.
     * Flying Press is the second member and it ADDS a type rather than overriding one -- its handler
     * calls `runEffectiveness` with a second type -- so it parses to nothing, which is correct. */
    of: m => {
      if (!m.onEffectiveness) return null;
      const h = String(m.onEffectiveness).replace(/\s+/g, ' ');
      const perType = {};
      for (const mm of h.matchAll(/type\s*===\s*["']([A-Za-z]+)["']\s*\)\s*return\s+(-?\d+)/g))
        perType[mm[1]] = +mm[2];
      return Object.keys(perType).length ? { overrides: true, perType } : { overrides: true, perType: null };
    } },
  { tag: 'sound', param: 'bypasses Substitute, blocked by Soundproof', probe: 'flags.sound',
    why: 'also the trigger for Throat Spray',
    of: m => (m.flags && m.flags.sound) ? { sound: true } : null },
  /* SPLIT on Will's point -- "by never misses i was really thinking about the class of ATTACKING
   * moves like aerial ace". He is right, and the numbers are stark:
   *
   *   status moves that cannot miss    103 moves, 85,852 uses, 32.9% of slots -- the DEFAULT for
   *                                    anything self-targeting. Protect does not roll accuracy
   *                                    because there is nothing to roll against. Says nothing.
   *   damaging moves that cannot miss    5 moves,  3,795 uses,  1.5% -- against 156,486 uses of
   *                                    attacks that CAN miss. THAT is a property.
   *
   * Same failure as the original protectBlocked tag: tagging the 33% buries the 1.5%. Note the
   * PARAMETER is correct in both cases -- P(hit)=1 is true for Protect and the kill distribution
   * should use it -- so the split is about what is worth REVIEWING, not what is worth computing. */
  { tag: 'neverMissesAttack', param: 'P(hit) = 1 on a DAMAGING move', probe: 'accuracy === true',
    why: 'Kowtow Cleave (2,970 uses), Aura Sphere, Flower Trick, Aerial Ace. Never discounted by '
       + 'accuracy, so the kill is as certain as the roll allows. 1.5% of slots against 156,486 uses '
       + 'of attacks that can miss',
    of: m => (m.accuracy === true && m.category !== 'Status') ? { pHit: 1 } : null },
  { tag: 'neverMisses', param: 'P(hit) = 1 (the default for a self-targeting status move)', probe: 'accuracy === true',
    why: 'Correct as a PARAMETER and uninformative as a category -- Protect does not roll accuracy '
       + 'because there is nothing to roll against. Kept so the distribution reads the right P(hit), '
       + 'flagged so nobody reviews 103 status moves looking for a pattern',
    of: m => (m.accuracy === true && m.category === 'Status') ? { pHit: 1, note: 'default for status' } : null },
  /* INVERTED, on Will's review: "wouldn't it be easier to say what moves protect doesn't block".
   * Yes -- 389 moves are blocked and the exceptions are a handful, so tagging the majority made a
   * 67% column that says nothing. The EXCEPTIONS are also the actionable set, because a move that
   * ignores Protect is currently mispriced as if Protect stops it. Restricted to foe-targeting moves,
   * since Protect is simply irrelevant to a self-target or a side condition. Real users: Feint (222),
   * Phantom Force (201), Future Sight (5). */
  { tag: 'ignoresProtect', param: 'Protect does NOT stop it', probe: 'ignoresProtect',
    why: 'Feint, Phantom Force, Shadow Force. The bot values Protect as a guaranteed block, so a '
       + 'move that goes through it is mispriced on BOTH sides of the turn',
    /* SCOPED, on Will's challenge ("wdym ignores protect" -- about After You). The tag derives from
     * the ABSENCE of flags.protect, which is technically true of a status move aimed at your own
     * partner and tells you nothing: Protect was never going to block it. 17 of 31 members were
     * that kind. It now fires only where a Protect could actually have stopped something -- a
     * damaging move, or one aimed at a foe. Same defect Will found in neverMisses on Protect. */
    of: m => {
      if (m.flags && m.flags.protect) return null;
      const hitsFoe = /adjacentFoe|allAdjacentFoes|allAdjacent|^any$|^normal$/.test(m.target || '');
      if (m.category === 'Status' && !hitsFoe) return null;
      return { throughProtect: true };
    } },
  { tag: 'punishesContact', param: 'the attacker pays for touching the shield', probe: 'punishesContact',
    why: 'Spiky Shield chips 1/8, Baneful Bunker poisons, Kings Shield drops Attack. Rough Skin with '
       + 'a condition, and it makes clicking a contact move into a likely Protect worse than it looks',
    /* WHAT IT COSTS IS READ OUT OF THE HANDLER, not assumed. `{onContact:true}` named the trigger and
     * gave a consumer nothing to apply, so three moves that do three completely different things --
     * Spiky Shield chips 1/8, Baneful Bunker POISONS, King's Shield drops Attack -- were one
     * indistinguishable boolean. A consumer that guessed would have been wrong on two of the three.
     * The block itself lives on `condition.onTryHit`; `condition.onHit` is only the Z-move path, and
     * gating membership on it was already correct because every member carries both. */
    of: m => {
      if (!(m.stallingMove && m.condition && m.condition.onHit)) return null;
      const h = String(m.condition.onTryHit || '') + String(m.condition.onHit || '');
      const p = { onContact: true };
      const dmg = h.match(/damage\(\s*source\.baseMaxhp\s*\/\s*(\d+)/);
      if (dmg) p.fraction = +dmg[1];
      const st = h.match(/trySetStatus\(\s*["']([a-z]+)["']/);
      if (st) p.inflicts = st[1];
      const bo = h.match(/boost\(\s*\{([^}]*)\}/);
      if (bo) {
        const b = {};
        for (const kv of bo[1].split(',')) {
          const mm = kv.match(/([a-z]+)\s*:\s*(-?\d+)/); if (mm) b[mm[1]] = +mm[2];
        }
        if (Object.keys(b).length) p.boosts = b;
      }
      return p;
    } },
  { tag: 'stalling', param: 'is a Protect-family move', probe: 'stallingMove',
    why: 'protectThreatened and deadStall both hang off it',
    of: m => m.stallingMove ? { stalling: true } : null },
  /* WIRE 140 -- SWAPS THE TWO BODIES BETWEEN SLOTS. Ally Switch, 202 uses, and the engine had no
   * word for it at all: it resolved as `{kind:'pass'}`, a wasted turn, while the real move moves two
   * Pokemon between positions and therefore moves `species`, `hp`, `maxhp` and every boost on both
   * slots at once. Found on a staged board (tests/staged_board.js --only allyswitch-follows-the-slot)
   * rather than by reading the move list.
   * DERIVED FROM THE HANDLER, not from the name: the source of the `onHit` calls `swapPosition`, and
   * membership over this format's whole move table is exactly one move — printed by
   * `node engine/tag_dex.js --members swapsSlots` before anything read it. */
  { tag: 'swapsSlots', param: 'swaps the user with its ally between slots', probe: 'allyswitch',
    why: 'Ally Switch. The only move that moves a body between positions without it leaving the '
       + 'field, so it is the one case that tells a slot-first engine from a Pokemon-first one',
    of: m => /swapPosition\s*\(/.test(String((m.onHit || '')) ) ? { swapsSlots: true } : null },
  { tag: 'redirects', param: 'takes the turn\'s single-target attacks', probe: 'redirect',
    why: 'Follow Me and Rage Powder. A pair feature in DODUO and nothing in the single-move vector',
    of: m => (m.volatileStatus === 'followme' || m.volatileStatus === 'ragepowder') ? { redirect: true } : null },
  /* SPLIT on Will's review: "these are just switch moves not necessarily damage". Correct, and the
   * most-used one proves it -- Parting Shot is 4,782 uses and deals no damage whatsoever. Three
   * different jobs were sharing one tag:
   *   damaging pivot   U-turn, Flip Turn, Volt Switch -- hit, then leave. Momentum plus chip.
   *   status pivot     Parting Shot lowers their stats and leaves; Chilly Reception sets snow and
   *                    leaves. The switch IS the point, the effect is the payment.
   *   passes state     Baton Pass hands over the boosts, Shed Tail hands over a Substitute. The
   *                    thing that comes in inherits something, which is a different decision again. */
  { tag: 'pivotDamaging', param: 'damages, then the user leaves', probe: 'selfSwitch',
    why: 'U-turn, Flip Turn, Volt Switch. Chip plus momentum, and no switch feature can see either',
    of: m => (m.selfSwitch && m.category !== 'Status') ? { selfSwitch: m.selfSwitch } : null },
  { tag: 'pivotStatus', param: 'no damage, an effect, then the user leaves', probe: 'partingshot',
    why: 'Parting Shot (4,782 uses, the most common pivot in the format) and Chilly Reception. The '
       + 'switch is the point and the effect is the payment',
    /* ROADMAP #81 WIRE 12 -- THE EXCLUSION IS BY SHAPE NOW, NOT BY THE TWO NAMES.
     * `!/batonpass|shedtail/` and `typeof m.selfSwitch === 'string'` pick out the SAME two moves
     * today (measured: `boolean true` is chillyreception/flipturn/partingshot/uturn/voltswitch plus
     * two Past moves; `copyvolatile` is batonpass and `shedtail` is shedtail, and there is no third
     * string). The shape survives a move being added; the names do not, and CLAUDE.md opens on the
     * hand-maintained list of four that went stale. Membership is unchanged by this edit, which is
     * the point of making it here rather than after something slipped through. */
    of: m => (m.selfSwitch && m.category === 'Status' && typeof m.selfSwitch !== 'string')
             ? { selfSwitch: m.selfSwitch } : null },
  /* ROADMAP #81 WIRE 12 -- `passes: true` NAMED NOTHING A CONSUMER COULD APPLY, and the engine had
   * no consumer at all: Baton Pass and Shed Tail both resolved to a click that never switched, so
   * Heliolisk paid half its HP for a Substitute and then STOOD THERE. The two are not the same
   * move and the authority splits them on the same field this tag now reads:
   *
   *     Pokemon#copyVolatileFrom(pokemon, switchCause)          (sim/pokemon.ts:1252)
   *       if (switchCause !== 'shedtail') this.boosts = pokemon.boosts;
   *       for (const i in pokemon.volatiles) {
   *         if (switchCause === 'shedtail' && i !== 'substitute') continue;
   *
   * -- so `copyvolatile` hands over the BOOSTS AND EVERY COPYABLE VOLATILE, and `shedtail` hands
   * over the SUBSTITUTE AND NOTHING ELSE (explicitly not the boosts). `switchCause` is the move's
   * own `selfSwitch` string, which is why this derivation reads that field rather than the id. */
  { tag: 'passesState', param: 'the incoming Pokemon INHERITS something — `mode` is the authority\'s own switchCause', probe: 'batonpass',
    why: 'Baton Pass hands over the stat boosts, Shed Tail hands over a Substitute. Nothing in the '
       + 'model represents a switch that carries state across',
    of: m => typeof m.selfSwitch === 'string'
             ? { passes: true, mode: m.selfSwitch,
                 passesBoosts: m.selfSwitch !== 'shedtail',
                 passesVolatiles: m.selfSwitch === 'shedtail' ? ['substitute'] : 'all' } : null },
  /* Will: "is substitute its own class". Yes -- it is not a Protect (it does not block, it ABSORBS)
   * and not a side condition (it is on one body). It is an HP buffer that eats damage until it
   * breaks, and it also blanks status and most secondary effects while it stands. Shed Tail above is
   * the move that hands one to a teammate, which is why the two belong together. */
  { tag: 'substitute', param: 'an HP buffer that absorbs hits and blanks status until it breaks', probe: 'substitute',
    why: 'Its own class. Sound moves go through it, and the damage needed to break it is a real '
       + 'number the kill calculation would have to clear first',
    /* ROADMAP #81 WIRE 12 -- THE DOLL'S ROUNDING IS DERIVED NOW, AND IT IS `floor`. ROADMAP #81
     * WIRE 7 read this line as `Math.ceil(target.maxhp / 4)` and moved the consumer from floor to
     * ceil; `data/moves.ts:18328` says `Math.floor(target.maxhp / 4)`, and the authority staged
     * directly agrees -- a 137 HP Heliolisk's Shed Tail doll is 34 there and this engine built 35, a
     * 195 HP Farigiraf's Substitute doll is 48 against ceil's 49. So WIRE 7 was a REGRESSION on a
     * mechanic that had been right, taken on a misquoted source line. It is read from the source
     * here rather than restated in either direction, which is the only thing that stops a third
     * reading of the same line.
     *
     * BOTH MEMBERS SHARE ONE FORMULA because both declare `volatileStatus: 'substitute'` -- the doll
     * belongs to the CONDITION, not to the move -- so the condition is looked up through the
     * volatile's own move rather than off `m`, which is why Shed Tail (`condition` undefined) gets
     * the same number as Substitute. */
    of: m => {
      if (!/^(substitute|shedtail)$/.test(norm(m.id))) return null;
      const cond = String(((dex.moves.get(m.volatileStatus || 'substitute') || {}).condition || {}).onStart || '')
        .replace(/\s+/g, ' ');
      const hp = cond.match(/effectState\.hp\s*=\s*Math\.(floor|ceil|round)\(\s*\w+\.maxhp\s*\/\s*(\d+)/);
      return { buffer: hp ? 1 / +hp[2] : 0.25, rounds: hp ? hp[1] : null };
    } },
  { tag: 'forcesSwitch', param: 'the TARGET is removed from the field', probe: 'forceSwitch',
    why: 'Whirlwind, Dragon Tail, Roar. Undoes setup and changes who is in front of you',
    of: m => m.forceSwitch ? { forceSwitch: true } : null },
  { tag: 'setsWeather', param: 'weather := x', probe: 'setWeather',
    why: 'and whether that weather HELPS is the thing nothing currently asks (task #19)',
    of: m => m.weather ? { weather: m.weather } : null },
  /* Will: "do we have what each weather and terrain does? like no sleeping on electric and no
   * priority on psychic". Confirmed from the dex, and the SECOND effect is the one that matters:
   *   Electric  +Electric power, GROUNDED CANNOT SLEEP
   *   Psychic   +Psychic power, GROUNDED ARE PRIORITY-SAFE
   *   Grassy    +Grass power, +1/16 max HP each turn
   *   Misty     no status at all, -Dragon power
   * Psychic Terrain is field-wide priority blocking -- the same effect as Armor Tail, which board.js
   * DOES model via onFoeTryMove -- and nothing checks the terrain for it. Fake Out is 7,846 uses. */
  { tag: 'setsTerrain', param: 'terrain := x, with a second effect beyond the type boost', probe: 'terrain',
    why: 'Psychic Terrain blanks priority field-wide (Fake Out is 7,846 uses and nothing checks), '
       + 'Electric blocks sleep, Misty blocks all status, Grassy heals 1/16 a turn',
    of: m => m.terrain ? { terrain: m.terrain } : null },
  /* TRICK ROOM GETS ITS OWN TAG on Will's review -- "gravity and wonder room are different and
   * rare". Right: Trick Room REVERSES THE SPEED ORDER of the entire field for five turns, which is
   * the single largest state change any move makes and feeds straight into movesFirst. Gravity and
   * Wonder Room share the pseudoWeather mechanism and do something else entirely. */
  { tag: 'reversesSpeed', param: 'speed order is inverted for the whole field', probe: 'trickRoomField',
    why: 'Trick Room. MAG set this FOR Will, who had the slowest Pokemon on the field, and was then '
       + '4-0ed. It knows the field is ALREADY set (deadField) and cannot ask whether setting it helps',
    of: m => /trickroom/.test(norm(m.id)) ? { reverses: true } : null },
  /* Will: "wonder room needs its own tag for making items useless? idk how it works its rare".
   * Close -- Wonder Room SWAPS Defense and Special Defense for every Pokemon on the field for five
   * turns. It does not touch items (that is Magic Room, which suppresses them). Both are rare and
   * both invalidate a cached damage number wholesale, which is why they cannot sit under a generic
   * pseudo-weather tag: one rewrites the defending stat, the other deletes Assault Vest and Choice
   * Specs mid-calculation. */
  { tag: 'swapsDefences', param: 'Def and SpD are exchanged, field-wide', probe: 'wonderroom',
    why: 'Wonder Room. Every stored damage number is wrong while it is up',
    of: m => /wonderroom/.test(norm(m.id)) ? { swaps: true } : null },
  { tag: 'suppressesItems', param: 'held items stop working, field-wide', probe: 'magicroom',
    why: 'Magic Room. Kills Focus Sash, Choice items, Assault Vest and the berries at once',
    of: m => /magicroom/.test(norm(m.id)) ? { suppress: true } : null },
  { tag: 'setsRoom', param: 'another pseudo-weather', probe: 'pseudoWeather',
    why: 'whatever is left after Trick Room, Wonder Room, Magic Room and Gravity are split out',
    of: m => (m.pseudoWeather && !/trickroom|wonderroom|magicroom|gravity/.test(norm(m.id)))
             ? { pseudoWeather: m.pseudoWeather } : null },
  /* Will: "are there accuracy boosting tags, thats where gravity would go". There were not -- only
   * neverMisses on the move itself. Gravity raises every move's accuracy by 5/3 AND grounds Flying
   * types, so it belongs in both places; this is the accuracy half. P(hit) is already a parameter
   * the kill distribution consumes, so this feeds the same number. */
  { tag: 'accuracyMod', param: 'P(hit) is scaled for everyone', probe: 'accuracyMod',
    why: 'Gravity (x5/3 and grounds Flying), Sand Attack, Hone Claws. Feeds the same P(hit) the kill '
       + 'distribution already needs',
    of: m => (/gravity/.test(norm(m.id)) || (m.boosts && (m.boosts.accuracy || m.boosts.evasion)))
             ? { accuracy: true } : null },
  /* SPLIT THREE WAYS on Will's review: "should wide guard go on side condition or protect? i see
   * both" and "should the hazards go on side condition? its different than like reflect".
   *
   * Both right. `sideCondition` is ONE dex mechanism doing THREE unrelated jobs, and grouping them
   * made a tag that cannot mean anything:
   *   one-turn guards  Wide Guard (2,065), Quick Guard (356) -- block a CLASS of move, this turn only.
   *                    Mechanically a side condition, functionally a Protect.
   *   side buffs       Tailwind (6,981), Light Screen (2,346), Reflect (1,988), Aurora Veil (853) --
   *                    five turns, modify damage or speed.
   *   hazards          laid on the OPPONENT's side, persist until removed, and do nothing this turn:
   *                    they punish SWITCHING, which is a different decision entirely.
   * The dex distinguishes them: target === 'foeSide' is a hazard, and the guards last one turn. */
  /* THE PARAMETER NAMES THE CLASS, on Will's question about Quick Guard. Both moves were reading as
   * the same tag with the same description, which tells a model nothing -- they block completely
   * different things and are answers to completely different threats:
   *   Wide Guard    every SPREAD move. 2,065 uses. Blanks Rock Slide, Heat Wave, Earthquake.
   *   Quick Guard   every PRIORITY move. 356 uses. Blanks Fake Out (7,846 uses), Extreme Speed,
   *                 Aqua Jet -- and is the reason a Fake Out lead is not free.
   *   Crafty Shield only STATUS moves, and does NOT protect from damage.
   *   Mat Block     only DAMAGING moves, and only on the user's first turn out.
   * Derived from the condition rather than the name where possible: the handler states what it
   * refuses. */
  { tag: 'oneTurnGuard', param: 'blocks ONE NAMED CLASS of move, for one turn, for my whole side', probe: 'wideguard',
    why: 'Wide Guard blanks spread (2,065 uses), Quick Guard blanks priority (356) -- including Fake '
       + 'Out at 7,846 uses. Different threats, and nothing scores either',
    of: m => {
      if (!(m.sideCondition && /^(wideguard|quickguard|craftyshield|matblock)$/.test(norm(m.id)))) return null;
      const src = String((m.condition && m.condition.onTryHit) || '');
      const cls = /priority/i.test(src) ? 'priority moves'
                : /allAdjacent|spread/i.test(src) ? 'spread moves'
                : /Status/.test(src) ? 'status moves'
                : /Status/.test(src) === false && /matblock/.test(norm(m.id)) ? 'damaging moves'
                : 'a class stated in its handler';
      return { blocks: cls };
    } },
  /* Will: "haze clears all stat changes, idk how to tag". It is its own thing -- a RESET. Every stat
   * stage on the field goes to zero, both sides, ignoring Protect and Substitute. Nothing else in
   * the format undoes setup, and 359 uses means it is a real answer to it. The parameter is simply
   * "all boosts := 0", which is a state change no damage or kill feature can express. */
  { tag: 'clearsBoosts', param: 'every stat stage on the field := 0, both sides', probe: 'clearsBoosts',
    why: 'Haze, 359 uses. The only answer to setup in the format, and it hits YOUR boosts too -- so '
       + 'whether to click it depends on who is ahead on stages, which nothing computes',
    of: m => (/^(haze|clearsmog)$/.test(norm(m.id))
              || (m.onHitField && /clearBoost/i.test(String(m.onHitField)))
              || (m.onHit && /clearBoost/i.test(String(m.onHit)))) ? { resets: true } : null },
  /* TAILWIND GETS ITS OWN CATEGORY on Will's review -- "tailwind should really be its own category
   * because its so dominant". 6,981 uses, the most-used side condition in the format, and it sets a
   * completely different PARAMETER from the screens it was grouped with: speed order for the whole
   * team, which is what most of the kill features hang off. Screens change damage. One tag could not
   * mean both. */
  { tag: 'doublesSideSpeed', param: 'my whole side moves at x2 speed for the duration', probe: 'speedSide',
    why: 'Tailwind, 6,981 uses. Flips who moves first across every matchup on the field at once, and '
       + 'board.js already derives the speed multiplier -- it just is not scored as a CHOICE',
    of: m => (m.sideCondition && /tailwind/.test(norm(m.sideCondition))) ? { speedMult: 2 } : null },
  /* Will: "aurora veil in with reflect and light screen damage calc, fails if no snow up". Both
   * halves right, and the dex says so outright -- "For 5 turns, damage to allies halved. Snow only."
   * So it is a screen for the damage calculation AND a move that simply FAILS without its weather,
   * which is a different kind of dead move from deadField. */
  /* WHICH CATEGORY, on Will's question -- "does the light screen halve damage tag able to just block
   * special damage". It could not, and that was wrong: Reflect halves PHYSICAL only, Light Screen
   * SPECIAL only, and only Aurora Veil covers both. Treating them as one tag would have Reflect
   * reducing a Moonblast, which it does not. Derived from the dex text so it cannot be mistyped. */
  { tag: 'halvesDamage', param: 'incoming damage of ONE category is halved for my side', probe: 'screens',
    why: 'Reflect (1,988) physical only, Light Screen (2,346) special only, Aurora Veil (853) both '
       + 'and snow-only. 5,187 uses that change NO damage number anywhere in MAG today',
    of: m => {
      if (!(m.sideCondition && /reflect|lightscreen|auroraveil/.test(norm(m.sideCondition)))) return null;
      const d = String(m.shortDesc || m.desc || '');
      const cat = /physical/i.test(d) ? 'Physical' : /special/i.test(d) ? 'Special' : 'both';
      return { mult: 0.5, category: cat };
    } },
  /* Will: "can we tag sucker as need opponent to attack". Sucker Punch is 3,909 uses and it is a
   * pure READ -- it fails outright unless they are attacking, which makes it the one move whose
   * value depends entirely on predicting their choice rather than on the board. Upper Hand, Counter,
   * Mirror Coat and Metal Burst are the same shape. */
  { tag: 'needsTargetToAttack', param: 'FAILS unless the target is attacking this turn', probe: 'needsTargetToAttack',
    why: 'Sucker Punch (3,909 uses), Upper Hand, Counter, Mirror Coat, Metal Burst, Focus Punch. '
       + 'Their value is a prediction about the opponent, not a property of the board -- which is '
       + 'exactly what sigma_opp is for and nothing connects them',
    /* ONE TAG, FOUR COMPLETELY DIFFERENT BEHAVIOURS, AND THAT IS WHY IT COULD NOT BE WIRED.
     *
     * The census's own note on the Avalanche probe said it: all nine members carried the identical
     * `{needs: "target attacking"}`, and those nine double the power, reflect the damage, fail
     * outright or go first. Sucker Punch's half was live only because a SECOND and much sharper tag
     * (`failsIfTargetNotAttacking`, derived from the onTry) existed beside it. There was nothing in
     * the artifact that told Avalanche's doubling from Counter's reflection, so the fix was a TAG
     * before it was any code — written down there, unwritten here, for a month.
     *
     * `effect` IS NOW DERIVED FROM THE MOVE'S OWN CALLBACK, never from the id:
     *   damagedByTargetThisTurn  `pokemon.attackedBy.some(p => p.source === target && p.damage > 0
     *                            && p.thisTurn)` — Avalanche, Revenge. DOUBLE the base power.
     *   targetHurtThisTurn       `target.hurtThisTurn` — Assurance. DOUBLE.
     *   targetAlreadyMoved       `target.newlySwitched || this.queue.willMove(target)` returning the
     *                            UNDOUBLED power — Payback. DOUBLE when neither holds.
     *   failsOutright            an onTry that returns false — Sucker Punch, Upper Hand, Focus Punch,
     *                            Shell Trap. Already served by `failsIfTargetNotAttacking`.
     *   reflectsDamage           Counter, Mirror Coat, Metal Burst, whose damage is a `damageCallback`
     *                            over what was taken. NAMED AND NOT MODELLED: the reflected number is
     *                            a fact about a hit that already landed and this engine holds no
     *                            per-source damage ledger. Declared so it reads as a residue rather
     *                            than as an oversight.
     * MEMBERSHIP IS DELIBERATELY UNCHANGED. The list is a hand list and it should not be, but
     * narrowing it in the same pass that adds the parameter would make a wiring change and a
     * membership change indistinguishable if anything moved. */
    of: m => {
      if (!/^(suckerpunch|upperhand|counter|mirrorcoat|metalburst|focuspunch|shelltrap|revenge|avalanche|payback|assurance)$/.test(norm(m.id)))
        return null;
      const bp = String(m.basePowerCallback || ''), tryS = String(m.onTry || '');
      const out = { needs: 'target attacking' };
      if (/attackedBy\.some/.test(bp) && /p\.thisTurn|\.thisTurn/.test(bp))
        { out.effect = 'doublePower'; out.when = 'damagedByTargetThisTurn'; out.mult = 2; }
      else if (/hurtThisTurn/.test(bp))
        { out.effect = 'doublePower'; out.when = 'targetHurtThisTurn'; out.mult = 2; }
      else if (/newlySwitched/.test(bp) && /willMove\(\s*target\s*\)/.test(bp))
        { out.effect = 'doublePower'; out.when = 'targetHasNotMovedYet'; out.mult = 2; }
      else if (/return false/.test(tryS) && /willMove\(\s*target\s*\)/.test(tryS))
        { out.effect = 'failsOutright'; }
      else if (m.damageCallback)
        { out.effect = 'reflectsDamage'; out.modelled = false; }
      return out;
    } },
  /* Will: "add the thaws you out tag and make sure frozen is in there too. all secondary effects". */
  { tag: 'thawsTarget', param: 'unfreezes the target it hits', probe: 'thawsTarget',
    why: 'Scald (601 uses), Scorching Sands. Undoes a freeze you may have wanted',
    of: m => (m.thawsTarget || (m.flags && m.flags.defrost)) ? { thaws: true } : null },
  { tag: 'inflictsFreeze', param: 'P(freeze): they lose turns until thawed', probe: 'frz',
    why: '7,441 appearances carry a freeze secondary -- Ice Beam, Blizzard. Rarer than sleep and '
       + 'harder to remove',
    of: m => statusOdds(m, 'frz') },
  { tag: 'inflictsConfusion', param: 'P(confusion): they hit themselves some of the time', probe: 'confusion',
    why: '4,620 appearances. Not a status -- a volatile that adds a failure chance to every move they '
       + 'click while it lasts',
    of: m => {
      const secs = [...(m.secondaries || []), ...(m.secondary ? [m.secondary] : [])];
      for (const sec of secs) if (sec && sec.volatileStatus === 'confusion') return { p: (sec.chance || 100) / 100 };
      return m.volatileStatus === 'confusion' ? { p: 1 } : null;
    } },
  { tag: 'failsWithoutWeather', param: 'the move does NOTHING unless a weather is up', probe: 'failsWithoutWeather',
    why: 'Aurora Veil needs snow. Clicking it on a clear field is a wasted turn, and no feature can '
       + 'currently say so',
    of: m => (m.onTry && /weather/i.test(String(m.onTry))) ? { needsWeather: true } : null },
  /* THE TERRAIN TWIN, and it is not the same tag: Steel Roller FAILS OUTRIGHT with no terrain up and
   * CLEARS the terrain when it lands, which is the whole move. `terrainScaled` describes a power
   * multiplier and could not carry either half. Derived from `isTerrain("")` -- Showdown's own idiom
   * for "any terrain at all" -- and from clearTerrain(), so nothing is named. */
  { tag: 'failsWithoutTerrain', param: 'the move FAILS unless a terrain is up, and may then remove it',
    probe: 'failsWithoutTerrain',
    why: 'Steel Roller on a clear field is a wasted turn and the engine played it as a 130 BP Steel '
       + 'move. Three of the interaction matrix\'s divergences were this one move attacking when the '
       + 'reference engine had already failed it',
    of: m => {
      const t = String(m.onTry || '');
      if (!/isTerrain\(\s*""\s*\)/.test(t)) return null;
      return { needsTerrain: true,
               clears: /clearTerrain\(\)/.test(String(m.onHit || '') + String(m.onAfterSubDamage || '')) };
    } },
  { tag: 'sideBuff', param: 'another multi-turn modifier on my side', probe: 'sideBuff',
    why: 'Safeguard, Mist -- what is left once Tailwind and the screens are split out',
    /* WHAT IT REFUSES IS NOW DERIVED, AND IT HAD TO BE BEFORE ANYTHING COULD READ IT. The param was
     * `{sideCondition: "safeguard"}` and nothing else -- a NAME, with no statement of what the buff
     * actually does -- so a consumer wanting "does this side refuse a status" had exactly two
     * choices: match the string `safeguard` (a name, which docs/TAGS.md bans) or treat every sideBuff
     * as a status shield, WHICH WOULD BE WRONG FOR MIST. Mist is the other member and it refuses a
     * STAT DROP, not a status; wiring the class on the boolean would have made it a second Safeguard.
     * Membership in this format is Safeguard alone today, so nothing would have caught it.
     *
     * Read off the condition's own handlers, which is where the authority states it:
     *   onSetStatus       -> blocksStatus      (Safeguard)
     *   onTryBoost        -> blocksStatDrop    (Mist)
     *   onTryAddVolatile  -> blocksVolatile    (Safeguard also refuses confusion and Yawn)
     * `turns` comes from the condition's `duration`, never from a literal in the engine -- the same
     * rule the screens' Light Clay extension follows. */
    of: m => {
      if (!(m.sideCondition && m.target === 'allySide')) return null;
      if (/^(wideguard|quickguard|craftyshield|matblock)$/.test(norm(m.id))) return null;
      if (/tailwind|reflect|lightscreen|auroraveil/.test(norm(m.sideCondition))) return null;
      const c = m.condition || {};
      const out = { sideCondition: m.sideCondition };
      if (c.duration) out.turns = c.duration;
      if (c.onSetStatus) out.blocksStatus = true;
      if (c.onTryBoost) out.blocksStatDrop = true;
      if (c.onTryAddVolatile) out.blocksVolatile = true;
      /* THE PROTOCOL LABEL IS THE AUTHORITY'S OWN, and it is NOT uniform upstream: Reflect and
       * Safeguard announce a bare name while Light Screen, Aurora Veil and Stealth Rock announce
       * `move: NAME`. Read out of the `-sidestart` call so this engine emits what Showdown emits
       * rather than what the neighbouring condition happens to emit. */
      /* BOTH QUOTE STYLES. The dex is read out of `dist/`, which is COMPILED, and the compiler
       * rewrites the source's single quotes to double ones -- so a single-quote-only pattern silently
       * matched nothing and `startsAs` was quietly absent. Caught by printing the param before wiring
       * it, which is this file's standing rule and is what it is for. */
      const st = String(c.onSideStart || '').match(/["']-sidestart["'],\s*\w+,\s*["']([^"']+)["']/);
      if (st) out.startsAs = st[1];
      return out;
    } },
  /* HOW MANY LAYERS IS PART OF THE FACT, and this tag carried only WHICH hazard until 2026-08-10 --
   * so the one consumer (medicham2's WIRE 41) incremented unconditionally and a re-clicked Stealth
   * Rock stood at two layers against the authority's one. Measured on a turn-3 re-click, ours 2 /
   * Showdown 1 for both stealthrock and stickyweb.
   *
   * DERIVED FROM THE AUTHORITY'S OWN CONDITION, NEVER FROM A NAME LIST. Showdown expresses the whole
   * rule in one place: a hazard that can be re-laid has an `onSideRestart` handler and that handler
   * states its own ceiling (`if (this.effectState.layers >= 3) return false`). A hazard with NO
   * `onSideRestart` cannot be re-laid at all, which is a cap of exactly one. Printed before it was
   * wired, over every move in the format: spikes 3, toxicspikes 2, stealthrock 1, stickyweb 1 -- four
   * moves, no others, and the two that were wrong are the two the differential named.
   *
   * A HANDLER WHOSE CEILING CANNOT BE READ EMITS `maxLayers: null` RATHER THAN A GUESS. That is a
   * loud absence: the consumer counts it and keeps the old uncapped behaviour rather than silently
   * inventing a 1, because a wrong cap of 1 deletes real Spikes damage and is worse than the defect
   * it would be replacing. */
  { tag: 'hazard', param: 'their side is damaged or slowed on switch-in, until removed -- and HOW MANY layers it stacks to', probe: 'hazard',
    why: 'Stealth Rock, Spikes, Toxic Spikes, Sticky Web. Does nothing THIS turn -- it prices their '
       + 'future switches, which is a decision MAG does not model at all',
    of: m => {
      if (!(m.sideCondition && m.target === 'foeSide')) return null;
      return { hazard: m.sideCondition, maxLayers: hazardCap(m.sideCondition) };
    } },
  /* ROADMAP #72 -- AN ATTACKING MOVE THAT LAYS A HAZARD, and it is a TAG-DERIVATION gap rather than
   * an engine one: medicham2's hazard branch works, and nothing routed these two moves to it.
   *
   * Ceaseless Edge and Stone Axe declare NO `sideCondition` at all. What they declare is
   * `secondaries: [{}]` -- an empty secondary object, which exists only so Sheer Force can see that
   * the move has a secondary -- and the layer is laid from `onAfterHit` PLUS `onAfterSubDamage`. So
   * every rule this file already had (target === 'foeSide', a declared sideCondition) misses them
   * completely, and their tag rows held `contact` and `moveClass` and nothing else.
   *
   * IT IS A SEPARATE TAG FROM `hazard` ON PURPOSE. `hazard` means "the whole click is the hazard",
   * and medicham2's action classifier returns `kind:'hazard'` -- a status turn with no damage -- for
   * anything carrying it. Stone Axe is a 65 BP physical Rock attack that ALSO lays; putting it under
   * `hazard` would risk trading its damage for its layer on any path that reaches the classifier.
   * Two different shapes, two tags, and a consumer that wants "does this lay rocks" reads both.
   *
   * THE CAP COMES FROM THE HAZARD THAT IS LAID, NOT FROM THE MOVE THAT LAYS IT: Ceaseless Edge lays
   * Spikes and stacks to three, Stone Axe lays Stealth Rock and stops at one. Same `hazardCap`
   * lookup the declared family uses, so the two can never disagree.
   *
   * PRINTED BEFORE IT WAS WIRED, over every move in the format: exactly two members, and a sweep for
   * `addSideCondition` in ANY handler of ANY move returns the same two. No over-match. */
  { tag: 'hazardOnHit', param: 'a DAMAGING move that lays a hazard on the foe side when it CONNECTS', probe: 'hazardOnHit',
    why: 'Ceaseless Edge and Stone Axe, whose hazard lives in onAfterHit and had no tag at all -- so '
       + 'the engine laid nothing. Stone Axe is used roughly twice as often as Stealth Rock itself',
    of: m => {
      if (m.sideCondition) return null;   /* the declared family is `hazard`'s, above */
      const src = String(m.onAfterHit || '') + '\n' + String(m.onAfterSubDamage || '');
      /* BOTH QUOTE STYLES, for the reason written on sideBuff's `startsAs`: the dex is read out of
       * `dist/`, which is COMPILED, and the compiler rewrites single quotes to double ones. */
      const h = (src.match(/addSideCondition\(\s*["'](\w+)["']/) || [])[1];
      if (!h) return null;
      /* WHICH FAILURES STOP IT is the half a "does it fire" consumer gets wrong, so the pair of
       * handlers is reported rather than inferred. `onAfterSubDamage` present means the layer goes
       * down even when a Substitute ate the hit; `onAfterHit` alone would not. A miss and a Protect
       * stop both, because neither handler runs at all. */
      return { hazard: h, maxLayers: hazardCap(h),
               throughSubstitute: !!m.onAfterSubDamage, onlyOnConnect: true };
    } },
  /* Will: "does the engine know what the boostsUser actually boosts". IT DOES NOT. board.js has
   * movesBoostMe, which is a SIGN (+1/0/-1) from expectedBoostSign -- so Swords Dance (+2 Atk),
   * Calm Mind (+1 SpA/SpD) and Dragon Dance (+1 Atk/+1 SPE) all read identically, even though only
   * the last one changes who moves first. The stat is carried here so a feature can finally use it. */
  { tag: 'boostsUser', param: 'WHICH stat stages, on self, not just that there are some', probe: 'movesBoostMe',
    why: 'movesBoostMe is only a sign. +Spe flips the speed order, +Atk changes damage, +Def changes '
       + 'survival -- three different values reading as one number today',
    of: m => {
      /* THREE fields carry self stat changes and the probes read only two. Will spotted the third
       * by asking whether Clanging Scales was right: `selfBoost.boosts` (Clanging Scales), against
       * `self.boosts` (Close Combat) and `secondaries[].self.boosts` (Ancient Power). Clanging
       * Scales is a 110 BP spread move that drops the user's Defense, and the drawback was invisible. */
      const b = (m.self && m.self.boosts) || (m.selfBoost && m.selfBoost.boosts)
        || ((m.target === 'self' || m.target === 'adjacentAllyOrSelf') ? m.boosts : null);
      if (!b || !Object.values(b).some(v => v > 0)) return null;
      /* Will: "so we dont need to say -1 -1 for cc lowerUser". Right, and it is the rule for the
       * whole taxonomy now: a tag says WHICH parameter a move sets; the VALUE is looked up when it
       * is a plain dex field. Copying it here would duplicate the dex and let the two drift.
       * raisesSpeed and alsoLowers are kept because they are DERIVED -- a consumer reading this tag
       * needs to know the speed case and the mixed case without re-deriving them. */
      return { readFrom: 'm.self.boosts', raisesSpeed: (b.spe || 0) > 0,
               alsoLowers: Object.values(b).some(v => v < 0) };
    } },
  /* SPLIT BY SIGN on Will's point -- "close combat, superpower, they DECREASE user not boost".
   * Reading m.self.boosts without checking the sign swept roughly 9,500 uses of pure drawbacks into
   * a tag that says the opposite: Close Combat 5,487, Make It Rain 1,420, Draco Meteor 1,199,
   * Overheat 771, Leaf Storm 337, Superpower 182.
   *
   * AND THE FEATURE HAS THE SAME HOLE. board.js has movesBoostMe, which is
   * expectedBoostSign(selfB, ..., +1) -- it returns 1 only when something goes UP, so Close Combat
   * scores 0 and reads exactly like a move with no self-effect at all. There is no movesLowerMe.
   * So the most-used drawback attack in the format costs -1 Def and -1 SpD and MAG cannot see it,
   * which is why this needs a FEATURE and not only a tag. */
  /* Will: "what about moves like curse, shell smash, scale shot, where it boosts AND lowers".
   * Shell Smash works -- it carries boostsUser AND lowersUser, each cross-flagged so a consumer
   * reading one knows the other fired. Curse and Scale Shot do NOT, and the reason is that neither
   * declares its boosts in a field: Curse computes them in onModifyMove because they differ for
   * Ghost types, and Scale Shot declares nothing at all in this mod. Tagged from the handler so they
   * are at least VISIBLE as "this changes stats, procedurally" rather than silently absent. */
  /* Will: "do we want moonblasts secondary effect of chance to drop spa? probably not incredibly
   * useful yet but for the future". More useful than that -- 21,748 appearances carry a secondary
   * stat effect and NONE were tagged, because lowersTarget and boostsUser read only the primary
   * boosts field. It is also why Moonblast (4,048), Shadow Ball (3,297) and Earth Power (2,374)
   * showed as untagged in the coverage table and looked like plain attacks. They are not.
   *
   * The 100% ones are the point: Icy Wind, Rock Tomb and Electroweb drop Speed on every hit, which
   * is SPEED CONTROL -- a core VGC plan that nothing in the model could see. */
  /* Will: "spirit break lowers foes stats not secondaryStatEffect, or are we just calling it 100%".
   * It is declared as a SECONDARY with chance 100, and that is mechanically meaningful rather than
   * bookkeeping: Covert Cloak and Shield Dust blank SECONDARY effects, so Spirit Break's guaranteed
   * -1 SpA can be stopped while Charm's -2 Atk (a primary `boosts`) cannot. Same visible effect,
   * different counterplay -- which is exactly why the distinction is kept. */
  /* CONDITIONAL ON THE HIT — Will: "things like electroweb the secondary cant go without the
   * primary hitting". Exactly, and this has to be explicit or a consumer will treat the two as
   * independent. The real chain is:
   *
   *     P(effect) = P(not blocked by Protect/immunity) x P(hit) x P(secondary)
   *
   * So Electroweb's 100% Speed drop is 0.95 in practice, on a 95%-accurate move, and zero through a
   * Protect. The `p` recorded here is the LAST term only. Same nesting applies to every status and
   * flinch secondary -- Fake Out's 100% flinch is 100% GIVEN it lands and given it moves first. */
  { tag: 'secondaryStatEffect', param: 'P(stat change) GIVEN the move lands — multiply by P(hit); blockable by Covert Cloak and Shield Dust', probe: 'secondaries',
    why: 'Icy Wind, Rock Tomb and Electroweb drop Speed 100% of the time -- speed control. Moonblast '
       + '10% SpA, Spirit Break 100% SpA, Snarl 100%. 21,748 appearances and not one was tagged',
    of: m => {
      const secs = [...(m.secondaries || []), ...(m.secondary ? [m.secondary] : [])];
      for (const sec of secs) {
        if (!sec) continue;
        const b = sec.boosts || (sec.self && sec.self.boosts);
        if (!b) continue;
        return { p: (sec.chance || 100) / 100, boosts: b, onSelf: !!sec.self,
                 lowersSpeed: !sec.self && (b.spe || 0) < 0 };
      }
      return null;
    } },
  { tag: 'statChangeInCode', param: 'stat changes exist but are computed, not declared in a field', probe: 'statChangeInCode',
    why: 'Curse (differs for Ghost types), Scale Shot. Nothing can read the actual numbers off the '
       + 'dex, so they need a hand-written case or a live probe -- flagged rather than missed',
    /* THE LITERAL BOOST OBJECT IS READ, and only a literal one. `{procedural:true}` was carried by
     * twelve moves and named nothing a consumer could apply -- including PARTING SHOT at 7,184 corpus
     * uses, the single most-clicked move in the format whose effect this engine does not model, and
     * Belly Drum, which is a census probe.
     *
     * WHY A LITERAL ONLY, and this is the over-match guard rather than laziness: Topsy-Turvy INVERTS
     * every stage, Psych Up COPIES the target's, Guard Swap and Power Swap EXCHANGE them, Acupressure
     * picks one at RANDOM and Strength Sap scales off the target's Attack. Every one of those is a
     * `boost` call with no literal object, none of them is expressible as a stage table, and a
     * consumer handed a made-up one would be wrong on all five. They keep the tag, get no numbers,
     * and stay visibly unwired.
     * WHO it lands on comes from the move's own `target` field: Belly Drum is `self`, Parting Shot is
     * `normal`. `costFraction` is Belly Drum's directDamage.
     *
     * ---- WIRE 151, 2026-08-10: THE PARAGRAPH ABOVE IS STILL RIGHT AND IT STOPS ONE STEP SHORT. ----
     *
     * "None of them is expressible as a stage TABLE" is true, and the conclusion drawn from it -- that
     * they can therefore carry no numbers at all -- does not follow. They are not tables; they are
     * OPERATIONS, and an operation is just as derivable from the handler as a table is. Four of the
     * five above (Strength Sap is the exception and keeps its literal) are the same engine primitive:
     * READ a body's boost vector, TRANSFORM it, WRITE it to a named body. What was missing was a
     * SHAPE to say so in.
     *
     * SO `op` IS A THIRD SHAPE BESIDE `boosts`, DELIBERATELY NOT BOLTED ONTO IT. The two are disjoint
     * by construction and measured to be so over the whole move table: every member carries `boosts`
     * or `op` and never both, so a consumer reading `boosts` keeps working unchanged and cannot be
     * handed a made-up table by this addition. A consumer that does not understand an `op.kind` must
     * refuse it loudly -- the auraBoost precedent -- rather than reach for a stage table nobody derived.
     *
     * MEMBERSHIP PRINTED OVER THE WHOLE MOVE TABLE BEFORE THIS WAS WIRED, as docs/LESSONS.md 4
     * requires, AND THE FIRST VERSION OVER-MATCHED, which is exactly what that rule exists to catch:
     * a bare `this.sample(` test claimed SLEEP TALK, Metronome, Assist and Conversion 2 -- move and
     * type choosers that share the sampler and have nothing to do with stats. The rule now demands the
     * candidate list be built from a `.boosts[...] < N` gate AND the handler call `this.boost(`, which
     * is the shape of a stat pick and not of a move pick. Final membership over 954 moves: SIX --
     * acupressure, guardswap, powerswap, psychup, topsyturvy, and heartswap (isNonstandard 'Past', so
     * unplayable here; its all-seven exchange is derived correctly and simply never clicked).
     *
     * THE STAT SUBSET IS PART OF THE FACT AND IS CARRIED. Guard Swap's `["def","spd"]` and Power
     * Swap's `["atk","spa"]` are array literals in their own handlers; Psych Up, Topsy-Turvy and
     * Acupressure iterate `for (i in target.boosts)`, which is ALL SEVEN -- accuracy and evasion
     * included. A consumer that dropped the subset would turn Guard Swap into Heart Swap. */
    of: m => {
      if (m.boosts || (m.self && m.self.boosts)) return null;
      const h = String(m.onHit || '') + String(m.onModifyMove || '');
      if (!/boost/i.test(h)) return null;
      const p = { procedural: true };
      const bo = h.replace(/\s+/g, ' ').match(/this\.boost\(\s*\{([^}]*)\}/);
      if (bo) {
        const b = {};
        for (const kv of bo[1].split(',')) {
          const mm = kv.match(/([a-z]+)\s*:\s*(-?\d+)/); if (mm) b[mm[1]] = +mm[2];
        }
        if (Object.keys(b).length) { p.boosts = b; p.on = (m.target === 'self' ? 'user' : 'target'); }
      }
      const dd = h.replace(/\s+/g, ' ').match(/directDamage\(\s*\w+\.maxhp\s*\/\s*(\d+)/);
      if (dd) p.costFraction = 1 / +dd[1];
      const op = STAT_OP(h);
      if (op && !p.boosts) p.op = op;
      return p;
    } },
  /* ROADMAP #81 WIRE 12 -- CURSE IS TWO MOVES AND NO TAG SAID SO.
   *
   * Will, 2026-08-07: "CURSE HAS TWO USES, MOSTLY BY NON GHOST TYPES TO BOOST ATTACK AND DEFENSE AND
   * LOWER SPEED. GHOST TYPES USES IT TO CUT SOME OF THEIR HP AND THEN THE TARGET TAKES RESIDUAL
   * DAMAGE EACH TURN". Both halves are in data/moves.ts and NEITHER was reachable:
   *
   *   - `statChangeInCode` above reads `onHit` and `onModifyMove` only. Curse's boosts are assigned
   *     in `onTryHit`, as `move.self = { boosts: { spe: -1, atk: 1, def: 1 } }`, which is neither of
   *     those hooks NOR a `this.boost({...})` call -- so the move came back with no stat tag at all
   *     and Farigiraf read 0/0/0 against the authority's +1/+1/-1.
   *   - the GHOST half's own cost, `this.directDamage(source.maxhp / 2)`, was likewise unread, so the
   *     engine had the 1/4-per-turn chip (via `perTurnHP`) and NOTHING that paid for it. A free
   *     permanent quarter-per-turn is STRICTLY BETTER than the real move and a search learns to spam
   *     it, which makes an unpriced half worse than an absent one.
   *
   * THE SPLIT IS A DEX FIELD, NOT A NAME. `nonGhostTarget: 'self'` is declared data and it is what
   * `onModifyMove` branches on -- so this tag keys off the field's PRESENCE and reads both branches
   * out of the handlers beside it. MEMBERSHIP PRINTED BEFORE WIRING (docs/LESSONS.md 4): exactly ONE
   * move in this format carries `nonGhostTarget`, and it is Curse. Nothing over-matched.
   *
   * THE BRANCH IS ON THE USER'S TYPE AT THE MOMENT OF USE, which is `source.hasType('Ghost')` and
   * NOT the species -- a Protean body that has already converted to Ghost takes the Ghost branch.
   * `elseTarget` is carried because the TARGET changes with the branch too, and a consumer that
   * applied the boosts to the declared `normal` target would hand a foe a free +1/+1. */
  { tag: 'typeSplitMove', param: 'the move does something DIFFERENT depending on the USER\'s TYPE when it is clicked', probe: 'nonGhostTarget',
    why: 'Curse (1,058 uses). A non-Ghost gets +1 Atk / +1 Def / -1 Spe on ITSELF; a Ghost pays half '
       + 'its own max HP and hangs a 1/4-per-turn chip on the foe. One move id, two moves',
    of: m => {
      if (!m.nonGhostTarget) return null;
      const p = { splitsOnType: 'Ghost', elseTarget: m.nonGhostTarget, elseBoosts: null,
                  hasTypeVolatile: m.volatileStatus || null, hasTypeCostFraction: null };
      /* `move.self = { boosts: {...} }` -- the NON-Ghost branch, assigned inside onTryHit. */
      const h = String(m.onTryHit || '').replace(/\s+/g, ' ');
      const bo = h.match(/move\.self\s*=\s*\{\s*boosts:\s*\{([^}]*)\}/);
      if (bo) {
        const b = {};
        for (const kv of bo[1].split(',')) {
          const mm = kv.match(/([a-z]+)\s*:\s*(-?\d+)/); if (mm) b[mm[1]] = +mm[2];
        }
        if (Object.keys(b).length) p.elseBoosts = b;
      }
      /* `this.directDamage(source.maxhp / 2)` -- what the GHOST branch pays. */
      const dd = String(m.onHit || '').replace(/\s+/g, ' ')
        .match(/directDamage\(\s*\w+\.maxhp\s*\/\s*(\d+)/);
      if (dd) p.hasTypeCostFraction = 1 / +dd[1];
      return p;
    } },
  { tag: 'lowersUser', param: 'WHICH of my own stats drop, as the price of the move', probe: 'movesLowerMe',
    why: 'Close Combat (5,487 uses) pays -1 Def and -1 SpD; Draco Meteor, Overheat and Make It Rain '
       + 'pay -2 SpA. movesBoostMe only fires on a POSITIVE change, so all of them read as having no '
       + 'self-effect whatsoever',
    of: m => {
      /* THREE fields carry self stat changes and the probes read only two. Will spotted the third
       * by asking whether Clanging Scales was right: `selfBoost.boosts` (Clanging Scales), against
       * `self.boosts` (Close Combat) and `secondaries[].self.boosts` (Ancient Power). Clanging
       * Scales is a 110 BP spread move that drops the user's Defense, and the drawback was invisible. */
      const b = (m.self && m.self.boosts) || (m.selfBoost && m.selfBoost.boosts)
        || ((m.target === 'self' || m.target === 'adjacentAllyOrSelf') ? m.boosts : null);
      if (!b || !Object.values(b).some(v => v < 0)) return null;
      return { readFrom: 'm.self.boosts', lowersSpeed: (b.spe || 0) < 0,
               alsoRaises: Object.values(b).some(v => v > 0) };
    } },
  /* SPLIT BY THE SIGN OF THE EFFECT, not by the declared target, on Will's review: "coaching would
   * never be used on the enemy" and "decorate would almost never be used on the foe". Both are
   * declared target 'normal' or 'adjacentAlly', which the GAME allows to be aimed either way -- so
   * reading the target field swept 525 uses of Coaching and 18 of Decorate into a foe-debuff tag.
   * The sign is what says who you aim it at. */
  { tag: 'boostsTarget', param: 'positive stat stages on a BODY THAT IS NOT ME', probe: 'boostsAlly',
    why: 'Coaching (525 uses), Decorate, Howl, Aromatic Mist. Aimed at the partner in every real '
       + 'game, and DODUO has boostsPartnerDamage for exactly this',
    of: m => (m.boosts && m.target !== 'self'
              && Object.values(m.boosts).some(v => v > 0)
              && !Object.values(m.boosts).some(v => v < 0)) ? { boosts: m.boosts } : null },
  /* CARRIES THE STAT, on Will's review -- "the lowers target status moves need the stat and
   * direction much like the positive self boost ones". Same fix as boostsUser: -1 Speed flips the
   * speed order, -1 Attack halves their physical damage, -1 Accuracy is a different thing again, and
   * a single "lowers something" number cannot separate them. Strength Sap is why it also has to read
   * m.self.boosts and the drain -- it HEALS and lowers their Attack in one click. */
  { tag: 'lowersTarget', param: 'WHICH stat stages come off the foe, not just that some do', probe: 'movesLowerFoe',
    why: 'Charm, Fake Tears, Scary Face, Tickle, Strength Sap. -1 Spe flips the order, -1 Atk halves '
       + 'their physical output. What Clear Amulet and White Herb answer',
    of: m => {
      const b = (m.boosts && m.target !== 'self' && Object.values(m.boosts).some(v => v < 0)) ? m.boosts : null;
      if (b) return { readFrom: 'm.boosts', lowersSpeed: (b.spe || 0) < 0, lowersAttack: (b.atk || 0) < 0 };
      /* Strength Sap declares its Attack drop inside onHit rather than in boosts. */
      if (m.onHit && /boost/i.test(String(m.onHit)) && /atk|spa|spe|def|spd/i.test(String(m.onHit))
          && m.target !== 'self') return { boosts: 'via onHit', lowersAttack: /atk/i.test(String(m.onHit)) };
      return null;
    } },
  /* Will: "memento is an explosion like move, is that a tag we can add". Yes, and the dex declares
   * it -- selfdestruct is 'always' (Explosion, Self-Destruct, Misty Explosion) or 'ifHit' (Memento,
   * Final Gambit, Healing Wish). Spending your own body is a cost no feature represents, and it is
   * the one move class where a "good" score should still usually mean do not click it. */
  { tag: 'userFaints', param: 'the user dies as the cost', probe: 'selfdestruct',
    why: 'Memento, Explosion, Final Gambit, Healing Wish. Final Gambit is 176 uses and deals damage '
       + 'equal to the user remaining HP, which the damage engine reads as ZERO',
    of: m => m.selfdestruct ? { faints: m.selfdestruct } : null },
  /* Will: "was there a status section for all non damaging moves i missed so they can get the
   * prankster buff?" -- there was not. inflictsStatus is about burn/para/sleep; this is about the
   * CATEGORY, which is what Prankster keys on (+1 priority to every Status move), what Taunt blanks
   * entirely, and what an Assault Vest holder cannot click at all. Three separate interactions all
   * hanging off one property nothing named. */
  { tag: 'statusCategory', param: 'category is Status: Prankster +1, blanked by Taunt, illegal under Assault Vest', probe: 'isStatus',
    why: 'The class Prankster boosts and Taunt deletes. isStatus exists as a FEATURE but was never a '
       + 'named parameter, so nothing connected it to priorityMod or to Taunt',
    of: m => m.category === 'Status' ? { status: true } : null },
  /* Will: "encore is sorta similar to choice lock". Exactly -- choiceLock is an ITEM you carry,
   * this is the same restriction APPLIED TO THEM. Both collapse the opponent's option set to one
   * move, which is the strongest thing you can know about their next turn. */
  /* TAUNT SPLIT OUT on Will's review -- "taunt doesnt lock target it prevents status moves sorta
   * like the non existent assault vest does". Right, and they are different shapes:
   *   locksTarget       Encore pins them to ONE move, Disable removes one, Torment blocks repeats.
   *                     The option set shrinks to a specific thing.
   *   forbidsStatus     Taunt deletes an entire CATEGORY -- every Protect, every setup move, every
   *                     Tailwind. That is the same restriction Assault Vest puts on its own holder,
   *                     which is why statusCategory is the parameter both of them read.
   * Assault Vest sees no play in this format, so Taunt is the only thing exercising it. */
  { tag: 'locksTarget', param: 'their option set collapses to one specific move, or loses one', probe: 'locking',
    why: 'Encore pins them to their last move, Disable removes it, Torment blocks the repeat. '
       + 'stallIntoEncore already prices the Encore case from the RECEIVING end',
    of: m => (/^(encore|disable|torment)$/.test(norm(m.id))) ? { locks: norm(m.id) } : null },
  { tag: 'forbidsStatusMoves', param: 'the whole Status CATEGORY becomes unclickable for them', probe: 'taunt',
    why: 'Taunt. Deletes every Protect, setup move and Tailwind at once -- 38.5% of their move slots '
       + 'by share. Same restriction Assault Vest applies to its own holder',
    of: m => (m.volatileStatus === 'taunt' || /^taunt$/.test(norm(m.id))) ? { forbids: 'Status' } : null },
  /* SPLIT PER STATUS on Will's review -- "should each major status like burn have its own tag".
   * Yes, because each sets a DIFFERENT parameter, and the rollout engine already treats them apart
   * while the tag lumped them:
   *   burn        x0.5 physical damage, plus 1/16 chip
   *   paralysis   x0.5 speed, plus 12.5% full-para (Champions-specific -- the usual figure is 25%)
   *   sleep       turns lost outright
   *   poison      chip only, 1/8 or escalating
   * And Will's second point: burn arrives BOTH from a dedicated status move (Will-O-Wisp) and from a
   * damaging move's SECONDARY (Flare Blitz 10%, Matcha Gotcha 20%). Both carry the probability. */
  { tag: 'inflictsBurn', param: 'P(burn): x0.5 physical damage on them, plus chip', probe: 'brn',
    why: 'Will-O-Wisp as the move, Flare Blitz and Matcha Gotcha as a secondary. Halving their '
       + 'physical output is a damage parameter, not a status footnote',
    of: m => statusOdds(m, 'brn') },
  { tag: 'inflictsParalysis', param: 'P(paralysis): x0.5 their speed, plus 12.5% lost turns', probe: 'par',
    why: 'Changes who moves first, which most kill features hang off. Champions uses 12.5% full-para, '
       + 'not the 25% everywhere else',
    of: m => statusOdds(m, 'par') },
  { tag: 'inflictsSleep', param: 'P(sleep): they lose turns outright', probe: 'slp',
    why: 'The most valuable status in the game and the one Electric Terrain blanks',
    of: m => statusOdds(m, 'slp') },
  /* SPLIT on Will's review -- "toxic status is different than just normal poison status". Right, and
   * the difference compounds: regular poison is a flat 1/8 a turn, badly poisoned is n/16 ESCALATING,
   * so by turn six it is doing more than triple. A long game against Toxic is a different game. */
  { tag: 'inflictsPoison', param: 'P(poison): flat 1/8 chip a turn', probe: 'psn',
    why: 'Poison Jab (758 uses), Baneful Bunker on contact. Prices the long game, not this turn',
    of: m => statusOdds(m, 'psn') },
  { tag: 'inflictsToxic', param: 'P(badly poisoned): n/16 ESCALATING, not a flat 1/8', probe: 'tox',
    why: 'Toxic, 480 uses. By turn six it is doing more than triple what regular poison does, so it '
       + 'is a different clock entirely',
    of: m => statusOdds(m, 'tox') },
  /* Will: "yawn inflicts the drowzy status i think". Yes -- a VOLATILE, not a status. It puts them
   * to sleep at the END OF NEXT TURN, which is a threat rather than an effect: they get a turn to
   * switch out or to act, and the model has no way to represent a delayed consequence. */
  { tag: 'delayedSleep', param: 'they fall asleep at the end of NEXT turn unless they switch', probe: 'yawn',
    why: 'Yawn, 536 uses. Not a status this turn -- a threat that forces a switch, which is the whole '
       + 'point of clicking it',
    of: m => m.volatileStatus === 'yawn' ? { delay: 1 } : null },
  /* Will: "perish song needs its own probably". It does -- it is the only effect in the format that
   * ignores HP, typing, items and abilities entirely and kills on a three-turn timer. 560 uses. */
  /* ROADMAP #81 WIRE 12 -- `turns: 3` WAS TYPED, AND THE AUTHORITY SAYS 4.
   *
   * `perishsong.condition.duration` is 4 (data/moves.ts). Showdown's `residualEvent` decrements a
   * duration at the END of every turn INCLUDING the turn the volatile was added, so the board reads
   *
   *     set 4 -> tick -> 3 at the end of turn 1, 2 at turn 2, 1 at turn 3, 0 AND FAINT at turn 4
   *
   * and this engine set 3 and ticked to 2, which faints every affected body A FULL TURN EARLY. Both
   * halves have to be right together: setting 4 and skipping the first tick agrees on turn 1 and
   * drifts afterwards, so `turns` alone is not the fix and the consumer's tick is probed beside it.
   *
   * READ FROM `m.condition.duration`, not typed, so the constant cannot drift again -- and the
   * name is kept honest: `turns` is now the value the clock STARTS at, which is one more than the
   * number of turns the body survives. The 3 in the param string above was the old number and is
   * gone with it. If the dex ever stops declaring a duration the tag comes back with `turns: null`
   * and the consumer refuses it loudly; there is no fallback constant, which is what this was. */
  { tag: 'perishClock', param: 'everything on the field dies unless it switches; `turns` is what the clock is SET to, and it ticks at the end of the turn it was set', probe: 'perishsong',
    why: 'Perish Song, 560 uses. Ignores HP, typing, items and abilities. No damage feature can see '
       + 'it and no kill calculation applies',
    of: m => /perishsong/.test(norm(m.id))
             ? { turns: (m.condition && m.condition.duration) != null ? +m.condition.duration : null,
                 ticksOnTheTurnItIsSet: true } : null },
  /* Will: "dire claw gets all the status inflictors" ... "but sleep para poison", "well not
   * freeze", "or burn?". Exactly right, and the dex confirms it -- Dire Claw's handler is
   * `this.sample(["psn","par","slp"])`, so 30% overall is 10% each of poison, paralysis and sleep.
   * NOT freeze and NOT burn; Tri Attack is the one that rolls burn/para/freeze.
   *
   * These are invisible to statusOdds because the secondary declares only a CHANCE -- the status is
   * chosen at random inside onHit. Dire Claw is 1,509 uses and was tagged `contact` and nothing else.
   * The statuses are recovered by reading the sample list out of the handler rather than naming
   * them, so Tri Attack and anything added later fall out too. */
  { tag: 'proceduralStatus', param: 'one status from a set, chosen at random in the handler', probe: 'proceduralStatus',
    why: 'Dire Claw (1,509 uses) rolls poison / paralysis / sleep at 10% each; Tri Attack rolls '
       + 'burn / paralysis / freeze. The secondary declares a chance and no status, so every '
       + 'status probe misses them',
    of: m => {
      const secs = [...(m.secondaries || []), ...(m.secondary ? [m.secondary] : [])];
      for (const sec of secs) {
        if (!sec || !sec.chance || sec.status || sec.boosts || sec.volatileStatus) continue;
        const src = String(sec.onHit || m.onHit || '');
        const pick = /sample\(\s*\[([^\]]*)\]/.exec(src);
        if (!pick) continue;
        const list = pick[1].split(',').map(x => x.replace(/[^a-z]/gi, '')).filter(Boolean);
        if (!list.length) continue;
        return { p: sec.chance / 100, oneOf: list, each: +(sec.chance / 100 / list.length).toFixed(3) };
      }
      return null;
    } },
  /* Will: "do the drain moves need the variable how much they drain ... like some are 1/2?".
   * Measured: almost all are 1/2 and DRAINING KISS IS 3/4 (445 uses) -- same shape as recoil, mostly
   * uniform with one outlier that matters. And by the rule he set on recoil, m.drain is a plain dex
   * field, so this points at it rather than copying it. It was still copying; fixed for consistency.
   *
   * Worth noting what makes drain different from healsSelf: this restores a share of the DAMAGE
   * DEALT, so its value scales with how hard the hit lands -- clicking it into a resisted target
   * heals almost nothing. healsSelf restores a share of max HP and costs the whole turn. A move is
   * never both. */
  { tag: 'drain', param: 'heals a FRACTION OF DAMAGE DEALT, so its value scales with the hit', probe: 'drain',
    why: 'Matcha Gotcha (3,422 uses), Giga Drain, Drain Punch all 1/2; Draining Kiss 3/4. Clicking '
       + 'one into a resisted target heals almost nothing, which no feature currently expresses',
  /* THE FRACTION IS NOW CARRIED, and `readFrom` alone was not enough for a consumer that is not
   * Showdown. medicham2 has no `m.drain` to point at -- MC.moves carries `rc` for recoil and nothing
   * for drain, and data/engine-data.js is generated elsewhere and frozen to this division. So an
   * engine reading this tag could learn THAT a move drains and never how much, which is how Drain
   * Punch came to deal its damage and heal nothing at all for 8,553 corpus clicks.
   *
   * `unusual` is kept because something may already read it, and because it states the shape of the
   * distribution in one boolean. But a consumer must never have to infer 0.5 from `unusual:false` --
   * that is a silent default wearing a flag, and it would still leave Draining Kiss (3/4, 814 uses)
   * with nothing to read. */
    of: m => m.drain ? { readFrom: 'm.drain', fraction: m.drain[0] / m.drain[1],
                         unusual: (m.drain[0] / m.drain[1]) !== 0.5 } : null },
  /* Will: "some recoil moves have more recoil than others we need to modify". The FRACTION is the
   * parameter, and it ranges widely: Head Smash pays 1/2, Flare Blitz and Wave Crash 33/100, Wild
   * Charge 1/4. Flare Blitz (4,032) and Wave Crash (4,052) are top-tier moves in this format and the
   * self-damage is currently free in the score. */
  { tag: 'recoil', param: 'the user pays a FRACTION of the damage dealt', probe: 'recoil',
    why: 'Head Smash 1/2, Flare Blitz and Wave Crash 33/100 at ~4,000 uses each, Wild Charge 1/4. '
       + 'A cost nothing prices',
    /* Will: "you can just look up the wave crash recoil percent you dont need it in this tag."
     * Right, and it is the rule for the whole taxonomy: CARRY the parameter when deriving it took
     * work (the flinch probability hidden in secondaries, the charge-skip weather read out of a
     * handler, which class a guard refuses); LOOK IT UP when it is a plain dex field. m.recoil is a
     * plain field. The fraction stays here only because the review document is generated from this
     * file and a reader needs to see 1/2 against 33/100 -- consumers should read the dex. */
    of: m => {
      if (m.recoil) return { readFrom: 'm.recoil' };
      if (m.mindBlownRecoil) return { fraction: 0.5, of: 'maxhp' };
      if (m.struggleRecoil) return { fraction: 0.25, of: 'maxhp' };
      return null;
    } },
  /* RECONCILED with `drain` on Will's instruction, and split by TARGET as he asked earlier
   * ("restores hp needs a restores MY hp or restores PARTNERS hp"). They do not overlap once
   * separated: drain restores a FRACTION OF DAMAGE DEALT and only exists on an attack, while these
   * restore a fixed share of max HP and cost the whole turn. A move is never both. */
  { tag: 'healsSelf', param: 'restores a share of MY max HP, costing the turn', probe: 'healsSelf',
    why: 'Wish, Rest, Slack Off, Synthesis, Moonlight. Trades tempo for bulk, which nothing prices',
    /* 'allies' INCLUDES THE USER, so Life Dew heals self AND partner and must carry BOTH tags.
     * Will asked for "restores my hp or restores partners hp (OR BOTH)" and my first split was
     * strictly exclusive, which silently dropped the both case. */
    of: m => {
      if (!(m.heal || (m.flags && m.flags.heal)) || m.drain) return null;
      /* self, or 'allies' which INCLUDES the user (Life Dew), or a move that heals its user while
       * aiming at a foe (Strength Sap). */
      const SELFISH = ['self', 'allies', 'allySide'];
      const FRIENDLY = ['adjacentAlly', 'adjacentAllyOrSelf', 'any'];
      /* ROADMAP #102 -- HOW MUCH, when the answer is not a share of max HP at all.
       *
       * Strength Sap (693 corpus uses) reads `const atk = target.getStat("atk", false, true)` and then
       * `this.heal(atk, source, target)` -- the heal is the TARGET'S Attack STAT, boosts included. With
       * only `{heal: true}` on the tag, medicham2 could not size it, classified it as a bare stat drop,
       * and healed nothing at all. The variable is matched through from the getStat to the heal call so
       * this cannot fire on a move that reads a stat for some other purpose. */
      const src = String(m.onHit || '');
      const gs = /(?:const|let)\s+(\w+)\s*=\s*(\w+)\.getStat\(\s*"(\w+)"/.exec(src);
      const fromStat = (gs && gs[2] === 'target' && new RegExp('heal\\(\\s*' + gs[1] + '\\b').test(src))
        ? { fromTargetStat: gs[3] } : null;
      /* WIRE 152 -- SWALLOW: THE SIZE IS A TABLE INDEXED BY A VOLATILE'S LAYER COUNT.
       *
       *     const layers = pokemon.volatiles['stockpile']?.layers || 1;
       *     const healAmount = [0.25, 0.5, 1];
       *     this.heal(this.modify(pokemon.maxhp, healAmount[layers - 1]))
       *
       * The fractions are the AUTHORITY'S OWN LITERALS, read out of the handler, for the reason the
       * weather family's `baseHealFraction` is: writing 1/4 and 1/2 here would be a second copy of a
       * number that already exists upstream, and it is the copy that goes stale. BOTH VARIABLES ARE
       * THREADED through to the heal call -- the array name and the layer name must both appear in
       * the `this.heal(this.modify(...))` expression -- exactly as `fromTargetStat` above threads its
       * getStat variable, so this cannot fire on a move that happens to hold a list of numbers.
       * MEMBERSHIP MEASURED BEFORE THE PATTERN WAS TYPED: two moves in data/moves.ts read
       * `volatiles[...].layers` in an onHit (Swallow and Psych Up), and Psych Up carries no heal flag
       * and never reaches this function at all. */
      const byLayers = (() => {
        const arr = /(?:const|let)\s+(\w+)\s*=\s*\[\s*([\d.\s,]+?)\s*\]/.exec(src);
        const lay = /(?:const|let)\s+(\w+)\s*=\s*\w+\.volatiles\[["'](\w+)["']\]\??\.layers/.exec(src);
        if (!arr || !lay) return null;
        const used = new RegExp('heal\\(\\s*this\\.modify\\(\\s*\\w+\\.maxhp\\s*,\\s*'
          + arr[1] + '\\[\\s*' + lay[1] + '\\s*-\\s*1\\s*\\]');
        if (!used.test(src)) return null;
        const fr = arr[2].split(',').map(x => +x.trim());
        if (!fr.length || fr.some(x => !(x > 0))) return null;
        return { byVolatileLayers: { volatile: lay[2], fractions: fr } };
      })();
      if (SELFISH.includes(m.target)) return Object.assign({ heal: m.heal || true }, fromStat, byLayers);
      if (!FRIENDLY.includes(m.target))
        return Object.assign({ heal: m.heal || true, note: 'heals the user while targeting a foe' }, fromStat, byLayers);
      return null;
    } },
  { tag: 'healsAlly', param: 'restores my PARTNER max-HP share', probe: 'healsPartner',
    why: 'Heal Pulse, Life Dew, Floral Healing. Already a pair feature in DODUO and nothing in the '
       + 'single-move vector',
    /* WHO IS HEALED, not what the move TARGETS -- Will: "strength sap is wrong, it heals user".
     * Right: Strength Sap targets a FOE (target 'normal'), drains their Attack, and heals the USER
     * by that amount. Reading the target field called that an ally-heal. A move that carries the
     * heal flag while aiming at an OPPONENT is healing its user, the same shape as drain. */
    of: m => {
      if (!(m.heal || (m.flags && m.flags.heal)) || m.drain) return null;
      const FRIENDLY = ['allies', 'allySide', 'adjacentAlly', 'adjacentAllyOrSelf', 'any'];
      return FRIENDLY.includes(m.target) ? { heal: m.heal || true } : null;
    } },
  /* ---- WIRE 154 -- THE HEAL DESCRIPTOR, BECAUSE `healsSelf` CANNOT DESCRIBE A SINGLE ONE OF THEM --
   *
   * Four moves in this format carry `healsSelf` or `healsAlly` and NOT ONE is a plain self-heal:
   *
   *   Heal Pulse    heals the TARGET       now                half the TARGET'S max, ROUNDED UP
   *   Wish          heals whoever holds    at the residual    half the WISHER'S max -- booked on the
   *                 the SLOT               of the NEXT turn   click and spent a turn later
   *   Rest          heals the user         now                FULL, and REPLACES its status with its
   *                                                           own sleep
   *   Healing Wish  heals the REPLACEMENT  on ENTRY           FULL, clears status, and THE USER DIES
   *
   * `{heal: true}` -- which is what all four carried -- expresses none of that, so all four resolved
   * to `{kind:'pass'}`: four wasted turns, and Healing Wish was a free full restore for the next body
   * in with its whole cost missing. This tag carries WHO, WHEN, HOW MUCH, WHETHER STATUS CLEARS and
   * WHETHER THE USER FAINTS, every one of them read out of the move's own handler, `target`,
   * `slotCondition` and `selfdestruct`. Not one move is named.
   *
   * MEMBERSHIP PRINTED OVER THE WHOLE MOVE TABLE BEFORE A LINE OF THE CONSUMER WAS WRITTEN, as this
   * file's own rule requires -- 22 moves in this format carry `flags.heal` and the descriptor matches
   * FOUR. What it declines and why it declines it is the interesting half, because every one of those
   * refusals is a move some other param already sizes and a double claim would double-heal:
   *
   *   m.drain            bitterblade drainingkiss drainpunch gigadrain hornleech leechlife
   *                      matchagotcha paraboliccharge   -- a share of DAMAGE DEALT, a different tag
   *   m.heal is a PAIR   lifedew recover roost slackoff softboiled   -- `healsSelf`/`healsAlly` carry
   *                      the [1,2] / [1,4] and the engine's WIRE 150 arm already spends it
   *   a `this.modify`    moonlight morningsun synthesis swallow   -- sized by `weatherScaled
   *   factor             .baseHealFraction` and `healsSelf.byVolatileLayers`, which are 4096ths chains
   *                      and NOT the plain rounding this tag describes
   *   a bare variable    strengthsap   -- `this.heal(atk, ...)`, sized by `healsSelf.fromTargetStat`
   *
   * THE ROUNDING IS THE HANDLER'S OWN AND IT IS DIFFERENT ON TWO OF THE FOUR, which is exactly why it
   * is carried rather than assumed. Heal Pulse is `Math.ceil(target.baseMaxhp * 0.5)` -- 92 on a 183
   * HP body where a floor gives 91 -- and Wish books `source.maxhp / 2` as a raw float that
   * `Battle#heal` then TRUNCATES. A consumer that picked one rule for the family would be wrong on
   * the other member by one HP, every time, in the direction that decides a faint.
   *
   * THE VARIABLE IS THREADED IN EVERY ARM, the same discipline `fromTargetStat` and `byVolatileLayers`
   * use above: the identifier whose `maxhp` is read must be the identifier the heal is spent on (or,
   * for Wish, the `effectState` field the booking wrote must be the one `onEnd` heals from), and the
   * identifier is resolved to a ROLE through the handler's own formal parameter list rather than by
   * assuming a name. That is what tells Heal Pulse's `target` (the recipient) from Wish's `source`
   * (the user) without either move being mentioned. */
  { tag: 'healDescriptor', param: 'WHO is healed, WHEN, HOW MUCH, whether status clears and whether the user dies',
    probe: 'healDescriptor',
    why: 'Heal Pulse (148), Wish (63), Rest (60) and Healing Wish (16) all resolved to a wasted turn '
       + 'because `{heal:true}` cannot say any of those five things. Healing Wish was the worst: a '
       + 'free full restore with its own faint missing, which is strictly better than the real move',
    of: m => {
      if (!(m.flags && m.flags.heal) || m.drain) return null;
      /* SIZED BY THE DEX FIELD ALREADY. Recover, Roost, Slack Off, Soft-Boiled and Life Dew carry
       * `heal: [1,2]` / `[1,4]`, which `healsSelf`/`healsAlly` publish and the engine's WIRE 150 arm
       * spends. Claiming them here would be a SECOND reader of the same fact, which is the failure
       * CLAUDE.md's "FACTS ARE GLOBAL" rule names. */
      if (m.heal) return null;
      /* The handler's formal parameter list, so an identifier can be resolved to a ROLE. `onHit(target,
       * source)` and `onStart(pokemon, source)` both put the USER second and the body the effect is
       * resolving on first; a handler with one parameter has only the first. */
      const roleMap = (fn, roles) => {
        const sig = /^[^(]*\(([^)]*)\)/.exec(String(fn || ''));
        const out = {};
        if (sig) sig[1].split(',').map(x => x.trim().split(/[\s=]/)[0]).filter(Boolean)
          .forEach((nm, i) => { if (roles[i]) out[nm] = roles[i]; });
        return out;
      };
      const out = {};
      const cond = m.condition || null;
      if (m.slotCondition) {
        /* A SLOT CONDITION IS THE WHOLE POINT OF TWO OF THESE MOVES: the HP lands on whoever is
         * STANDING IN THAT SLOT when it resolves, which is why both survive a switch and why neither
         * can be modelled as a heal on the body that clicked. */
        out.slotCondition = norm(m.slotCondition);
        out.who = 'slot';
        if (cond && cond.onStart && cond.onEnd) {
          /* WISH. `onStart` BOOKS the amount off the user and stores it on the condition; `onEnd`
           * SPENDS it. Both halves are matched, and the field name is threaded from one to the other,
           * so a condition that merely happens to hold a number cannot fire this. */
          const st = String(cond.onStart), en = String(cond.onEnd);
          const r = roleMap(cond.onStart, ['recipient', 'user']);
          const book = /effectState\.(\w+)\s*=\s*(\w+)\.maxhp\s*\/\s*([\d.]+)/.exec(st);
          if (!book) return null;
          if (!new RegExp('heal\\(\\s*this\\.effectState\\.' + book[1] + '\\b').test(en)) return null;
          out.when = 'endOfNextTurn';
          /* `trunc`, AND IT IS THE AUTHORITY'S AND NOT A CHOICE. The booking is a raw float division
           * (`source.maxhp / 2`) and `Battle#heal` truncs its argument, so an odd max HP loses the
           * half rather than rounding it up. */
          out.amount = { fraction: 1 / (+book[3]), of: r[book[2]] || book[2], round: 'trunc' };
        } else if (cond && cond.onSwap) {
          /* HEALING WISH. The condition fires as the REPLACEMENT arrives (`onSwitchIn` -> `onSwap`),
           * and the body it heals is the one it is handed -- never the user, who by then is dead. */
          const sw = String(cond.onSwap);
          const r = roleMap(cond.onSwap, ['recipient']);
          const full = /(\w+)\.heal\(\s*\1\.maxhp\s*\)/.exec(sw);
          if (!full) return null;
          out.when = 'onEntry';
          out.amount = { full: true, of: r[full[1]] || full[1] };
          if (new RegExp('\\b' + full[1] + '\\.(?:clearStatus|cureStatus)\\(').test(sw)) out.curesStatus = true;
        } else return null;
      } else {
        const src = String(m.onHit || '');
        if (!src) return null;
        const r = roleMap(m.onHit, ['recipient', 'user']);
        /* (a) A FRACTION OF SOMEBODY'S MAX, THROUGH THE HANDLER'S OWN ROUNDING FUNCTION. The function
         *     is captured rather than assumed -- Heal Pulse ceils. Deliberately NOT matching a
         *     `this.modify(...)` factor: that is the 4096ths chain, it is a different arithmetic, and
         *     the moves that use it are already sized by `weatherScaled` and `byVolatileLayers`. */
        const frac = /this\.heal\(\s*Math\.(ceil|floor|round)\(\s*(\w+)\.(?:baseMaxhp|maxhp)\s*\*\s*([\d.]+)\s*\)\s*\)/.exec(src);
        /* (b) A FULL RESTORE. */
        const full = /this\.heal\(\s*(\w+)\.maxhp\s*\)/.exec(src);
        if (frac) out.amount = { fraction: +frac[3], of: r[frac[2]] || frac[2], round: frac[1] };
        else if (full) out.amount = { full: true, of: r[full[1]] || full[1] };
        else return null;
        out.who = 'target';
        out.when = 'now';
        const who = frac ? frac[2] : full[1];
        if (new RegExp('\\b' + who + '\\.(?:clearStatus|cureStatus)\\(').test(src)) out.curesStatus = true;
        /* REST SETS A STATUS ON THE BODY IT JUST HEALED, and `Pokemon#setStatus` REPLACES whatever was
         * there -- it refuses only the SAME status and the ordinary immunities. That is why
         * `curesStatus` is set alongside: an engine that routes this through a "one major status at a
         * time" gate heals to full and leaves the burn on, which is a strictly better move than the
         * real one. `turns` is the handler's own `statusState.time = 3` literal. */
        const sets = new RegExp('\\b' + who + '\\.setStatus\\(\\s*"(\\w+)"').exec(src);
        if (sets) {
          out.setsStatus = { status: sets[1] };
          const t = /statusState\.time\s*=\s*(\d+)/.exec(src);
          if (t) out.setsStatus.turns = +t[1];
          out.curesStatus = true;
        }
      }
      /* THE COST, FROM THE MOVE'S OWN `selfdestruct`. It duplicates nothing: `userFaints` already
       * carries this and is read by the attack and `affect` branches, and NEITHER of them is reachable
       * from a move that resolves as a heal -- so the descriptor's consumer has to be able to see it
       * without asking a second tag whether it agrees. */
      if (m.selfdestruct) out.userFaints = m.selfdestruct;
      return out;
    } },
  /* Will: "the charge turns need a weather sub tag or something that says if rain then no charge on
   * electroshot". Exactly right, and the dex declares it -- Showdown stores the skip condition on
   * the move's own condition handler, so it is derivable rather than a list. Electro Shot skips its
   * charge in RAIN, Solar Beam and Solar Blade skip in SUN. A charge move that is not charging is a
   * completely different move: full power, no free turn given away. */
  { tag: 'chargeTurn', param: 'costs a turn before it lands', probe: 'chargeTurn',
    why: 'and the request omits the target field on the locked turn, which already broke the player once',
    of: m => {
      if (!(m.flags && m.flags.charge)) return null;
      /* THE CHARGE TURN IS NOT ALWAYS EMPTY. Electro Shot and Meteor Beam raise Special Attack as
       * they wind up, and that boost is most of the reason either is worth a turn. Showdown keeps it
       * inside onTryMove as a `this.boost({spa: 1}, ...)` call, so it is read out of the handler the
       * same way the weather skip on the next tag already is -- derived, not named. A move that
       * grants nothing simply carries no `boosts` key. */
      const src = String(m.onTryMove || '');
      const frag = src.match(/boost\(\s*\{([^}]*)\}/);
      const boosts = {};
      if (frag) for (const part of frag[1].split(',')) {
        const kv = part.split(':').map(x => x.trim());
        if (kv.length === 2 && /^-?\d+$/.test(kv[1])) boosts[kv[0]] = parseInt(kv[1], 10);
      }
      return Object.keys(boosts).length ? { charge: true, boosts } : { charge: true };
    } },
  { tag: 'chargeSkippedByWeather', param: 'the charge turn DISAPPEARS under one weather', probe: 'chargeSkip',
    why: 'Electro Shot in rain, Solar Beam and Solar Blade in sun. Same move, no downside, and the '
       + 'weather that does it is usually one the user set themselves',
    of: m => {
      if (!(m.flags && m.flags.charge)) return null;
      /* DERIVED: Showdown expresses the skip inside onTryMove, which checks the field weather and
       * returns early. Reading the handler catches Electro Shot (rain), Solar Beam and Solar Blade
       * (sun) without naming any of them, and will catch whatever is added next. */
      const src = String(m.onTryMove || '');
      if (!/weather/i.test(src)) return null;
      const sun = /sunnyday|desolateland|SUNNY/i.test(src);
      const rain = /raindance|primordialsea|RAIN/i.test(src);
      return { skipsIn: sun ? 'sun' : (rain ? 'rain' : 'a weather') };
    } },
  /* THE CHARGE TURN IS NOT THE SAME DEAL FOR ALL TEN CHARGE MOVES.
   *
   * Fly, Dig, Dive, Bounce and Phantom Force spend the charge turn OFF THE FIELD and cannot be hit,
   * which is most of why they are worth giving a turn away for. Electro Shot, Solar Beam, Solar
   * Blade, Meteor Beam and Sky Attack stand there and take it. Modelling the charge without this
   * makes those first five strictly WORSE than reality -- the mirror of the bug it is part of
   * fixing, where an unmodelled charge made all ten strictly better.
   *
   * DERIVED, not listed: Showdown puts the untargetability in the move's own condition handler as
   * `onInvulnerability`, present on exactly those five and on none of the other five. */
  { tag: 'semiInvulnerable', param: 'the charge turn also takes the user off the field',
    probe: 'semiInvuln',
    why: 'Fly and Dig dodge the turn they charge; Solar Beam and Meteor Beam do not, and pricing the '
       + 'two the same way is what makes a charge move look either free or worthless',
    /* PRESENT, not truthy. Phantom Force declares `onInvulnerability: false` -- a flat false, which
     * is the STRONGEST form of it: no move gets through at all, where Fly's handler still lets Gust
     * and Thunder in. Truthy-testing the property dropped exactly the one move that dodges hardest,
     * and the tag then covered four of five while looking complete. */
    of: m => (m.flags && m.flags.charge && m.condition && ('onInvulnerability' in m.condition))
      ? { untargetable: true } : null },
  /* ONE SPEC EVERY ENGINE CAN READ, so this never has to be done a mechanic at a time.
   *
   * Will's point, and it is the right one: patching MEDICHAM per move means the next engine -- CHOMP,
   * the site, whatever comes after -- starts from zero again, and the artifact is where the knowledge
   * belongs. Showdown already states stat changes in ONE uniform shape and it covers 150 of the 954
   * moves in this format:
   *     m.boosts        + m.target === 'self'   -> the user
   *     m.boosts        + any other target      -> whoever the move hits
   *     m.self.boosts                            -> always the user (Close Combat)
   *     m.secondary(-ies).boosts + chance        -> chance-based, user if `self` is set
   * Flattened into { user: [...], target: [...] } so a consumer applies it with one loop and needs no
   * knowledge of which move it is holding. That is what makes `lowersTarget` (22 moves), `boostsUser`
   * (23) and `lowersUser` (13) one implementation instead of fifty-eight. */
  { tag: 'statChange', param: 'every stat change the move makes, and to whom',
    probe: 'statChange',
    why: 'Charm, Fake Tears and 20 other target-drops resolved to a no-op turn because nothing '
       + 'carried WHO the boost lands on; the dex says so uniformly and nobody was reading it',
    of: m => {
      const out = {};
      const add = (who, boosts, chance) => {
        if (!boosts || !Object.keys(boosts).length) return;
        (out[who] = out[who] || []).push({ boosts: Object.assign({}, boosts), chance: chance || 100 });
      };
      if (m.boosts) add(m.target === 'self' ? 'user' : 'target', m.boosts, 100);
      if (m.self && m.self.boosts) add('user', m.self.boosts, 100);
      /* `secondaries` IS `secondary`, not an addition to it. Showdown populates both -- the array
       * holds the same object the singular field points at -- so concatenating them counted every
       * secondary TWICE: Bulldoze dropped Speed twice and Ice Beam froze at 10% twice. Prefer the
       * array when it exists, which is the canonical one. */
      const secs = ((m.secondaries && m.secondaries.length) ? m.secondaries : [m.secondary]).filter(Boolean);
      for (const sec of secs) {
        if (sec.boosts) add(sec.self ? 'user' : 'target', sec.boosts, sec.chance || 100);
        if (sec.self && sec.self.boosts) add('user', sec.self.boosts, sec.chance || 100);
      }
      return Object.keys(out).length ? out : null;
    } },
  /* THE SAME TREATMENT FOR STATUS AND VOLATILES, 205 of 954 moves.
   *
   * A VOLATILE IS NOT A STATUS and conflating them is what made Encore look modelled: its dex entry
   * carries volatileStatus 'encore' and no `status`, so an engine that only reads `status` applies
   * nothing, returns a kind that looks handled, and spends the turn. Both are recorded, separately
   * and by name, so a consumer can implement the ones it supports and SEE the ones it does not. */
  { tag: 'statusInflict', param: 'status and volatile conditions the move applies, and to whom',
    probe: 'statusInflict',
    why: 'Encore, Taunt, Confuse Ray and Disable all resolve to nothing because volatiles were never '
       + 'carried anywhere; reading only `status` silently drops the entire class',
    of: m => {
      const eff = [];
      const to = (self) => (self || m.target === 'self') ? 'user' : 'target';
      if (m.status) eff.push({ status: m.status, chance: 100, to: to(false) });
      if (m.volatileStatus) eff.push({ volatile: m.volatileStatus, chance: 100, to: to(false) });
      /* `secondaries` IS `secondary`, not an addition to it. Showdown populates both -- the array
       * holds the same object the singular field points at -- so concatenating them counted every
       * secondary TWICE: Bulldoze dropped Speed twice and Ice Beam froze at 10% twice. Prefer the
       * array when it exists, which is the canonical one. */
      const secs = ((m.secondaries && m.secondaries.length) ? m.secondaries : [m.secondary]).filter(Boolean);
      for (const sec of secs) {
        if (sec.status) eff.push({ status: sec.status, chance: sec.chance || 100, to: to(sec.self) });
        if (sec.volatileStatus) eff.push({ volatile: sec.volatileStatus, chance: sec.chance || 100, to: to(sec.self) });
      }
      return eff.length ? { effects: eff } : null;
    } },
  /* WIRE 152 -- A VOLATILE THAT COUNTS LAYERS, NOT TURNS.
   *
   * `statusInflict` already says "apply the volatile `stockpile` to the user", and medicham2 did
   * exactly that: it wrote `_vol.stockpile = 1` and, because every other volatile in this engine is
   * a DURATION, refused every later click as a restart. So the counter never climbed past 1, the
   * boosts never landed at all, and both consumers -- Spit Up and Swallow -- were reading a number
   * that could only ever be one. This is the third time this project has paid for the difference
   * between a duration and a count (see docs/LESSONS.md), and it is the first time the artifact says
   * which one it is.
   *
   * WHAT THE CONDITION DECLARES, ALL OF IT READ RATHER THAN TYPED:
   *   onStart    `this.effectState.layers = 1` and `this.boost({def: 1, spd: 1}, target, target)`
   *   onRestart  `if (this.effectState.layers >= 3) return false; this.effectState.layers++`
   *   onEnd      `this.boost(boosts, target, target)` -- the refund
   *
   * `booksGranted` IS THE FIELD THAT MATTERS AND IT IS THE ONE A CONSUMER WOULD NEVER GUESS.
   * Stockpile records how many stages it ACTUALLY GRANTED (`if (curDef !== target.boosts.def)
   * this.effectState.def--`), so a body already at +6 Def is given nothing and is owed nothing back.
   * A release that subtracts the LAYER COUNT strips stages Stockpile never granted, and the error is
   * invisible on any body that started at zero.
   *
   * MEMBERSHIP MEASURED OVER THE FORMAT BEFORE THE PATTERN WAS TYPED, per docs/LESSONS.md 4: two
   * moves in data/moves.ts count `effectState.layers` in a condition -- `stockpile` and
   * `gmaxchistrike`. G-Max Chi Strike declares NO `volatileStatus` (its condition is attached by the
   * move's own handler) and is `isNonstandard: 'Past'`, so requiring a declared volatile leaves a
   * membership of exactly one, and it is the one this wire is about. */
  { tag: 'layeredVolatile', param: 'the volatile is a COUNTER with a cap, a per-layer boost, and a refund that is only what it granted',
    probe: 'layeredVolatile',
    why: 'Stockpile is the only door to Spit Up and Swallow, and a volatile written as a duration of '
       + '1 makes all three moves inert',
    of: m => {
      const c = m.condition;
      if (!m.volatileStatus || !c) return null;
      const start = String(c.onStart || ''), restart = String(c.onRestart || ''), end = String(c.onEnd || '');
      if (!/this\.effectState\.layers\s*=\s*1\b/.test(start)) return null;
      const cap = restart.match(/this\.effectState\.layers\s*>=\s*(\d+)\s*\)\s*return false/);
      if (!cap) return null;
      /* The boost table is the onStart's own literal. No table means no per-layer boost, which is a
       * legitimate shape (a pure counter) -- so it is recorded as an empty object rather than
       * refused, and the consumer can tell "grants nothing" from "nobody derived it". */
      const boosts = {};
      const b = start.match(/this\.boost\(\s*\{([^}]*)\}/);
      if (b) for (const kv of b[1].split(',')) {
        const p = kv.split(':'); if (p.length !== 2) continue;
        const k = p[0].trim().replace(/["']/g, ''), v = +p[1].trim();
        if (k && Number.isFinite(v)) boosts[k] = v;
      }
      return { volatile: m.volatileStatus, max: +cap[1], boostsPerLayer: boosts,
               booksGranted: /!==\s*target\.boosts\./.test(start) && /this\.effectState\.\w+--/.test(start),
               refundsOnEnd: /this\.boost\(\s*boosts\b/.test(end) };
    } },
  /* WIRE 152 -- THE MOVE THAT REQUIRES A VOLATILE AND SPENDS IT.
   *
   * Both halves are the same fact and separating them is how the mechanic ends up half-wired: a
   * Spit Up that reads the layer count but never clears it is a move that can be clicked forever,
   * and a Spit Up that clears it without the requirement is a 0 base power move that reports
   * SUCCESS on an empty stack (measured, before this wire: `result true` on a click that dealt
   * nothing).
   *
   * MEMBERSHIP MEASURED BEFORE THE PATTERN WAS TYPED, and the measurement is what shaped it. Six
   * moves call `removeVolatile` in an onHit or onAfterMove -- beakblast, psychup, sparklingaria,
   * spitup, swallow, tidyup -- and four of those are removing somebody ELSE'S condition rather than
   * spending their own entry fee. Requiring the onTry to demand THE SAME volatile the handler then
   * removes leaves exactly {spitup, swallow}, which is the set the authority's own `onTry(source)
   * { return !!source.volatiles[...] }` describes.
   *
   * `when` IS RECORDED BECAUSE THE TWO MEMBERS SPEND AT DIFFERENT MOMENTS. Spit Up's removal is an
   * `onAfterMove`, which Showdown runs at the end of `useMove` whether the move hit or not; Swallow's
   * is inside its `onHit`. Folding both into "afterwards" would make a blocked Spit Up keep its
   * layers, which is a strictly better move than the one in the game. */
  { tag: 'spendsVolatile', param: 'the move FAILS without a volatile and removes it when it is done',
    probe: 'spendsVolatile',
    why: 'Spit Up and Swallow are the only exits from Stockpile, and neither the entry requirement '
       + 'nor the spend had any representation at all',
    of: m => {
      const need = String(m.onTry || '').match(/!!\s*source\.volatiles\[["'](\w+)["']\]/);
      if (!need) return null;
      const after = String(m.onAfterMove || ''), hit = String(m.onHit || '');
      const rm = new RegExp('removeVolatile\\(\\s*["\']' + need[1] + '["\']');
      if (!rm.test(after) && !rm.test(hit)) return null;
      return { volatile: need[1], requires: true, when: rm.test(after) ? 'afterMove' : 'onHit' };
    } },
  /* ITEM REMOVAL, AND WHETHER IT IS A THEFT. Derived from the move's own handler: every one of
   * these calls takeItem, and the ones that also call setItem/addItem are the thefts. Knock Off
   * destroys, Covet and Thief steal, Trick and Switcheroo swap. Reading the handler catches all six
   * without naming one, and catches the next one added.
   *
   * The gap this closes was measured, not guessed: Knock Off left the target holding its Life Orb
   * and Covet stole nothing, on a move clicked 3,013 times in the corpus. */
  { tag: 'removesItem', param: 'strips the target item, and whether the user takes it',
    probe: 'removesItem',
    why: 'Knock Off is one of the most clicked moves in the format and the item survived it, so '
       + 'every Life Orb, Sash and Berry in a rollout was immortal',
    of: m => {
      const src = String(m.onHit || '') + String(m.onAfterHit || '') + String(m.onTryHit || '');
      if (!/takeItem/.test(src)) return null;
      return { steals: /setItem|addItem/.test(src) };
    } },
  /* WHICH STAT A MOVE ATTACKS WITH, AND WHICH IT ATTACKS INTO.
   *
   * Body Press attacks with DEFENCE; Psyshock attacks INTO defence. The dex states both as plain
   * fields -- overrideOffensiveStat and overrideDefensiveStat -- and MEDICHAM read neither, so Body
   * Press was computed off Attack. Measured: a Corviknight with 125 Def and one with 250 Def both
   * dealt 54.
   *
   * THIS IS A DAMAGE-PATH FIX AND IT MOVES THE DAMAGE TABLE. It therefore invalidates the fitted
   * weights, which is a refit -- taken deliberately, because a search maximises over its model and a
   * wrong damage number is a lie the search will actively seek out. */
  { tag: 'statSwap', param: 'the move uses a different stat to attack with, or to attack into',
    probe: 'statSwap',
    why: 'Body Press off Attack is not Body Press; the search prices it wrong in both directions',
    of: m => {
      const o = m.overrideOffensiveStat, d = m.overrideDefensiveStat;
      if (!o && !d) return null;
      const out = {};
      if (o) out.attackWith = String(o);
      if (d) out.attackInto = String(d);
      return out;
    } },
  /* MOVES THAT IGNORE STAT STAGES. Sacred Sword, Darkest Lariat and Chip Away ignore the target's
   * DEFENSIVE boosts; the dex says so with ignoreDefensive. Measured missing: 65 damage unboosted
   * against 23 into +4 Defence, i.e. the boost applied in full. */
  { tag: 'ignoresBoosts', param: 'the move ignores the target or user stat stages',
    probe: 'ignoresBoosts',
    why: 'a setup sweeper behind +4 Defence is exactly the position these moves exist to answer, '
       + 'and the engine let the boost stand',
    of: m => {
      if (!m.ignoreDefensive && !m.ignoreOffensive) return null;
      const out = {};
      if (m.ignoreDefensive) out.defensive = true;
      if (m.ignoreOffensive) out.offensive = true;
      return out;
    } },
  /* MOVES THAT FAIL UNLESS THE TARGET IS ATTACKING THIS TURN.
   *
   * Sucker Punch, Thunderclap, Upper Hand. MEDICHAM applied no such condition, so Sucker Punch dealt
   * its full 47 into a target setting Tailwind and into a target doing nothing at all -- the search
   * saw a 70 BP priority move with NO DRAWBACK and reached for it constantly. Will watched it lose a
   * game clicking Sucker Punch into a Fake Out, which is +3 against its +1: they flinch you first and
   * it never resolves.
   *
   * DERIVED from the move declaring an onTry that inspects what the target WILL DO. Avalanche and
   * Assurance carry the same `needsTargetToAttack` tag but express themselves through a base-power
   * callback -- they DOUBLE rather than FAIL -- so keying on onTry separates the two behaviours that
   * one tag had been conflating. */
  { tag: 'failsIfTargetNotAttacking', param: 'the move fails outright unless the target attacks',
    probe: 'failsIfTargetNotAttacking',
    why: 'Sucker Punch with no drawback is a 70 BP priority move the search cannot resist, and it '
       + 'is 6,391 corpus clicks',
    of: m => {
      const src = String(m.onTry || '');
      if (!src) return null;
      /* willMove(TARGET) specifically. The first version matched willMove|queue|getActiveMove and
       * caught QUICK GUARD and WIDE GUARD -- which call willAct() with no argument and do not care
       * what the target does -- and ROUND, which iterates the queue looking for other Rounds. Three
       * false positives on a five-move list. The real ones ask what THIS TARGET will do. */
      if (!/willMove\(\s*target\s*\)/.test(src)) return null;
      /* ROADMAP #60 -- UPPER HAND AND SUCKER PUNCH SHARE THIS TAG AND DO NOT SHARE THE CONDITION.
       * Sucker Punch refuses a STATUS move; Upper Hand additionally refuses anything at or below
       * priority 0.1, so an ordinary Earthquake beats it and the broad model had the bot believing
       * otherwise. Read off the handler's own comparison (`move.priority <= 0.1`) rather than off the
       * name, so a third member printed later carries the right condition without an edit here. */
      const out = { fails: true };
      const pri = src.match(/move\.priority\s*<=?\s*([0-9.]+)/);
      if (pri) { out.needsPriority = true; out.minPriority = +pri[1]; }
      /* The status refusal is the OTHER half and both members declare it, so it is stated rather than
       * assumed by a consumer: a Status move never satisfies either move. */
      if (/category\s*===\s*['"]Status['"]/.test(src)) out.refusesStatusTarget = true;
      return out;
    } },
  { tag: 'recharge', param: 'costs the turn AFTER it lands', probe: 'rechargeTurn',
    why: 'Hyper Beam. A free turn for the opponent',
    of: m => (m.self && m.self.volatileStatus === 'mustrecharge') ? { recharge: true } : null },
  /* THE LOCK-IN FAMILY -- Outrage, Petal Dance, Raging Fury, Thrash and Uproar. Sibling of `recharge`
   * one line up and derived from the same field, which is why it sits here: both are a move that
   * writes a volatile ONTO ITS OWN USER and both of those volatiles answer `onLockMove`. They are
   * opposite mechanics wearing one field -- recharge SPENDS the next turn, this one SELLS it.
   *
   * ---- THE FIRST SHAPE OVER-MATCHED, AND IT WAS PRINTED BEFORE IT WAS WIRED ------------------------
   * `m.self.volatileStatus && condition.onLockMove` catches ELEVEN moves in this format, not five:
   *     blastburn frenzyplant gigaimpact hydrocannon hyperbeam rockwrecker -> mustrecharge
   *     outrage petaldance ragingfury thrash                               -> lockedmove
   *     uproar                                                             -> uproar
   * `mustrecharge` carries `onLockMove: 'recharge'` because the recharge turn is also a locked menu.
   * The discriminator is a MECHANICAL fact rather than a name: `mustrecharge` additionally carries an
   * `onBeforeMove` that announces `cant` and returns null -- it REFUSES the action -- while
   * `lockedmove` and `uproar` carry none and let the forced move run. So: it locks the menu AND it
   * does not refuse the move.
   *
   * ---- THE FELT NUMBER IS NOT THE INTERNAL COUNTER, AND HERE THEY ARE THREE DIFFERENT NUMBERS -------
   * `lockedmove` (data/conditions.ts:253) declares `duration: 2` and that is NOT how long it lasts:
   *     onStart      this.effectState.trueDuration = this.random(2, 4)     <- 2 or 3, the REAL length
   *     onRestart    if (trueDuration >= 2) this.effectState.duration = 2  <- re-armed on each use
   *     onResidual   this.effectState.trueDuration--                       <- ticks with the turn
   *     onAfterMove  if (duration === 1) pokemon.removeVolatile(...)
   *     onEnd        if (trueDuration > 1) return; target.addVolatile('confusion')
   * Walked out, `duration` is a two-turn re-armable window and `trueDuration` is the number of turns
   * the user is actually forced to attack. So the FORCED TURN COUNT equals trueDuration, and the
   * declared `duration: 2` is a coincidence at the low end of the range rather than the answer.
   * `uproar` has no trueDuration at all: `duration: 3`, decremented in the residual OF THE TURN IT
   * LANDS, so it is three turns of Uproar and there the declared number IS the answer.
   *
   * `turns` IS THE MINIMUM OF THE RANGE, AND IT IS THE FIELD THE ENGINE CONSUMES -- the opposite way
   * round from `partialTrap`, which consumes `duration` and keeps `turns` as prose. This is the same
   * decision `CONFUSION_TURNS_MIN` states in medicham2: every arm in engine/game_differential.js pins
   * Showdown's RANGE form of random to the BOTTOM (`return m;`), so the authority always draws 2 under
   * measurement, and a `min + floor(rng()*span)` on our single scalar would read 3 under the top-corner
   * arm and part from it. The minimum is the only value that can be CHECKED. `turnsMax` is emitted
   * beside it so the cost is a number rather than a sentence.
   *
   * `confuseOnEnd` is read off onEnd's own `addVolatile('confusion')`, and `confuseNeedsFullRun` off
   * the `trueDuration > 1 return` guard immediately above it -- which is the rule that a lock broken
   * EARLY does not fatigue. Uproar gets neither, and gets `wakesSleepers` / `blocksSleep` instead,
   * both read off handlers rather than off its name. */
  { tag: 'locksIntoMove', param: 'the user is forced to repeat this move for `turns` turns',
    probe: 'locksIntoMove',
    why: 'Outrage (77 uses), Petal Dance (18), Uproar (3), Raging Fury (3), Thrash. All five sit at '
       + 'DID-NOT-FIRE in data/roster.moves.json -- the user got a free choice on turn 2 and never '
       + 'fatigued',
    of: m => lockShape(m) },
  /* THE PROBABILITY IS THE PARAMETER, not the yes/no. Will: "these are just % chance to flinch
   * right?" -- yes, and they run from 10% to 100%. A single tag put Fake Out (100%, +3 priority)
   * beside Fire Fang (10%), which is not a distinction a model can afford to lose. Only matters when
   * the user moves FIRST, so the real quantity is P(flinch) x P(I outspeed). */
  { tag: 'flinches', param: 'P(flinch), 10% to 100%, and only if I move first', probe: 'flinch',
    why: 'Fake Out 100% at +3, Rock Slide 30%, Iron Head 20%, the fangs 10%. Blocked by Covert Cloak '
       + 'and Inner Focus, neither of which is checked',
    of: m => {
      let p = null;
      if (m.volatileStatus === 'flinch') p = 100;
      for (const s of (m.secondaries || [])) if (s && s.volatileStatus === 'flinch') p = s.chance || 100;
      if (m.secondary && m.secondary.volatileStatus === 'flinch') p = m.secondary.chance || 100;
      return p === null ? null : { pFlinch: p / 100 };
    } },
  { tag: 'ignoresAbility', param: 'the defender\'s ability does not apply', probe: 'ignoreAbility',
    why: 'Mold Breaker-style moves walk through Levitate and the damage-reducing abilities',
    of: m => m.ignoreAbility ? { ignoreAbility: true } : null },
  { tag: 'ohko', param: 'removes the target outright', probe: 'ohko',
    why: 'a different kill calculation entirely',
    of: m => m.ohko ? { ohko: true } : null },
  /* THE PRE-TURN CLASS. Will, 2026-08-04: "BEAK BLAST IS LIKE SPICY SPRAY FOCUS PUNCH OR SOMETHING."
   * He is naming a real class and nothing in this artifact named it. Focus Punch, Beak Blast and
   * Shell Trap all act at the START of the turn, before any move resolves, and then react to what
   * happened to them while they waited. `chargeTurn` is a DIFFERENT mechanic -- Fly and Solar Beam
   * span two turns and are semi-invulnerable -- so it could not carry these.
   *
   * DERIVED, NOT NAMED, and the shape is the same one that turned out to be true of Air Lock's
   * `suppressWeather`: Showdown declares the phase with a flat property, `priorityChargeCallback`,
   * which every existing derivation here was blind to because they all probe a handler by NAME.
   *
   * IT OVER-MATCHES BY ONE AND THE MEMBERSHIP PRINT IS WHY THAT IS KNOWN. Four moves carry
   * priorityChargeCallback; CHILLY RECEPTION is the fourth and its volatile has no onHit at all --
   * it announces a message and switches. So the discriminator is the volatile REACTING to a hit,
   * which is what the class actually is. Giving Chilly Reception a shield would be a new wrong
   * number, which is what wiring the bare property would have done.
   *
   * WHAT IT DOES is read out of that same onHit: trySetStatus on the SOURCE is a punish (Beak
   * Blast), a lostFocus flag is a failure condition (Focus Punch), a gotHit flag is the inverse
   * (Shell Trap fails UNLESS hit). `trigger` and `foesOnly` come from the same body, so a consumer
   * never has to know which move it is holding. */
  { tag: 'preTurnShield', param: 'acts at the START of the turn, then reacts to what hit it: mode + trigger',
    probe: 'preTurnShield',
    why: 'Focus Punch fails if you touch it, Beak Blast burns you for touching it. Both were '
       + 'unconditional attacks in this engine, and Beak Blast is 14 of the interaction matrix\'s '
       + 'remaining divergences on its own',
    of: m => {
      if (!m.priorityChargeCallback) return null;
      const onHit = String((m.condition && m.condition.onHit) || '');
      if (!onHit) return null;   /* Chilly Reception: a volatile that reacts to nothing */
      const out = { setsUpAtTurnStart: true };
      if (/category\s*!==\s*["']Status["']/.test(onHit))       out.trigger = 'damaging';
      else if (/category\s*===\s*["']Physical["']/.test(onHit)) out.trigger = 'physical';
      else if (/checkMoveMakesContact/.test(onHit))            out.trigger = 'contact';
      else return null;
      if (/!\s*\w+\.isAlly\(/.test(onHit)) out.foesOnly = true;
      const st = onHit.match(/trySetStatus\(\s*["'](\w+)["']/);
      if (st)                                      { out.mode = 'punishAttacker'; out.status = st[1]; }
      else if (/lostFocus\s*=\s*true/.test(onHit))   out.mode = 'failsIfHit';
      else if (/gotHit\s*=\s*true/.test(onHit))      out.mode = 'failsUnlessHit';
      else return null;
      if (/prioritizeAction/.test(onHit)) out.thenMovesNext = true;
      return out;
    } },
];

const ITEM_TAGS = [
  /* ROADMAP #139 -- SHED SHELL, AND AN OVER-REFUSAL IS A DEFECT EXACTLY AS AN UNDER-REFUSAL IS.
   * medicham2's ability-trapping branch already carried a comment admitting this gap by name ("SHED
   * SHELL IS NOT HONOURED ON THIS BRANCH and that is a stated gap"). The mega agent's Shadow Tag
   * fixture read it as `OURS-REFUSED-AND-THE-AUTHORITY-DID-NOT`: a bot that believes it is trapped
   * will not switch when switching is right, and that is a lost game rather than a rounding error.
   *
   * ASKED OF THE FORMAT RATHER THAN LISTED: exactly ONE item in Reg M-B declares `onTrapPokemon`, and
   * NO ability does. So this tag has one member and its emptiness elsewhere is a fact about the
   * regulation, not a hole in the predicate -- which is why the count is worth printing. */
  { tag: 'escapesTrap', param: 'the holder is never trapped -- its escape option survives',
    probe: 'onTrapPokemon',
    why: 'Shed Shell. The engine refuses a switch the authority allows, which is the direction that '
       + 'costs a game rather than a point of HP',
    of: i => {
      const src = String(i.onTrapPokemon || '').replace(/\s+/g, ' ');
      if (!/trapped = false/.test(src)) return null;
      return { escapes: true, scope: 'ability' };
    } },
  { tag: 'megaStone', param: 'the holder becomes another species', probe: 'megaStone',
    why: 'different stats, typing and ability from turn one',
    of: it => it.megaStone ? { into: it.megaStone } : null },
  { tag: 'survivesFromFull', param: 'a lethal MOVE from full HP leaves 1; the sash is spent doing it', probe: 'survivesFromFull',
    why: 'Focus Sash, the most-held item in the format. Broken by multi-hit moves and by any prior chip',
    /* Was a name check — the exact defect this file exists to kill. The handler states everything:
     * the full-HP gate, the Move-only gate (sash does not stop burn chip), the survive-at-1, and
     * useItem() marks the one-shot. Sturdy matches the same idiom minus the consumption. */
    of: it => {
      const src = String(it.onDamage || '');
      if (!/hp\s*===\s*\w+\.maxhp/.test(src) || !/damage\s*>=\s*\w+\.hp/.test(src) || !/hp\s*-\s*1/.test(src)) return null;
      return { leavesHP: 1, onlyFromFullHP: true,
               movesOnly: /effectType\s*===\s*"Move"/.test(src),
               consumesItem: /useItem\(\)/.test(src) };
    } },
  { tag: 'choiceLock', param: 'the holder is locked into one move', probe: 'locking',
    why: 'the single strongest thing an open sheet tells you about what they can do next turn',
    of: it => (it.isChoice) ? { choice: true } : null },
  /* WAS A NAME HARDCODE — `norm(it.name) === 'choicescarf'` — WHICH IS THE ONE THING CLAUDE.md SAYS
   * NOT TO DO: "match on tag shape, never on a name, so an ability added later is picked up without
   * editing the engine." The very next rule in this file records that same lesson being learned for
   * Life Orb, and this one sat unfixed above it.
   *
   * IT COST A LIVE ROW. Iron Ball halves Speed through the identical handler, carried **139 sheet
   * uses**, and the roster read it DID-NOT-FIRE — not because the consumer was missing (`effSpeed`
   * has read `speedMult` since WIRE 91) but because the ARTIFACT never told it. A working consumer
   * starved by a hardcoded producer.
   *
   * Derived from `onModifySpe`'s own `chainModify` now. Membership in this format is exactly two:
   *
   *     Choice Scarf   7,844 uses   x1.5      (unchanged)
   *     Iron Ball        139 uses   x0.5      (new — this is the roster row)
   *
   * Scarf's handler also bails under `dynamax`, which does not exist in this format; the guard is
   * ignored rather than modelled, and stating that is cheaper than pretending it was read. */
  { tag: 'speedMult', param: 'the holder\'s Speed is multiplied', probe: 'onModifySpe',
    why: 'order, which most kill features hang off',
    of: (it) => {
      const src = String(it.onModifySpe || '').replace(/\s+/g, ' ');
      if (!src) return null;
      const frac = src.match(/chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/);
      if (frac) return { mult: +frac[1] / +frac[2], readFrom: 'onModifySpe' };
      const flat = src.match(/chainModify\(\s*([\d.]+)\s*\)/);
      /* NO SILENT DEFAULT. A handler this cannot read emits no tag, so the consumer refuses rather
       * than applying a guessed multiplier — #92's rule, and the reason the pinch family's long
       * refusal was correct. */
      return flat ? { mult: +flat[1], readFrom: 'onModifySpe' } : null;
    } },
  /* Will: "life orb is a damage boost?" It is -- and it also costs 1/10 max HP on EVERY attack,
   * which this tag's own `why` admitted it did not model while recording the multiplier as though
   * the item were free. Two things were wrong: the cost was missing, and membership was a name
   * hardcode (`/^(lifeorb)$/`) rather than a derivation, against the project's no-hardcodes rule.
   * Both now come from the handlers. Same omission as Solar Power's sun chip: a multiplier with a
   * recurring price is a different decision from a multiplier. */
  { tag: 'damageMultAll', param: 'x damage on everything, and what it charges for it', probe: 'onModifyDamage',
    why: 'Life Orb is x1.3 (6,301 sheets) and costs 1/10 max HP per attack. Scored as a free '
       + 'multiplier it makes the holder look like it wins races it actually loses',
    of: it => {
      const md = String(it.onModifyDamage || '');
      if (!md || /typeMod|Effectiveness/i.test(md)) return null;
      const m = md.match(/chainModify\(\[?\s*(\d+)/);
      const mult = m ? +(m[1] / 4096).toFixed(2) : null;
      const c = String(it.onAfterMoveSecondarySelf || '');
      const cost = (c.match(/maxhp\s*\/\s*(\d+)/i) || [])[1];
      if (!mult) return null;
      return { mult, costsPerAttack: cost ? '1/' + cost + ' max HP' : null };
    } },
  /* WAS A 24-NAME REGEX. Will: "NO HARDCODE." He is right and this was the worst offender left --
   * charcoal|blackglasses|mysticwater|fairyfeather|magnet|nevermeltice|sharpbeak|... listing every
   * type-boost item by hand, which silently omits any it forgot and any added later.
   *
   * It is entirely derivable: every one of them is an onBasePower that tests `move.type === "X"`
   * and returns chainModify([4915, 4096]). The handler names both the type and the multiplier, so
   * nothing needs to be typed -- and the multiplier comes out as the true 1.2 rather than assumed. */
  { tag: 'damageMultType', param: 'multiplies one TYPE, with the type and factor read from the handler', probe: 'onBasePower',
    why: 'Black Glasses, Mystic Water, Charcoal, Fairy Feather and the rest -- about 6.7% of held '
       + 'items, and a pure calculation error when missed',
    of: it => {
      const src = String(it.onBasePower || '');
      const t = (src.match(/move\.type\s*===?\s*"(\w+)"/) || [])[1];
      if (!t) return null;
      const m = src.match(/chainModify\(\[?\s*(\d+)/);
      return { onType: t, mult: m ? +(m[1] / 4096).toFixed(2) : null };
    } },
  { tag: 'curesVolatile', param: 'clears Taunt/Encore/Disable/Attract the moment one lands, then is gone', probe: 'onUpdate',
    why: 'Mental Herb. It silently undoes the whole point of a Taunt or an Encore, so any value the '
       + 'bot assigns to landing one is wrong against a holder',
    /* WHICH VOLATILES. `{oneShot:true}` named the shape and not the SET, and the set is the whole
     * mechanic: Mental Herb frees a Taunt, an Encore, a Disable, an Attract, a Torment and a Heal
     * Block, and it does NOT touch confusion, a Leech Seed or a partial trap. A consumer reading the
     * boolean would have made it a universal volatile eraser. The handler declares the list. */
    /* ROADMAP #92 -- THE SECOND SHAPE, AND IT IS A DIFFERENT HANDLER RATHER THAN A WIDER REGEX.
     * Mental Herb declares its set as a LITERAL ARRAY inside `onUpdate`. Lum and Persim declare
     * theirs one call at a time inside `onEat` -- `pokemon.removeVolatile('confusion')` -- and the
     * herb pattern above could never have seen them, so the census read Persim Berry as carrying no
     * cure tag of any kind and Lum as curing statuses only.
     * MEMBERSHIP PRINTED BEFORE THIS WAS WIRED, over every non-Past item the format defines: the
     * `removeVolatile` in an `onEat` matches EXACTLY TWO items, lumberry and persimberry, and both
     * name `confusion`. That is the whole population -- this is not a pattern that could grow a third
     * member quietly, because the run re-derives it and the count is in the artifact. */
    of: i => {
      const upd = String(i.onUpdate || ''), eat = String(i.onEat || '');
      const herb = /taunt|encore|disable|attract|healblock|torment/i.test(upd);
      const removed = [...eat.matchAll(/removeVolatile\(\s*["']([a-z]+)["']\s*\)/g)].map(x => x[1]);
      if (!herb && !removed.length) return null;
      const l = upd.match(/conditions\s*=\s*\[([^\]]*)\]/);
      const listed = l ? l[1].split(',').map(x => x.replace(/[^a-z]/gi, '')).filter(Boolean) : [];
      const cures = [...new Set([...listed, ...removed])];
      return { oneShot: true, cures: cures.length ? cures : null };
    } },
  { tag: 'boostsSuperEffective', param: 'x1.2 damage, but only on a super-effective hit', probe: 'onModifyDamage',
    why: 'Expert Belt. Conditional on the type matchup rather than flat, so it changes WHICH target '
       + 'is the right one to hit, not just how hard',
    of: i => (i.onModifyDamage && /typeMod|Effectiveness/i.test(String(i.onModifyDamage)))
             ? { mult: 1.2, onlyIfSuperEffective: true } : null },
  /* WAS {halves:true} AND NOTHING ELSE, which is unusable: the consumer needs to know WHICH type is
   * halved and whether the hit must be super effective. Both are in the handler --
   * `move.type === "Fighting" && typeMod > 0` -- so the type comes from there, and Chilan is
   * correctly separated because it halves NORMAL moves with no effectiveness condition at all.
   * Same boolean-instead-of-parameter defect as Swift Swim not naming rain. */
  { tag: 'resistBerry', param: 'halves ONE hit of a named type, then is gone', probe: 'naturalGift',
    why: 'Chople, Colbur, Kasib and 13 more -- 6,479 holders, and the damage calc had nothing for '
       + 'any of them. It is the single biggest source of a kill that is not a kill',
    of: it => {
      if (!it.isBerry || !it.onSourceModifyDamage) return null;
      const src = String(it.onSourceModifyDamage);
      const t = (src.match(/move\.type\s*===?\s*"(\w+)"/) || [])[1];
      if (!t) return null;
      return { onType: t, mult: 0.5, oneShot: true,
               /* Chilan halves Normal unconditionally; every other berry needs a super-effective hit */
               requiresSuperEffective: /typeMod\s*>\s*0/.test(src) };
    } },
  /* Will: "lum berry?" -- a different berry class entirely. The resist berries halve a hit; these
   * delete a status the moment it lands, which makes a status move against the holder a wasted turn.
   * Derived from the handler rather than named. */
  { tag: 'curesStatus', param: 'a status is removed the moment it lands', probe: 'lumberry',
    why: 'Lum (107 uses), Chesto, Rawst. Every status move aimed at the holder is a wasted turn, and '
       + 'inflictsStatus has no idea',
    /* WHICH STATUS. `{cures:true}` is carried by six berries and only ONE of them cures everything:
     * Lum. Cheri cures paralysis and nothing else, Rawst burn, Chesto sleep, Pecha poison AND toxic,
     * Aspear freeze. A consumer reading the boolean would have made a Cheri Berry cure a Will-O-Wisp.
     * The handler names the statuses it tests for; a member whose handler tests `pokemon.status`
     * bare (Lum) cures ANY, and that is emitted as the explicit string 'any' rather than as an
     * absent field, so "cures everything" and "the derivation found nothing" cannot be confused. */
    of: it => {
      if (!(it.isBerry && !it.onSourceModifyDamage
            && /cureStatus|setStatus|status/i.test(String(it.onUpdate || it.onAfterSetStatus || ''))))
        return null;
      const h = String(it.onUpdate || '') + String(it.onAfterSetStatus || '');
      const named = [...h.matchAll(/status\s*===\s*["']([a-z]+)["']/g)].map(x => x[1]);
      /* `pokemon.status ||` with no equality test is Lum: any status at all. */
      const anyStatus = /pokemon\.status\s*\|\|/.test(h) || /onAfterSetStatus\(status/.test(h);
      return { cures: true, statuses: named.length ? [...new Set(named)] : (anyStatus ? 'any' : null) };
    } },
  /* Will: "all berries proc at half i thought, sitrus just heals 1/4 hp right."
   * Half right, and my tag was worse than the question. `healsAtHalf` named the TRIGGER and never
   * the AMOUNT, so it could not price the berry at all -- and the trigger is not universal: Sitrus
   * fires at 1/2 and heals 1/4, while Figy fires at 1/4 and heals 1/3 and was UNTAGGED. Same
   * boolean-instead-of-parameter defect as Swift Swim not naming rain. */
  { tag: 'healsAtThreshold', param: 'fires when HP drops below a fraction, and restores a DIFFERENT fraction', probe: 'healsAtThreshold',
    why: 'Sitrus (7,132 sheets) triggers at 1/2 and heals 1/4 -- two different numbers that the '
       + 'kill calculation needs separately. A target at 55% is not in range of what looks lethal',
    of: i => {
      const upd = String(i.onUpdate || ''), eat = String(i.onEat || '');
      if (!/eatItem|onEat/.test(upd + String(i.onEat ? 'onEat' : ''))) if (!i.onEat) return null;
      /* baseMaxhp carries a CAPITAL M, so a case-sensitive /maxhp/ matched the trigger (which uses
       * pokemon.maxhp) and never the heal (which uses baseMaxhp). The tag reported a threshold with
       * no amount and looked merely incomplete rather than broken. */
      const trig = (upd.match(/maxhp\s*\/\s*(\d+)/i) || [])[1];
      const heal = (eat.match(/maxhp\s*\/\s*(\d+)/i) || [])[1];
      /* NOT EVERY BERRY HEALS A FRACTION. Oran Berry's `onEat` is `this.heal(10)` — a FLAT ten HP,
       * with no `maxhp` in it at all — so the fraction regex above found nothing, `restores` came out
       * null, and the consumer refused (correctly, per #92: an amount it cannot read is not guessed).
       * The tag looked merely incomplete rather than broken, and the roster read the berry
       * DID-NOT-FIRE. Berry Juice is the same shape at 20. Read as a SEPARATE field, because a flat
       * heal and a fraction are different quantities and collapsing them would need a maxhp the tag
       * does not have. */
      const flat = (eat.match(/\bheal\(\s*(\d+)\s*[),]/) || [])[1];
      if (!trig && !heal && !flat) return null;
      return { triggersBelow: trig ? '1/' + trig : null, restores: heal ? '1/' + heal : null,
               restoresFlat: flat ? +flat : null,
               confusesIfWrongNature: /confus/i.test(eat) || null };
    } },
  /* THE LAST THREE ITEMS ON THE GATE'S QUEUE (2026-08-10). Unlike Iron Ball and Light Ball — where
   * the mechanic existed and only the producer was blind — these three had NO tag describing what
   * they do, so nothing downstream could have read them. Each is derived from its own handler. */

  /* SHELL BELL — heals the ATTACKER a fraction of the damage it just dealt.
   *     onAfterMoveSecondarySelf: if (move.totalDamage && !forceSwitchFlag) heal(move.totalDamage / 8)
   * The divisor is read, not assumed, and the `totalDamage` basis matters: it is the damage the move
   * ACTUALLY dealt across every target it hit, so a spread move heals off the sum. */
  { tag: 'healFromDamageDealt', param: 'the holder heals a fraction of the damage its move dealt',
    probe: 'onAfterMoveSecondarySelf',
    why: 'Shell Bell, 44 uses — a roster DID-NOT-FIRE row, and it changes how many turns a kill takes',
    of: (it) => {
      const src = String(it.onAfterMoveSecondarySelf || '').replace(/\s+/g, ' ');
      if (!src || !/heal\(/.test(src)) return null;
      const m = src.match(/heal\(\s*move\.totalDamage\s*\/\s*(\d+)/);
      if (!m) return null;
      return { div: +m[1], basis: 'totalDamage' };
    } },

  /* BIG ROOT — multiplies the holder's own DRAIN-family healing.
   *     onTryHeal: const heals=["drain","leechseed","ingrain","aquaring","strengthsap"]
   *                if (heals.includes(effect.id)) chainModify([5324, 4096])
   * The SOURCE LIST IS PART OF THE FACT and is carried: this does not boost Recover, Leftovers or a
   * berry, and a tag that said only "x1.3 healing" would be a different and wrong item. */
  { tag: 'healMultBySource', param: 'multiplies healing that came from specific effects',
    probe: 'onTryHeal',
    why: 'Big Root, 53 uses — a roster DID-NOT-FIRE row. It boosts drain and Leech Seed and nothing else',
    of: (it) => {
      const src = String(it.onTryHeal || '').replace(/\s+/g, ' ');
      if (!src) return null;
      const frac = src.match(/chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/);
      const flat = src.match(/chainModify\(\s*([\d.]+)\s*\)/);
      const mult = frac ? (+frac[1] / +frac[2]) : (flat ? +flat[1] : null);
      if (mult === null) return null;
      const list = src.match(/\[\s*((?:"[a-z]+"\s*,?\s*)+)\]/);
      const from = list ? [...list[1].matchAll(/"([a-z]+)"/g)].map(x => x[1]) : null;
      if (!from || !from.length) return null;     /* an unreadable source list is not a claim */
      return { mult, from };
    } },

  /* METRONOME (the ITEM, not the move) — damage climbs while you repeat one move.
   *     onModifyDamage: dmgMod = [4096, 4915, 5734, 6553, 7372, 8192], indexed by numConsecutive
   *                     capped at 5
   * The whole LADDER is carried rather than a "+20% per use" summary, because the steps are not
   * evenly spaced in 4096ths and a summary would be a second, wrong implementation of the fact. */
  { tag: 'damageMultOnRepeat', param: 'damage climbs with consecutive uses of the same move',
    probe: 'onModifyDamage with a consecutive-use ladder',
    why: 'Metronome, 19 uses — a roster DID-NOT-FIRE row and the only member of its shape',
    of: (it) => {
      const src = String((it.condition && it.condition.onModifyDamage) || '').replace(/\s+/g, ' ');
      if (!src || !/numConsecutive/.test(src)) return null;
      const arr = src.match(/\[\s*((?:\d+\s*,\s*)+\d+)\s*\]/);
      if (!arr) return null;
      const steps = arr[1].split(/\s*,\s*/).map(Number);
      const cap = (src.match(/numConsecutive\s*>\s*(\d+)/) || [])[1];
      return { steps4096: steps, cap: cap ? +cap : steps.length - 1, denom: 4096 };
    } },

  { tag: 'passiveHeal', param: 'restores HP every turn', probe: 'leftovers',
    why: 'changes how many turns a kill takes',
    of: it => norm(it.name) === 'leftovers' ? { heal: 1 / 16 } : null },
  { tag: 'blocksSecondary', param: 'added effects do not apply to the holder', probe: 'covertcloak',
    why: 'Covert Cloak. Fake Out does not flinch through it, and nothing checks',
    of: it => norm(it.name) === 'covertcloak' ? { blocks: true } : null },
  { tag: 'blocksPowder', param: 'powder moves fail against the holder', probe: 'safetygoggles',
    why: 'Safety Goggles beats Rage Powder redirection outright',
    of: it => norm(it.name) === 'safetygoggles' ? { blocks: true } : null },
  { tag: 'preventsStatDrop', param: 'stat drops do not apply', probe: 'clearamulet',
    why: 'Clear Amulet turns Intimidate into nothing',
    of: it => norm(it.name) === 'clearamulet' ? { prevents: true } : null },
  { tag: 'restoresStats', param: 'undoes stat drops once', probe: 'whiteherb',
    why: '2.1% of items, and it changes what a drop is worth',
    of: it => norm(it.name) === 'whiteherb' ? { restores: true } : null },
  /* Will: "damp rock is like light clay for setting the weather. same with the other weather
   * extenders." One mechanic -- hold this, your field effect lasts 8 turns instead of 5 -- and only
   * Light Clay had a tag. Damp Rock (200 sheets), Heat Rock (52), Smooth Rock and Icy Rock were all
   * UNTAGGED.
   *
   * Derived by INVERTING the reference. There is no field on the item saying what it extends; the
   * relationship lives on the other side, in each condition's durationCallback checking
   * hasItem("damprock"). So this scans every move condition and weather condition for those checks
   * and builds the mapping from them -- no names typed, and anything added later joins on its own. */
  { tag: 'extendsDuration', param: 'holding it makes a field or side effect last N turns instead of 5', probe: 'extendsDuration',
    why: 'Light Clay (2,016 sheets) turns 5 turns of screens into 8, and Damp Rock does the same '
       + 'for rain. Three extra turns of a x0.5 or of a speed-doubling weather decides games',
    of: it => {
      const ext = EXTENDERS[norm(it.id || it.name)];
      return ext ? { extends: ext.what, toTurns: ext.turns, insteadOf: 5 } : null;
    } },
  /* `contactPunish` (item) RETIRED 2026-08-05 (STAGED). Its only member was Rocky Helmet, which is
   * BANNED in this format, and the fact it carried is `punishesAttacker`'s -- the ability-side twin
   * was retired in the same pass for redundancy with that richer, CONSUMED tag. One fact, one tag. */
  /* Will: "or power herb (illegal but future proofing". Right -- it skips the charge turn of ANY
   * charge move, where the weather skip only covers Electro Shot and the Solar moves. Nonstandard in
   * this format today, and derived from the handler so it starts working the day it is legal rather
   * than needing to be remembered. */
  { tag: 'skipsChargeTurn', param: 'the charge turn is skipped for any charge move', probe: 'powerherb',
    why: 'Power Herb. Not legal in Reg M-B today; tagged so a format change does not silently leave '
       + 'a two-turn move scored as two turns',
    of: it => (it.onChargeMove || /powerherb/.test(norm(it.name))) ? { skipsCharge: true } : null },
  { tag: 'critRatioUp', param: 'P(crit) raised', probe: 'onModifyCritRatio',
    why: 'Scope Lens (Will spotted this one missing). Rare at 0.11% of items, but it sets a parameter '
       + 'the distribution already needs for Flower Trick, so it costs nothing to support. NOTE the '
       + 'ratio is a STAGE feeding P(crit); the crit damage multiplier is always x1.5 and nothing here '
       + 'changes it -- do not read critRatio: 2 as double damage',
    of: it => it.onModifyCritRatio ? { critRatio: 2 } : null },
  /* NEW 2026-08-08 -- WHAT THIS ITEM IS WORTH WHEN IT IS THROWN. `item.fling` is a first-class dex
   * field, so this is a READ rather than a handler probe: `{basePower}` plus, on some members, a
   * `status` or a `volatileStatus` that becomes the throw's secondary. Light Ball is 30 and
   * paralyses; Iron Ball is 130 and does nothing; a mega stone is 80.
   *
   * MEASURED BEFORE IT WAS WIRED, and the measurement changes what the consumer has to model: of
   * every legal item in `Dex.forFormat('gen9championsvgc2026regmb')`, ALL 148 carry a `fling` entry.
   * So the authority's `if (!item.fling) return false` refusal — Fling failing because the held item
   * cannot be thrown — has NO member in this format and is a branch the consumer will never take.
   * Written down because "we did not implement that refusal" and "that refusal has nothing to
   * refuse" look identical from the outside. */
  { tag: 'flingable', param: 'the base power and secondary this item gives when it is thrown', probe: 'flingable',
    why: 'Fling reads its whole identity out of the held item — 31 uses, and the engine played it as '
       + 'a 0 BP move that consumed nothing',
    of: it => it.fling ? { basePower: +it.fling.basePower || 0,
                           status: it.fling.status || null,
                           volatileStatus: it.fling.volatileStatus || null,
                           isBerry: !!it.isBerry } : null },
  { tag: 'addsFlinch', param: 'P(flinch) += 10% on moves that do not already flinch', probe: 'kingsrock',
    why: "King's Rock and Razor Fang. Sets the same parameter the move-side flinch tag does, which is "
       + 'exactly what a parameter taxonomy is for. Derived from an onModifyMove that mentions flinch, '
       + 'not from the names',
    of: it => (it.onModifyMove && /flinch/i.test(String(it.onModifyMove))) ? { pFlinch: 0.1 } : null },
  /* Will: "quick claw and bright powder". Both set parameters the kill distribution already needs --
   * one perturbs the ORDER, the other P(hit) -- and both are derivable from their handlers. */
  { tag: 'fractionalPriority', param: 'a CHANCE to move first inside the priority bracket', probe: 'onFractionalPriority',
    why: 'Quick Claw, 20% of turns. Speed order is what most kill features hang off, and this makes it '
       + 'probabilistic rather than determined',
    of: it => it.onFractionalPriority ? { chance: 0.2 } : null },
  { tag: 'accuracyMod', param: 'P(hit) is scaled, for or against the holder', probe: 'onModifyAccuracy',
    why: 'Bright Powder makes attacks against the holder 0.9x; Wide Lens (411 uses) makes the holder 1.1x. '
       + 'Feeds the same P(hit) the kill distribution consumes',
    of: it => (it.onModifyAccuracy || it.onSourceModifyAccuracy) ? { accuracy: true } : null },
  /* THIS RULE COULD NOT FIRE IN THIS FORMAT AND NOTHING READ IT EITHER. Measured 2026-08-10: it
   * hardcoded four names and **all four are `isNonstandard: 'Past'`** — Choice Band, Choice Specs and
   * Assault Vest are on the format's ban list (CLAUDE.md names them), and Eviolite is gone too. None
   * has a row in `data/tags.json`. And `statMult` has **no consumer anywhere** in `engine/`. A dead
   * rule producing a dead tag, sitting directly above the `speedMult` hardcode it shares a defect
   * with.
   *
   * Derived from the stat handlers now. Membership in this format is exactly ONE:
   *
   *     Light Ball   41 uses   x2 to Atk and SpA, and ONLY on Pikachu
   *
   * which the roster reads DID-NOT-FIRE. The species lock is part of the FACT and is carried, not
   * dropped: an item that doubles everyone's Attack is a different item. */
  { tag: 'statMult', param: 'multiplies one or more of the holder\'s stats, possibly only on one species',
    probe: 'onModifyAtk / onModifySpA / onModifyDef / onModifySpD',
    why: 'Light Ball is the only member this format still has, and it doubles two stats at once',
    of: (it) => {
      const MAP = { onModifyAtk: 'atk', onModifySpA: 'spa', onModifyDef: 'def', onModifySpD: 'spd' };
      const stats = []; let mult = null, species = null;
      for (const h of Object.keys(MAP)) {
        const src = String(it[h] || '').replace(/\s+/g, ' ');
        if (!src) continue;
        const frac = src.match(/chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/);
        const flat = src.match(/chainModify\(\s*([\d.]+)\s*\)/);
        const m = frac ? (+frac[1] / +frac[2]) : (flat ? +flat[1] : null);
        if (m === null) continue;                       /* unreadable handler -> not claimed */
        /* `pokemon.baseSpecies.baseSpecies === "Pikachu"` — the lock, read rather than assumed. */
        const sp = src.match(/baseSpecies\s*===?\s*["']([A-Za-z-]+)["']/);
        if (sp) species = sp[1];
        if (mult !== null && m !== mult) return null;   /* two different multipliers is not one fact */
        mult = m; stats.push(MAP[h]);
      }
      return stats.length ? { mult, stats, onlySpecies: species } : null;
    } },
];

const ABILITY_TAGS = [
  /* ROADMAP #139 -- SUCTION CUPS, AND IT IS THE MIRROR OF `escapesTrap` RATHER THAN A SECOND COPY OF
   * IT. The two are opposite ends of the same axis and an engine holding one boolean for "can this
   * body change slots" cannot express both:
   *     escapesTrap    restores the CHOICE to leave     (Shed Shell, an item, against a trap)
   *     refusesForcedSwitch  refuses being THROWN OUT   (Suction Cups, against Roar / Whirlwind)
   * Measured RED before this existed: a Suction Cups holder was dragged out by Roar in the authority
   * and this engine did not move the board at all -- and there was no `suctioncups` row in
   * data/tags.json AT ALL, so no reader could have been written first. That is the two-queue point:
   * a row with a tag is a reader and a row without one is a derivation.
   *
   * DERIVED FROM `onDragOut` RETURNING null, which is the whole mechanism and is not a name. TWO
   * members in the format, printed before it was wired: `suctioncups` and `guarddog`. Guard Dog has no
   * legal carrier in this regulation, which is a fact about the SPECIES POOL and not a reason to match
   * on the one name that does -- a later regulation adding a carrier needs no edit here. */
  { tag: 'refusesForcedSwitch', param: 'the holder cannot be dragged out by a move or an item',
    probe: 'onDragOut',
    why: 'Suction Cups: Showdown drags the body out and this engine did not move the board, because '
       + 'the ability had no row in data/tags.json at all',
    of: a => {
      const src = String(a.onDragOut || '').replace(/\s+/g, ' ');
      if (!/return null/.test(src)) return null;
      return { refuses: 'forcedSwitch', announces: /this\.add\("-activate"/.test(src) };
    } },
  /* ROADMAP #139 -- PIERCING DRILL AND UNSEEN FIST, BOTH `untagged`, AND THIS FORMAT'S UNSEEN FIST IS
   * NOT THE MAINLINE ONE. Champions Reg M-B ships them byte-identical:
   *
   *     shortDesc: "This Pokemon's contact moves ignore a target's protection and deal 1/4 the usual
   *                 damage."
   *     onHitProtect(source, target, move) {
   *       if (move.flags['contact']) { target.getMoveHitData(move).bypassProtect = this.effect;
   *                                    return false; }
   *     }
   *
   * In standard gen 9 Unseen Fist pierces at FULL damage. Anyone reasoning from the mainline mechanic
   * gets this wrong by a factor of four, which is why the multiplier is READ rather than typed.
   *
   * BOTH HALVES OR IT IS A DIFFERENT ABILITY. A bare `{bypassesProtect:true}` describes an ability
   * that punches through a Protect for full damage -- strictly better than the one in this format and
   * a strictly worse thing to hand a search. The condition (`onlyMoveFlag: contact`) is the other
   * half: an ability that pierced with ANY move would be a third thing again.
   *
   * WHERE THE 0.25 LIVES, AND WHY IT IS NOT IN THE ABILITY. `onHitProtect` only RAISES the flag; the
   * quartering is in the simulator, at the very bottom of `modifyDamage` -- after the burn halving and
   * after the ModifyDamage event -- keyed on `getMoveHitData(move).bypassProtect`. So it is a property
   * of the BYPASS, shared by every ability that raises the flag, and it is read out of
   * `sim/battle-actions.js` rather than typed here or parsed out of English prose. A build where that
   * line cannot be found emits no multiplier at all and says so, because a bypass at full damage is
   * exactly the wrong half to guess.
   *
   * AND THE BYPASS ONLY HAPPENS AGAINST A LIVE SHIELD, which is the third arm of any honest fixture:
   * `checkMoveBypassesProtect` is called ONLY from the protect family's own `onTryHit` (checked over
   * the whole move file -- every call site is a stalling move's condition), so a contact move into an
   * UNPROTECTED body raises no flag and takes no quartering. `appliesOnlyWhenBlocked` says so in the
   * artifact so a consumer cannot read this as "contact moves deal a quarter".
   *
   * MATCHED ON SHAPE. Two abilities carry it today and neither is named: the predicate is "declares
   * onHitProtect, tests a move flag, writes bypassProtect". */
  { tag: 'piercesProtect', param: 'contact moves go through a shield, at reduced damage',
    probe: 'piercesProtect',
    why: 'Piercing Drill and Unseen Fist are both untagged, so nothing in the engine can act on them '
       + 'and no fixture can reach them. This format quarters the pierced hit; mainline does not',
    of: a => {
      const src = String(a.onHitProtect || '').replace(/\s+/g, ' ');
      if (!src || !/bypassProtect/.test(src)) return null;
      const flag = (src.match(/move\.flags\[\s*["'](\w+)["']\s*\]/) || [])[1] || null;
      const out = { bypassesProtect: true, onlyMoveFlag: flag, appliesOnlyWhenBlocked: true };
      /* The multiplier, out of the simulator's own line rather than out of the shortDesc. */
      try {
        const sim = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'battle-actions.js'), 'utf8');
        const mm = sim.replace(/\s+/g, ' ')
          .match(/const bypassProtect = [^;]*; if \(bypassProtect\) \{ \w+ = this\.battle\.modify\(\w+, ([\d.]+)\)/);
        if (mm) out.damageMult = +mm[1];
      } catch (e) { /* falls through to the loud absence below */ }
      if (out.damageMult == null) {
        out.damageMult = null;
        out.note = 'the simulator line that applies the bypass multiplier could not be read — the '
                 + 'multiplier is UNKNOWN, not 1';
      }
      return out;
    } },
  { tag: 'convertsMoveType', param: 'rewrites Normal moves to another type and boosts them',
    probe: 'convertsMoveType',
    why: 'Aerilate Staraptor and Galvanize are whole archetypes, and the engine played them as if '
       + 'the ability were blank',
    of: a => {
      const src = String(a.onModifyType || '');
      if (!src) return null;
      const t = /type\s*=\s*["']([A-Za-z]+)["']/.exec(src);
      if (!t) return null;
      /* The multiplier lives in onBasePower as a chainModify; 1.2 is the generation-9 value for the
       * whole family. Read it if it is written, fall back to 1.2 if the handler is opaque. */
      const bp = String(a.onBasePower || '');
      const mm = /chainModify\(\s*\[?\s*(\d+)\s*,\s*(\d+)/.exec(bp);
      const mult = mm ? (parseInt(mm[1], 10) / parseInt(mm[2], 10)) : (bp ? 1.2 : 1);
      return { to: t[1], mult: Math.round(mult * 1000) / 1000 };
    } },
  /* AN ABILITY THAT UPGRADES THE POKEMON WHEN IT COMES BACK IN.
   *
   * Zero to Hero: Palafin leaves the field and returns as Palafin-Hero, 154 Attack to 233. The
   * engine could BUILD palafin-hero the whole time -- the MC row exists -- and simply never
   * transformed anything, so Palafin was a permanently weak body and the search had no reason to
   * pivot it. Will: "PALAFIN NEED SPECIAL AI TO TELL IT TO FLIP TURN OUT TURN 1". It needs no
   * special AI at all; it needs the mechanic, and then a 233-Attack body is worth a turn on its own.
   *
   * DERIVED FROM THE SPECIES TABLE, not from the ability name: a battleOnly forme names the base it
   * comes from, and the base carries the ability that triggers it. So the pair is discovered rather
   * than written, and the same rule finds the next one. */
  { tag: 'switchInForme', param: 'the holder returns to the field as a different forme',
    probe: 'switchInForme',
    why: 'Palafin-Hero is buildable and was never built, so every Palafin in every rollout was the '
       + 'weak forme and switching it out looked pointless',
    of: (a) => {
      /* `dex` is module scope here (line 58); the generator calls of() with one argument. */
      const src = String(a.onSwitchOut || '') + String(a.onSwitchIn || '') + String(a.onSwitchInPriority || '');
      if (!/formeChange|Hero/i.test(src)) return null;
      for (const sp of dex.species.all()) {
        if (!sp.exists || !sp.battleOnly) continue;
        const baseName = Array.isArray(sp.battleOnly) ? sp.battleOnly[0] : sp.battleOnly;
        const base = dex.species.get(baseName);
        if (!base || !base.exists) continue;
        const abils = Object.values(base.abilities || {}).map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (abils.includes(a.id)) return { from: base.name, becomes: sp.name };
      }
      return null;
    } },
  /* UNBURDEN: Speed doubles once the item is gone. Declared by the ability's own onTakeItem /
   * onAfterUseItem handlers, so it is read rather than named. */
  /* ABILITIES THAT REFUSE A STATUS MOVE OUTRIGHT. Good as Gold and Telepathy both express it as an
   * onTryHit handler that tests the move CATEGORY, so the handler is what identifies them -- not a
   * list of two names that goes stale the moment a third is printed. */
  { tag: 'refusesStatusMoves', param: 'the holder cannot be hit by a status move at all',
    probe: 'refusesStatusMoves',
    why: 'Good as Gold sat on Gholdengo taking Charm for -2; a Gholdengo that can be statused is a '
       + 'different Pokemon to the one people actually build around',
    of: a => {
      /* THE TEST AND THE REFUSAL MUST BE THE SAME BRANCH. Matching "Status" and "return null"
       * anywhere in the handler caught two abilities that do the opposite:
       *   Telepathy tests category !== "Status" -- it blocks an ALLY'S DAMAGE, not status;
       *   Wonder Guard tests category === "Status" and then bare-returns, which ALLOWS it.
       * So: find the equality test, and require the refusal before that branch closes. */
      const src = String(a.onTryHit || '').replace(/\s+/g, ' ');
      const m2 = /category\s*===\s*["']Status["']/.exec(src);
      if (!m2) return null;
      const branch = src.slice(m2.index, src.indexOf('}', m2.index) + 1);
      return /return (null|false)/.test(branch) ? { refuses: true } : null;
    } },
  { tag: 'survivesFromFull', param: 'a lethal MOVE from full HP leaves 1', probe: 'sturdy',
    why: 'Sturdy. Identical to Focus Sash minus the consumption -- and was a name check, same as '
       + 'the sash: both now read the onDamage idiom itself',
    of: a => {
      const src = String(a.onDamage || '');
      if (!/hp\s*===\s*\w+\.maxhp/.test(src) || !/damage\s*>=\s*\w+\.hp/.test(src) || !/hp\s*-\s*1/.test(src)) return null;
      return { leavesHP: 1, onlyFromFullHP: true,
               movesOnly: /effectType\s*===\s*"Move"/.test(src),
               consumesItem: /useItem\(\)/.test(src) };
    } },
  { tag: 'critRatioUp', param: 'P(crit) raised', probe: 'onModifyCritRatio',
    why: 'Super Luck and Merciless. Same parameter as Scope Lens and Flower Trick',
    of: a => a.onModifyCritRatio ? { critRatio: 2 } : null },
  /* Will: "MOLD BREAKER IS PROBABLY HARD TO MODEL HOW DO YOU PLAN ON DOING THAT". As a special
   * case it would be a branch everywhere a defender ability is consulted. As a PARAMETER it is one
   * boolean on the attacker that gates a class this file has already enumerated: typeImmunity,
   * damageReduce, blocksMove, preventsCrit and survivesFromFull(Sturdy) all stop applying. No
   * per-ability logic, and it stays correct when a new ability lands. 127 uses, so it is real. */
  { tag: 'ignoresDefenderAbility', param: 'suppress every defender-side ability tag for this move', probe: 'breaksProtect',
    why: 'Mold Breaker, Turboblaze, Teravolt. Gates typeImmunity, damageReduce, blocksMove, preventsCrit and Sturdy in one flag',
    of: a => (a.breaksProtect || /moldbreaker|turboblaze|teravolt/.test(norm(a.name))) ? { ignoresDefAbility: true } : null },
  { tag: 'critDamageUp', param: 'the CRIT MULTIPLIER itself, not its probability', probe: 'sniper',
    why: 'Sniper (Will raised it). Three separate crit parameters exist and the taxonomy had only two: '
       + 'probability (Scope Lens, Flower Trick), prevention (Shell Armor) and now the multiplier. '
       + 'Crit damage is x1.5 and Sniper makes it x1.5 again, so x2.25 total -- it was x3 in the old '
       + 'gens when crits themselves were x2, which is where the folklore comes from',
    of: a => (a.onModifyDamage && /crit/i.test(String(a.onModifyDamage))) ? { critMult: 1.5 } : null },
  /* Will spotted that Cursed Body is neither a contact punisher nor a target benefit: it DISABLES
   * the move that hit it. That removes an option from MY set for four turns, which is closer to
   * Encore than to Rough Skin -- and is a cost nothing prices. 833 uses. */
  { tag: 'disablesAttacker', param: 'the move I just used is removed from MY options', probe: 'cursedbody',
    why: 'Cursed Body (833 uses). Not damage and not a stat change -- it shrinks my own option set, '
       + 'the same shape as locksTarget from the receiving end',
    /* THE CHANCE IS READ. `{disables:true}` said it happens and never how often; Cursed Body is
     * `randomChance(3, 10)`, so a consumer that applied it on every hit would make Gengar and Froslass
     * into permanent Disable machines. */
    of: a => {
      if (!(a.onDamagingHit && /disable/i.test(String(a.onDamagingHit)))) return null;
      const c = String(a.onDamagingHit).match(/randomChance\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
      return { disables: true, chance: c ? (+c[1] / +c[2]) : null };
    } },
  /* FOUND BY THE COVERAGE CHECK Will asked for -- listing everything above 0.05% usage regardless of
   * whether it carries a tag exposed twelve common abilities the probes had missed entirely, because
   * each uses a handler nothing was looking at. Adaptability at 4.34% is a straight damage
   * multiplier and had no tag at all. */
  { tag: 'stabBoost', param: 'STAB becomes x2 instead of x1.5', probe: 'adaptability',
    why: 'Adaptability, 4.34% of abilities. A flat 33% damage increase on same-type moves and nothing '
       + 'was reading it',
    of: a => a.onModifySTAB ? { stab: 2 } : null },
  { tag: 'boostsWhenLowered', param: '+2 to a stat when any stat is lowered', probe: 'onAfterEachBoost',
    why: 'Defiant (5.46%) and Competitive. The Intimidate punisher -- dropping their Attack HANDS them '
       + 'an attack boost, so the lead interaction inverts',
    /* ENRICHED 2026-08-05 (STAGED): {retaliates:true} was the boolean-instead-of-parameter defect --
     * WHICH stat and HOW MUCH live in the handler's own this.boost({atk: 2}) and the consumer
     * (applyStatDrop, WIRE 100) types them beside a comment naming this enrichment. Read, not
     * assumed, exactly as statChangeInCode reads a move handler's table. */
    /* ENRICHED AGAIN 2026-08-07, AND THE MISSING FIELD WAS *HOW MANY TIMES*.
     *
     * Will: *"WHEN PARTING SHOT GOES INTO A DEFIANT OR COMPETITIVE MON IT GETS DOUBLE BOOSTS, ONE FOR
     * EACH DROP. I DONT THINK THATS THE CASE FOR CHARM BUT IDK."* Both halves are right, and the
     * mechanism is the HOOK NAME. `Battle#boost` runs `runEvent('AfterEachBoost', …, currentBoost)`
     * INSIDE its per-stat loop (sim/battle.ts:2073) with the single stat as its argument — so an
     * ability hanging off `onAfterEachBoost` fires ONCE PER STAT LOWERED, not once per move. Parting
     * Shot lowers two stats and hands the target -1 +2 +2 = +3 Attack; Charm lowers ONE stat by two
     * stages, fires once, and the -2 cancels the +2 exactly.
     *
     * `{retaliates:true, boosts:{atk:2}}` says WHAT and does not say HOW MANY TIMES, and a consumer
     * reading it naturally fires once per move — which is right for Charm by accident and wrong for
     * every multi-stat drop. The count is now DERIVED FROM THE HOOK the ability declares, so an
     * ability that ever hangs off the per-move `onAfterBoost` instead arrives correctly without an
     * edit here.
     *
     * TWO MORE GUARDS, both the handler's own first lines and both needed by the negative cases:
     * `if (!source || target.isAlly(source)) return;` — an ALLY lowering your stats does not trigger
     * it, and neither does a source-less drop. A consumer without those fires on a partner's Icy Wind. */
    of: a => {
      const perStat = !!a.onAfterEachBoost;
      const src = String(a.onAfterEachBoost || a.onAfterBoost || '');
      if (!perStat && !a.onAfterBoost) return null;
      if (!/statsLowered|<\s*0/.test(src)) return null;
      const bm = src.match(/\.boost\(\s*\{([^}]*)\}/);
      const boosts = {};
      if (bm) for (const kv of bm[1].split(',')) {
        const p = kv.split(':').map(s => s.trim().replace(/["']/g, ''));
        if (p.length === 2 && !isNaN(+p[1])) boosts[p[0]] = +p[1];
      }
      const out = { retaliates: true, perStatLowered: perStat };
      if (Object.keys(boosts).length) out.boosts = boosts;
      if (/!\s*source/.test(src)) out.needsSource = true;
      if (/isAlly\(\s*source\s*\)/.test(src)) out.notFromAlly = true;
      return out;
    } },
  { tag: 'preventsStatDrop', param: 'WHICH stat drops do not apply, and to whom', probe: 'onTryBoost',
    why: 'Clear Body blocks every stat, Hyper Cutter only Attack, Keen Eye only accuracy. That '
       + 'distinction decides Intimidate, which is 10% of the format: an Attack-blocker stops it '
       + 'and an accuracy-blocker does nothing',
    /* Will: "do we need to specify that clear body is just a better hyper cutter" -- yes, and the
     * tag returned {prevents:true} for both, which is the same defect as Swift Swim not naming rain.
     * Also scoped on his other catch, "flower veil is only grass pokemon": Flower Veil is 1,465
     * sheets and protects only GRASS-TYPE allies, so counting it as a blanket stat-drop immunity
     * overstated the largest member of the tag. */
    of: a => {
      const src = String(a.onTryBoost || '') + String(a.onAllyTryBoost || '');
      if (!src) return null;
      /* WHICH EFFECT the refusal is scoped to, and it is the difference between a real block and an
       * invented one. Inner Focus, Oblivious, Own Tempo, Scrappy and Guard Dog all open
       * `if (effect.name === 'Intimidate' && boost.atk)` -- they refuse INTIMIDATE and nothing else,
       * so `blocks: 'atk'` alone said they stop Charm, Parting Shot and Breaking Swipe as well.
       * Measured against the official engine before this was added: Charm into Inner Focus is
       * `|-unboost|p2b: Gallade|atk|2` in Showdown and was stage 0 in medicham2. WIRE 3. */
      /* ROADMAP #81 WIRE 12 -- THE OLD PATTERN COULD NOT TELL AN INCLUDE FROM AN EXCLUDE, AND IT
       * WAS ONE REGENERATION AWAY FROM DELETING MIRROR ARMOR.
       *
       * The five Intimidate blockers open with an INCLUSION whose body is the refusal:
       *     if (effect.name === 'Intimidate' && boost.atk) { delete boost.atk; ... }
       * Mirror Armor opens with the same substring inside an EARLY-RETURN GUARD, meaning the exact
       * opposite -- "if this drop is my own reflection, do nothing":
       *     if (!source || target === source || !boost || effect.name === 'Mirror Armor') return;
       * A bare `effect.name === '...'` match read the second as `onlyFrom: 'Mirror Armor'`, and
       * `statDropRefusal` gates on exactly that field -- so a regenerated artifact would have made
       * Mirror Armor block ONLY drops named "Mirror Armor" and therefore block nothing at all. The
       * ability would have gone silently dead with no probe on it and no line changed in the engine.
       * Found by DIFFING a candidate regeneration rather than accepting one (ROADMAP #65's method).
       *
       * The shape, not the name: a match counts only when its `if (...)` closes onto a BLOCK. An
       * early-return guard closes onto `return`, so it no longer matches, and Mirror Armor comes
       * back `onlyFrom: null` -- which is what the consumer's pre-regeneration bridge already gives
       * it, so this changes no behaviour today and stops one tomorrow. */
      const only = (src.replace(/\s+/g, ' ')
        .match(/effect\.name\s*===?\s*['"]([^'"]+)['"][^;{]*\)\s*\{/) || [])[1] || null;
      /* WIRE 157 -- MIRROR ARMOR DOES NOT BLOCK A DROP, IT RETURNS IT, AND THE TAG SAID ONLY THE
       * FIRST HALF.
       *
       * The paragraph above is about a REGENERATION nearly deleting this ability. This is the other
       * side of the same entry: the tag it did get -- `{blocks:'all stats'}` -- is what every Clear
       * Body carrier gets, and medicham2 acted on it exactly that way, with `REFLECTS_DROP` a typed
       * name list whose only job was to SUPPRESS the `-fail` message. So a Corviknight ate an
       * Intimidate and the Intimidator walked away clean; the roster measured Showdown at -1/-2 Atk
       * and -1 SpA on the aggressors against 0 here.
       *
       * DERIVED FROM THE HANDLER RE-AIMING THE BOOST AT `source`: `this.boost(negativeBoost, source,
       * target, null, true)`. That is the shape, and it is what distinguishes a reflector from a
       * blocker -- a blocker's handler deletes the key and calls nothing.
       *
       * MEMBERSHIP PRINTED BEFORE IT WAS WIRED, over every non-Past ability the format defines:
       *     onTryBoost re-aiming this.boost at `source` [1]: Mirror Armor
       * ONE, and the typed `REFLECTS_DROP` list in medicham2 held exactly that one name, so this
       * changes no membership -- it replaces a literal with a derivation and gives the consumer the
       * fact it was missing.
       *
       * THE TWO GUARDS TRAVEL WITH IT because the consumer must not invent them: the reflection is
       * skipped when the target is ALREADY at -6 on that stat (`if (target.boosts[b] === -6)
       * continue` -- the drop is then simply deleted and nobody takes it), and it needs a LIVING
       * source (`if (source.hp)`). */
      const refl = /this\.boost\([^)]*\bsource\b/.test(src);
      return { blocks: statsBlockedIn(src) || 'all stats',
               onlyFrom: only,
               onlyGrassTypes: /hasType\("Grass"\)/.test(src) || null,
               protectsAllies: !!a.onAllyTryBoost || null,
               reflects: refl || null,
               reflectSkipsAtFloor: refl ? /boosts\[\w+\]\s*===?\s*-6/.test(src) : null,
               reflectNeedsLivingSource: refl ? /source\.hp/.test(src) : null };
    } },
  /* ROADMAP #92 -- AN ABILITY THAT REFUSES ONE NAMED VOLATILE, WHICH IS NOT THE SAME TAG AS ONE THAT
   * REFUSES A STAT DROP. Own Tempo carried `preventsStatDrop` alone -- the Intimidate half -- and its
   * whole other handler is `onTryAddVolatile(status) { if (status.id === 'confusion') return null; }`.
   * With no confusion in the engine that cost nothing; with confusion wired it is 64 sheets of a body
   * that must not be confused, which is a divergence INTRODUCED by fixing something else.
   *
   * MEMBERSHIP PRINTED BEFORE IT WAS WIRED, over every non-Past ability the format defines: SEVEN
   * carry `onTryAddVolatile` and the split is clean --
   *     owntempo                                              confusion
   *     innerfocus                                            flinch
   *     insomnia, vitalspirit, leafguard, purifyingsalt,       yawn
   *     shieldsdown
   * so this cannot become "an ability that blocks everything". The volatile is read out of the
   * handler's own equality test; an ability whose handler names no volatile returns null rather than
   * a blanket refusal, because a refusal with no named target is the shape that over-matches. */
  { tag: 'refusesVolatile', param: 'WHICH volatile this body cannot be given', probe: 'onTryAddVolatile',
    why: 'Own Tempo (64 sheets) cannot be confused and Inner Focus (887) cannot be flinched. Both '
       + 'were invisible: the flinch refusal was a hardcoded ability NAME in the engine and the '
       + 'confusion refusal had nothing to refuse until confusion existed',
    of: a => {
      const src = String(a.onTryAddVolatile || '').replace(/\s+/g, ' ');
      if (!src) return null;
      const refuses = [...new Set([...src.matchAll(/status\.id\s*===?\s*["']([a-z]+)["']/g)].map(m => m[1]))];
      if (!refuses.length) return null;
      /* Shields Down refuses only in a named forme; the consumer must not apply it to a Minior that
       * is not the Meteor forme, so the condition travels with the tag rather than being dropped. */
      const forme = (src.match(/species\.id\s*!==?\s*["']([a-z]*)["']/) || [])[1] || null;
      return { refuses, requiresForme: forme };
    } },
  /* WIRE 157 -- A REACTION TO A FLINCH IS NOT A REFUSAL OF ONE, AND `refusesVolatile` DIRECTLY ABOVE
   * IS THE TAG IT KEEPS BEING MISTAKEN FOR.
   *
   * Inner Focus REFUSES the flinch: `onTryAddVolatile`, the volatile never lands, the body moves.
   * Steadfast TAKES the flinch and is PAID for it: `onFlinch(pokemon) { this.boost({spe: 1}) }`,
   * which Showdown runs from inside the flinch condition's own `onBeforeMove` (data/conditions.ts:
   * `this.add('cant', pokemon, 'flinch'); this.runEvent('Flinch', pokemon); return false;`). The turn
   * is still lost. So the two abilities sit on opposite sides of the same event and no consumer that
   * reads one can serve the other -- which is exactly what happened: WIRE 156 routed Fake Out through
   * the shared secondary loop and Inner Focus started working for free, while Steadfast's +1 Speed
   * has never fired in this engine at all.
   *
   * MEMBERSHIP PRINTED BEFORE IT WAS WIRED, over every non-Past ability the format defines:
   *     onFlinch [1]: Steadfast
   * ONE. There is nothing here to over-match, which is why the tag is derived off the HOOK NAME and
   * the boost table off the handler's own `this.boost({...})` rather than off `spe: 1` being typed
   * anywhere. Carriers in Reg M-B: Machamp, Lucario, Gallade, Lycanroc.
   *
   * THE POSITION IN THE TURN IS THE MECHANIC, and it is the consumer's problem rather than the tag's:
   * the boost is owed only when the flinch actually SPENDS the turn, so a body that is asleep as well
   * as flinched consumes the sleep first (Showdown's beforeMove priority: slp 10, flinch 8) and is
   * paid nothing. */
  { tag: 'boostsOnFlinch', param: 'the holder is PAID when a flinch takes its turn away', probe: 'boostsOnFlinch',
    why: 'Steadfast, 48 uses. It is the mirror of Inner Focus and it has never fired: the flinch '
       + 'half was right (the turn is lost) and the reaction half did not exist',
    of: a => {
      const src = String(a.onFlinch || '').replace(/\s+/g, ' ');
      if (!src) return null;
      const bm = src.match(/\.boost\(\s*\{([^}]*)\}/);
      if (!bm) return null;
      const boosts = {};
      for (const kv of bm[1].split(',')) {
        const p = kv.split(':').map(s => s.trim().replace(/["']/g, ''));
        if (p.length === 2 && !isNaN(+p[1])) boosts[p[0]] = +p[1];
      }
      return Object.keys(boosts).length ? { boosts } : null;
    } },
  /* WIRE 157 -- THE VEIL FAMILY PROTECTS THE BODY NEXT TO IT, AND THIS ENGINE ONLY EVER PROTECTED
   * ITSELF.
   *
   * `sweetveil` sat in medicham2's hand-typed `STATUS_IMMUNE_ABIL.slp` list beside Insomnia and Vital
   * Spirit, which are SELF immunities (`onSetStatus`). Sweet Veil has no `onSetStatus` at all -- its
   * handler is `onAllySetStatus`, and in Showdown an `onAlly...` handler is gathered over
   * `alliesAndSelf()`, so it covers the holder AND its partner. Half of it was live by accident of
   * being in the wrong list, and the half that makes the ability worth running was absent: measured
   * before this landed, Spore into the ally of a Sweet Veil body slept it here and was refused in the
   * official engine.
   *
   * MEMBERSHIP PRINTED BEFORE IT WAS WIRED, over every non-Past ability the format defines:
   *     onAllySetStatus     [3]  Flower Veil, Pastel Veil, Sweet Veil
   *     onAllyTryAddVolatile[3]  Aroma Veil, Flower Veil, Sweet Veil
   * and the three that set status are NOT one rule, which is why every scope the handlers carry
   * travels in the params instead of being flattened:
   *     Sweet Veil    slp only,        no type gate,      also blocks the yawn volatile
   *     Pastel Veil   psn/tox only,    no type gate
   *     Flower Veil   EVERY status except yawn, and ONLY on a GRASS-TYPE body
   * A tag that said "this ability protects allies from status" would hand Sweet Veil a poison
   * immunity and Flower Veil a blanket one on non-Grass bodies. `onlyGrassTypes` is the same field
   * `preventsStatDrop` already carries for the same handler idiom, read the same way.
   *
   * AROMA VEIL IS DELIBERATELY NOT IN THIS TAG: its handler names no status at all, only the Taunt /
   * Encore / Disable volatile set, so it returns null here rather than a blanket status refusal --
   * the shape LESSONS §4 warns about. Its own family is `refusesVolatile`'s ally-side counterpart and
   * is not wired by this pass. */
  { tag: 'protectsAllyFromStatus', param: 'WHICH statuses this body refuses ON BEHALF OF ITS SIDE, and to whom', probe: 'protectsAllyFromStatus',
    why: 'Sweet Veil (29 uses) and Flower Veil (1,465 sheets). Both were modelled as SELF immunities '
       + 'or as nothing; the ally half -- the reason either is played -- reached no code',
    of: a => {
      const src = String(a.onAllySetStatus || '').replace(/\s+/g, ' ');
      if (!src) return null;
      /* The statuses come out of the handler's own equality test or its `includes([...])`. A handler
       * that names none is the EXCLUDE shape (Flower Veil: everything except yawn), and that is
       * recorded as 'all' rather than guessed at -- the two are opposite consumers. */
      const eq = [...new Set([...src.matchAll(/status\.id\s*===?\s*["']([a-z]+)["']/g)].map(m => m[1]))];
      const inc = [...new Set([...src.matchAll(/\[\s*((?:["'][a-z]+["']\s*,\s*)*["'][a-z]+["'])\s*\]\s*\.includes\(\s*status\.id/g)]
        .flatMap(m => m[1].split(',').map(s => s.trim().replace(/["']/g, ''))))];
      const statuses = eq.length ? eq : (inc.length ? inc : 'all');
      /* Flower Veil's exclusion, read as an exclusion. `effect.id !== 'yawn'` is a MAJOR-status
       * handler declining one source; it is not a status this ability blocks. */
      const except = [...new Set([...src.matchAll(/effect\.id\s*!==?\s*["']([a-z]+)["']/g)].map(m => m[1]))];
      const vol = [...new Set([...String(a.onAllyTryAddVolatile || '').replace(/\s+/g, ' ')
        .matchAll(/status\.id\s*===?\s*["']([a-z]+)["']/g)].map(m => m[1]))];
      return { statuses, except: except.length ? except : null,
               volatiles: vol.length ? vol : null,
               onlyGrassTypes: /hasType\("Grass"\)/.test(src) || null,
               /* THE TWO GUARDS FLOWER VEIL CARRIES AND SWEET VEIL DOES NOT, and dropping them would
                * make the two abilities the same rule. Flower Veil opens
                * `if (target.hasType("Grass") && source && target !== source && ...)`, so a
                * SOURCE-LESS status and a SELF-INFLICTED one (Rest, a Toxic Orb) both go through it.
                * Sweet Veil's handler has neither clause -- which means a Sweet Veil body genuinely
                * cannot Rest. That is the authority's rule and it is derived rather than smoothed. */
               needsSource: /&&\s*source\s*&&/.test(src) || null,
               notFromSelf: /target\s*!==?\s*source/.test(src) || null,
               /* Showdown gathers `onAlly...` over alliesAndSelf(), so the holder is covered too. */
               coversSelf: true };
    } },
  /* Will: "scrappy needs the able to hit ghost types with normal and fighting type moves."
   * Right, and it was carrying preventsStatDrop alone -- the Intimidate half -- while its actual
   * headline effect was missing. Scrappy erases a full type IMMUNITY, which is the difference
   * between a move doing nothing and doing full damage, and it is the same mechanic as Mind's Eye
   * and as the Foresight/Odor Sleuth line. Derived from the ignoreImmunity field so it is not a
   * name list. */
  { tag: 'ignoresTypeImmunity', param: 'a type that normally does ZERO now connects', probe: 'ignoreImmunity',
    why: 'Scrappy (262 sheets) lets Normal and Fighting hit Ghost. The engine reads the defensive '
       + 'type chart and scores those moves at zero, which is the largest possible error on a move',
    of: a => {
      /* It is set INSIDE onModifyMove, not exposed as a field on the ability -- the empty-tag guard
       * caught the first probe within a minute of it being written. */
      const src = String(a.onModifyMove || '');
      const t = [...src.matchAll(/ignoreImmunity\["(\w+)"\]\s*=\s*true/g)].map(m => m[1]);
      if (!t.length) return null;
      return { movesOfType: t.join('/'), nowHits: 'Ghost' };
    } },
  /* Will: "the pixilates of the world and liquid voice of the world need the turn-a-type-into-
   * another-type tag, and add maybe a damage boost."
   *
   * Both halves, and Pixilate is 1,448 sheets. It rewrites Normal moves to Fairy AND multiplies
   * them by 1.2 -- so the engine was computing type effectiveness against the WRONG type and
   * missing a 20% multiplier on top. Liquid Voice (243) converts sound moves to Water with NO
   * boost, which is why the boost has to be a parameter rather than assumed. */
  { tag: 'convertsMoveType', param: 'rewrites the type of a class of the holder moves, sometimes with a multiplier', probe: 'onModifyType',
    why: 'Pixilate (1,448 sheets) turns Normal into Fairy at x1.2; Liquid Voice (243) turns sound '
       + 'into Water at x1.0. Effectiveness computed against the original type is simply the wrong number',
    of: a => {
      const src = String(a.onModifyType || '');
      if (!src) return null;
      const to = (src.match(/move\.type\s*=\s*"(\w+)"/) || [])[1];
      if (!to) return null;
      const bp = String(a.onBasePower || '');
      const raw = (bp.match(/chainModify\(\[?\s*([\d.]+)/) || [])[1];
      const mult = raw ? (+raw > 100 ? +(raw / 4096).toFixed(2) : +raw) : 1;
      const from = /flags\.sound|flags\["sound"\]/.test(src) ? 'sound moves'
                 : /type\s*===?\s*"Normal"/.test(src) ? 'Normal moves' : 'its moves';
      return { converts: from, into: to, damageMult: mult };
    } },
  /* Will: "moody idk what to do." Neither do I, and that is the honest entry. It moves a RANDOM
   * stat +2 and another -1 every turn, so there is no state to read and no decision to condition
   * on -- the only correct treatment is to widen the variance of every forecast involving it, which
   * belongs in the risk lever rather than here. 249 sheets. Tagged so it is not silently missing. */
  { tag: 'randomBoostEachTurn', param: 'a RANDOM stat +2 and another -1 every turn -- unpredictable by construction', probe: 'randomBoostEachTurn',
    why: 'Moody, 249 sheets. Nothing can be conditioned on it; it belongs in the variance of a '
       + 'forecast, not in a feature. Recorded rather than pretended-away',
    /* TIGHTENED 2026-08-05 (STAGED): the old test -- any onResidual containing a random call --
     * also matched HEALER (30% chance to cure the ALLY'S STATUS) and HARVEST (50% chance to regrow
     * a berry), neither of which boosts anything. LESSONS §4, again: the membership was printed
     * before the consumer existed, which is the only reason no engine ever gave Harvest a Moody
     * turn. A random residual BOOST needs the boost call itself. */
    of: a => (a.onResidual && /randomChance|sample\(|this\.random/.test(String(a.onResidual))
              && /\.boost\(/.test(String(a.onResidual)))
             ? { randomStat: true, up: 2, down: 1 } : null },
  /* THE MEGA-ONLY ABILITIES. Will: "u still didnt send the mega abilities in their highlighted and
   * what all their tags are."
   *
   * These reach the field only through evolution, so they have zero sheet usage, so nothing ever
   * put them in the entity table, so nothing tagged them. Fairy Aura is on 1,455 fields and did not
   * exist in this document at all. No Guard is on 1,133 and was untagged despite being one of the
   * largest single effects in the game. */
  /* WILL, AND HE IS RIGHT THAT MY TAG WAS WRONG: "no guard can be movenevermiss applied to all
   * moves right, and the opponents moves as well."
   *
   * `neverMisses` already exists as a MOVE property -- 132 moves and 90,596 move-slots carry it
   * intrinsically. No Guard does not need a bespoke tag; it needs to be expressed as something that
   * WRITES that property onto every move, in both directions. Writing a one-off tag for it was the
   * exact duplication linkage exists to stop, committed an hour after building linkage.
   *
   * And it extends the model: linkage is BIDIRECTIONAL. Moves expose properties; items and
   * abilities both SUBSCRIBE to them and WRITE them. Twelve things across two taxonomies write this
   * one term -- No Guard to certainty, Compound Eyes x1.3, Wide Lens x1.1, Bright Powder x0.9 --
   * and the damage distribution should ask for the final accuracy once rather than branch per source. */
  { tag: 'writesAccuracy', param: 'sets or multiplies the accuracy of moves -- the same term neverMisses sets', probe: 'writesAccuracy',
    why: 'No Guard (1,133 fields) drives it to certainty in BOTH directions, so its own Hydro Pump '
       + 'never misses and neither does anything aimed at it. Compound Eyes, Wide Lens and Bright '
       + 'Powder scale the same number. One term, twelve writers, no branch needed',
    /* THE DIRECTION WAS BACKWARDS ON EVERY CARRIER, AND NOTHING CAUGHT IT BECAUSE NOTHING CONSUMED
     * `scope`. 2026-08-06, found while wiring WIRE 129.
     *
     * Showdown runs `runEvent('ModifyAccuracy', target, source, move, accuracy)`. Handlers on the
     * TARGET are `onModifyAccuracy`; handlers on the SOURCE are `onSourceModifyAccuracy`. This
     * derivation had them the other way round, so the artifact recorded SAND VEIL as sharpening its
     * own moves and COMPOUND EYES as sharpening the foe's — precisely inverted, on all nine.
     *
     * `onModifyMove` is no longer folded in. It matched Skill Link's `delete move.multiaccuracy` on
     * the substring `accuracy` and gave a multihit ability a writesAccuracy tag it does not deserve;
     * every real accuracy writer in gen 9 uses one of the three hooks below.
     *
     * `onAnyModifyAccuracy` is its own scope because it is its own thing: Victory Star's guard is
     * `source.isAlly(...)`, so it covers the whole SIDE and not one attacker.
     *
     * THE MULTIPLIER IS READ FROM THE HOOK THAT MATCHED rather than from the three concatenated, so
     * an ability with handlers on both ends cannot hand back the wrong one's number.
     *
     * NOT YET IN data/tags.json. The artifact could not be regenerated on 2026-08-06 — the corpus
     * fit_policy.loadCorpus() returns had shrunk 29% and a regeneration DROPPED five entities,
     * including Serene Grace and Tinted Lens. See docs/ENGINE.md. No consumer reads `scope`. */
    of: o => {
      const def  = String(o.onModifyAccuracy || '');         // handler sits on the TARGET
      const att  = String(o.onSourceModifyAccuracy || '');   // handler sits on the ATTACKER
      const both = String(o.onAnyAccuracy || '');            // No Guard: neither end may miss
      const side = String(o.onAnyModifyAccuracy || '');      // Victory Star: the whole side
      const src = def + att + both + side;
      if (!/accuracy/i.test(src)) return null;
      const always = /accuracy\s*=\s*true/.test(src) || /return\s+true\s*;/.test(both);
      /* The hook that actually matched owns the number. */
      const from = both || side || att || def;
      const m = from.match(/chainModify\(\[?\s*([\d.]+)/);
      const mult = m ? (+m[1] > 100 ? +(m[1] / 4096).toFixed(2) : +m[1]) : null;
      const setTo = (from.match(/return\s+(\d+)\s*;/) || [])[1];
      const scope = both ? 'every move, both directions'
                  : side ? 'every move on its own side, ally included'
                  : (def && att) ? 'both directions'
                  : att ? 'its own moves' : 'moves aimed at it';
      return { setsTo: always ? 1 : (setTo == null ? null : +setTo),
               mult: always ? null : mult, scope };
    } },
  { tag: 'auraBoost', param: 'multiplies one TYPE for every Pokemon on the field, friend and foe', probe: 'onAnyBasePower',
    why: 'Fairy Aura (1,455 fields) makes every Fairy move 1.33x -- including the foe\'s. A '
       + 'field-wide multiplier that helps both sides is unlike any other boost in the taxonomy',
    /* ROADMAP #81 WIRE 12 -- THE MULTIPLIER IS A CONDITIONAL PAIR AND THE OLD REGEX COULD NOT SEE IT,
     * SO EVERY CARRIER FELL THROUGH TO A HAND-TYPED 1.33. The handler is
     *
     *     return this.chainModify([move.hasAuraBreak ? 3072 : 5448, 4096]);
     *
     * and `/chainModify\(\[?\s*(\d+)/` needs a DIGIT straight after the bracket, so it matched
     * nothing on all three members and `mult` came out of the `: 1.33` fallback on the same line --
     * a silent default that looked exactly like a derivation (CLAUDE.md). The cost is not cosmetic:
     * `md4096(v, 1.33)` truncs to 5447/4096 and the authority is 5448/4096, so a wired float would
     * have been wrong by one 4096th on every Fairy move in the format and the differential would
     * have said the wire failed.
     *
     * THE PAIR IS CARRIED AS [num, den], which is the form `md4096` already takes for exactly this
     * reason (Tough Claws' 5325 against a float's 5324). NOTHING IS INVENTED WHEN THE HANDLER CANNOT
     * BE READ: `mult` comes back null, the tag is still present, and the consumer must refuse it
     * loudly rather than reach for a number nobody derived -- the statChangeInCode precedent.
     *
     * AURA BREAK INVERTS RATHER THAN CANCELS, and the number for that is IN THIS SAME HANDLER (3072
     * = 0.75), not in Aura Break's. So `breakMult` is derived here, from the aura's own source,
     * rather than typed into the consumer. */
    of: a => {
      /* Showdown writes the guard as an EARLY RETURN -- `move.type !== "Fairy"` -- so a probe
       * looking for `===` matched nothing. Third time tonight a handler said the opposite of the
       * shape the reader expected; the empty-tag guard caught it again. */
      const src = String(a.onAnyBasePower || '');
      const t = (src.match(/move\.type\s*!==?\s*"(\w+)"/) || src.match(/move\.type\s*===?\s*"(\w+)"/) || [])[1];
      if (!t) return null;
      const pair = src.match(/chainModify\(\[\s*move\.hasAuraBreak\s*\?\s*(\d+)\s*:\s*(\d+)\s*,\s*(\d+)\s*\]/);
      if (pair) {
        return { type: t, mult: [+pair[2], +pair[3]], breakMult: [+pair[1], +pair[3]],
                 appliesToEveryone: true };
      }
      const m = src.match(/chainModify\(\[\s*(\d+)\s*,\s*(\d+)\s*\]/);
      return { type: t, mult: m ? [+m[1], +m[2]] : null, breakMult: null, appliesToEveryone: true };
    } },
  /* ROADMAP #81 WIRE 12 -- AURA BREAK IS ITS OWN RELATION AND HAD NO TAG AT ALL.
   *
   * It is not an aura and it is not a `damageReduce`: it carries no type, no number and no side --
   * it sets `move.hasAuraBreak = true` on every non-status move on the field, and the AURA's own
   * handler then reads that flag and picks its OTHER numerator. So the only thing this tag has to
   * say is "somebody on this field flips the auras", which is exactly its param.
   *
   * IT INVERTS RATHER THAN CANCELS -- 0.75, not 1.0 -- and that number is deliberately NOT here: it
   * lives on `auraBoost.breakMult`, read off the aura's source, because a consumer that took the
   * value from the breaker would have to know which aura it was breaking.
   *
   * MEMBERSHIP, printed before wiring (docs/LESSONS.md 4): `ability aurabreak` and nothing else --
   * `hasAuraBreak` appears in exactly two handlers in data/abilities.ts, one WRITING it (Aura Break)
   * and two READING it (the two auras, which match `auraBoost` and are excluded by the hook name).
   *
   * ZERO EXPOSURE IN THIS FORMAT, STATED RATHER THAN DISCOVERED: the only carriers are Zygarde and
   * Zygarde-10% (`isNonstandard: 'Past'`) and Zygarde-Mega (`'Future'`), so no legal Champions team
   * can field one. It is derived and wired anyway because the tag SHAPE is what the engine matches
   * on, and leaving one member of a three-member family out is how a family becomes a list. */
  { tag: 'auraBreak', param: 'INVERTS every aura on the field instead of cancelling it', probe: 'hasAuraBreak',
    why: 'Aura Break turns Fairy Aura and Dark Aura from x1.33 into x0.75 for EVERYONE. No legal '
       + 'Champions carrier exists today, so its exposure is zero and its shape is not',
    of: a => /hasAuraBreak\s*=\s*true/.test(String(a.onAnyTryPrimaryHit || '')) ? { inverts: true } : null },
  { tag: 'halvesTypeDamage', param: 'incoming damage of specific types uses a HALVED attacking stat', probe: 'onSourceModifyAtk',
    why: 'Thick Fat (480 fields) halves Fire and Ice. It is not a resistance and does not show in '
       + 'the type chart, so the defensive calculation misses it entirely',
    /* TWO ROUTES INTO THE SAME QUESTION, and only one of them was read.
     *
     * "How much does a move of THIS TYPE do to me" is answered by Showdown in two places: by halving
     * the attacker's stat (onSourceModifyAtk / onSourceModifySpA -- Thick Fat, Heatproof, Purifying
     * Salt, Water Bubble) and by scaling the BASE POWER (onSourceBasePower). Only the first was
     * probed, so DRY SKIN's Fire vulnerability -- `onSourceBasePower` with `chainModify(1.25)` --
     * had no row anywhere in the artifact and could not be wired at any price. It showed up instead
     * as a differential disagreement: houndoom fireblast -> heliolisk, 123-137 on Showdown against
     * 99-117 here, which is 1.24.
     *
     * PRINTED BEFORE IT WAS WIRED, per docs/LESSONS.md 4, because every derivation in this project
     * has over-matched on its first try. This one did not: across the whole corpus the
     * onSourceBasePower probe matches EXACTLY ONE ability -- dryskin, Fire, 1.25. That is the run to
     * repeat if this is ever widened.
     *
     * The multiplier is READ, not assumed. The stat route keeps its measured 0.5 (all four members
     * genuinely chainModify(0.5)); the base-power route carries whatever the handler says, which is
     * why the tag's name understates it -- Dry Skin MULTIPLIES. The name is kept because renaming
     * changes tag membership, and membership is what other readers key on. */
    of: a => {
      const statSrc = String(a.onSourceModifyAtk || '') + String(a.onSourceModifySpA || '');
      const statTypes = [...statSrc.matchAll(/move\.type\s*===?\s*"(\w+)"/g)].map(m => m[1]);
      const bpSrc = String(a.onSourceBasePower || '');
      const bpTypes = [...bpSrc.matchAll(/move\.type\s*===?\s*'?"?(\w+)'?"?/g)].map(m => m[1]);
      const bpMult = (bpSrc.match(/chainModify\(\[?\s*([\d.]+)/) || [])[1];
      if (!statTypes.length && !(bpTypes.length && bpMult)) return null;
      const out = {};
      if (statTypes.length) { out.types = [...new Set(statTypes)]; out.attackerStatMult = 0.5; }
      if (bpTypes.length && bpMult) { out.basePowerTypes = [...new Set(bpTypes)]; out.basePowerMult = +bpMult; }
      return out;
    } },
  { tag: 'reflectsStatusMoves', param: 'Status moves aimed at it are BOUNCED back at the user', probe: 'onAllyTryHitSide',
    why: 'Magic Bounce (190 fields). Will-O-Wisp, Taunt and Thunder Wave do not merely fail, they '
       + 'land on whoever threw them -- so the move is not worth zero, it is worth negative',
    /* Will: "magic bounce reflects all status moves aimed at your side." The handler is
     * onAllyTryHitSide, which is SIDE-wide -- it covers Spikes, Stealth Rock, Reflect-breakers and
     * anything aimed at the partner, not only moves targeting the holder. Scoping it to the holder
     * would have understated it badly. */
    /* IT OVER-MATCHED, AND PRINTING THE MEMBERSHIP IS WHAT CAUGHT IT (LESSONS §4, for the fifth time
     * in this file). `onAllyTryHitSide` is the hook for "I react to something aimed at my side" and
     * says nothing about WHAT the reaction is:
     *
     *     OLD matched 3 : magicbounce, sapsipper, soundproof
     *     NEW matched 1 : magicbounce
     *
     * Sap Sipper's handler BOOSTS its own Attack off an ally's Grass move; Soundproof's REFUSES an
     * ally's sound move. Neither bounces anything, and wiring the tag as it stood would have sent
     * every Will-O-Wisp aimed at a Soundproof body back at its user — 355 corpus uses, and a bounce
     * is worse than an immunity because it is a move that lands on YOU.
     *
     * The bounce itself is the discriminator: Magic Bounce is the only one that rebuilds the move and
     * calls `useMove` back at the source, and it gates on the `reflectable` flag, which is Showdown's
     * own name for the class of move that can be bounced at all. Both are required. */
    of: a => {
      const src = String(a.onAllyTryHitSide || '') + String(a.onTryHit || '');
      if (!a.onAllyTryHitSide) return null;
      if (!/useMove/.test(src) || !/reflectable/.test(src)) return null;
      return { bounces: 'Status', backAtUser: true, requiresFlag: 'reflectable',
               scope: 'the whole side, including hazards and the partner' };
    } },
  { tag: 'hitsTwice', param: 'every damaging move strikes twice, the second at quarter damage', probe: 'onSourceModifySecondaries',
    why: 'Parental Bond (133 fields). Total output is 1.25x, and it breaks Focus Sash and Sturdy '
       + 'on its own -- the first hit leaves 1 HP, the second kills',
    of: a => (a.onPrepareHit && a.onSourceModifySecondaries) ? { hits: 2, secondHitMult: 0.25 } : null },
  { tag: 'typeBecomesMoveType', param: 'the user retypes to whatever it just used, once per switch-in', probe: 'onPrepareHit',
    why: 'Protean (171 fields). Its STAB and its defensive typing both change mid-turn, so a type '
       + 'chart read at the start of the turn is stale by the time damage is applied',
    of: a => (a.onPrepareHit && /setType/.test(String(a.onPrepareHit))) ? { oncePerSwitchIn: true } : null },
  /* Will, reading Eelevate on HoopaDex: "here is what elevate is, levitate plus beast boost?"
   * Exactly that, and it is the linkage argument once more -- a composition of two keys that
   * already exist, not a new mechanic. It was sitting `untagged` on 259 fields. Beast Boost itself
   * was not in the table at all, since nothing on a sheet carries it. */
  { tag: 'boostsOnKO', param: 'highest stat +1 every time it takes something down', probe: 'onSourceAfterFaint',
    why: 'Beast Boost and Eelevate (259 fields). It compounds across a game and nothing recomputes '
       + 'the speed order or damage after a kill, so the second kill is priced like the first',
    of: a => (a.onSourceAfterFaint && /getBestStat|bestStat/.test(String(a.onSourceAfterFaint)))
             ? { stat: 'highest', stages: 1, trigger: 'on KO' } : null },
  /* Will: "sheer force removes secondary effects idk." It does, and that is the half that was
   * missing -- it was tagged damageBoost alone.
   *
   * This is the first tag that ZEROES another tag. A Sheer Force user's moves have their secondaries
   * DELETED in exchange for 1.3x power, so every flinch chance, every burn chance and every stat
   * drop the taxonomy records for those moves is worth exactly nothing on that Pokemon. Under
   * linkage it is a writer that sets the secondary-effect probability to zero, which is why the
   * damage distribution has to read the final value rather than the move's own field. */
  { tag: 'removesOwnSecondaries', param: 'its moves LOSE every secondary effect, in exchange for x1.3', probe: 'removesOwnSecondaries',
    why: 'Sheer Force (278 fields). Every flinch, burn and stat-drop chance recorded against its '
       + 'moves is zero on this Pokemon -- the first tag that invalidates other tags',
    of: a => (a.onModifyMove && /delete move\.secondaries/.test(String(a.onModifyMove)))
             ? { secondaryChance: 0, powerMult: 1.3 } : null },
  /* Will: "bulletproof is a class of moves we already blocked out i thought." Exactly -- `bullet`
   * is already a linkage key (16 moves, 13,644 move-slots), and Bulletproof is simply a subscriber
   * to it that returns immunity. It was sitting UNTAGGED. This is the same tag shape as Soundproof
   * on `sound` and Overcoat on `powder`, so it derives the flag rather than naming abilities. */
  { tag: 'immuneToMoveClass', param: 'moves carrying one FLAG deal zero -- the flag is a linkage key', probe: 'immuneToMoveClass',
    why: 'Bulletproof blocks the 16 bullet moves (13,644 move-slots), Soundproof the sound ones, '
       + 'Overcoat powder. Not a type immunity and invisible to the type chart',
    of: a => {
      const src = String(a.onTryHit || '') + String(a.onAllyTryHitSide || '');
      const f = (src.match(/flags\["(\w+)"\]/) || src.match(/flags\.(\w+)/) || [])[1];
      if (!f || !/return null|-immune/.test(src)) return null;
      return { blocksFlag: f };
    } },
  /* Will: "infiltrator ignores sub right." It does, and more -- it also passes through Reflect,
   * Light Screen, Safeguard, Mist and Aurora Veil. It was UNTAGGED.
   *
   * Under linkage this is a WRITER that nullifies other tags: every screen the opponent has set,
   * which the damage engine is applying as a x0.5, simply does not exist against this Pokemon. So
   * it belongs with Sheer Force as a tag whose job is to invalidate other tags' values. */
  { tag: 'ignoresScreensAndSubs', param: 'screens, Safeguard and Substitute do not apply to its moves', probe: 'infiltrates',
    why: 'Infiltrator. Reflect and Light Screen are a x0.5 the damage engine applies -- against '
       + 'this ability that multiplier is 1.0, and a Substitute the bot is hiding behind is not there',
    of: a => (a.onModifyMove && /infiltrates\s*=\s*true/.test(String(a.onModifyMove)))
             ? { ignoresScreens: true, ignoresSubstitute: true } : null },
  /* Will: "mega sol is special, solarbeam in one turn, weather ball is fire."
   *
   * The sharpest case in the whole review. Mega Sol does NOT set weather -- it makes the holder's
   * own moves resolve AS IF harsh sun were up. A private, per-Pokemon weather that the field never
   * reports.
   *
   * That breaks every weather tag built tonight, because all of them read the FIELD: weatherScaled,
   * chargeSkippedByWeather, speedCond, weatherSetter. Ask the field and it says 'none' while this
   * Pokemon fires a one-turn Solar Beam and a Fire-type Weather Ball. It is a WRITER on the weather
   * key scoped to a single Pokemon, so any consumer has to ask 'what weather does THIS mon see',
   * never 'what weather is up'. */
  { tag: 'privateWeather', param: 'the HOLDER moves resolve as if a weather were up, while the field says none', probe: 'onWeatherModifyDamage',
    why: 'Mega Sol reaches 139 fields. Solar Beam becomes one turn, Weather Ball becomes Fire, and '
       + 'every weather-conditional tag reads the FIELD -- which reports no weather at all',
    of: a => {
      const src = String(a.onWeatherModifyDamage || '') + String(a.onAnyWeatherModifyDamage || '');
      if (!src) return null;
      const w = weatherIn(src);
      return { actsAsWeather: w.length ? w : ['sun'], visibleOnField: false,
               affects: 'only this Pokemon' };
    } },
  /* `blocksStatusMoves` RETIRED 2026-08-05 (STAGED), for BOTH of the reasons a tag can be wrong at
   * once. REDUNDANT: Good as Gold's refusal is `refusesStatusMoves`, which is consumed at five
   * engine sites. OVER-MATCHED: its loose regex also caught Telepathy (blocks an ALLY'S DAMAGE, not
   * status) and Wonder Guard (tests Status and bare-returns to ALLOW it) -- the exact pair the
   * refusesStatusMoves derivation was already tightened against (LESSONS §4). Survivor:
   * refusesStatusMoves. */
  { tag: 'speedOnItemLoss', param: 'speed x2 once its item is gone', probe: 'unburden',
    why: 'Unburden, 2.23%. A consumed Sash or berry doubles their speed, which flips the order '
       + 'mid-battle and the item tracking now makes observable',
    /* REACTING TO THE LOSS, NOT PREVENTING IT. Any onTakeItem matched, which caught STICKY HOLD --
     * whose handler exists precisely to REFUSE the loss and return false. Wiring the engine to this
     * would have doubled Sticky Hold's Speed, the opposite of what the ability does. Unburden marks
     * itself with a volatile when the item goes; that is the thing to look for. */
    of: a => /addVolatile/.test(String(a.onAfterUseItem || '') + String(a.onTakeItem || ''))
      ? { speedMult: 2 } : null },
  { tag: 'healsAllyOnSwitchIn', param: 'restores the partner on entry', probe: 'hospitality',
    why: 'Hospitality, 5.22% of abilities and the third most common in the format',
    of: a => (a.onStart && /heal/i.test(String(a.onStart))) ? { heals: true } : null },
  { tag: 'reducesAllyDamage', param: 'my PARTNER takes x0.75', probe: 'friendguard',
    why: 'Friend Guard. Changes every damage number aimed at the partner and nothing applies it',
    of: a => a.onAnyModifyDamage ? { mult: 0.75 } : null },
  { tag: 'healsOnSwitchOut', param: 'restores a third of max HP by leaving', probe: 'regenerator',
    why: 'Regenerator. Makes switching a HEAL, which is the strongest argument for pivoting that the '
       + 'switch features cannot see',
    /* THIS OVER-MATCHED, AND IT WAS CAUGHT BY PRINTING THE MEMBERSHIP BEFORE WIRING IT — the rule in
     * docs/LESSONS.md §4, for the fourth time. `a.onSwitchOut ? {heal: 1/3}` gave a 33% heal to every
     * ability that does ANYTHING on the way out: Natural Cure (which cures status and heals nothing)
     * and Zero to Hero (which forme-changes Palafin). Wiring the tag as it stood would have handed
     * two abilities a heal they do not have, on 227 corpus uses.
     *
     * The handler states the number and it is now READ rather than assumed:
     * `pokemon.heal(pokemon.baseMaxhp / 3)`. Membership went 3 -> 1, and the one is Regenerator. */
    of: a => { const m = String(a.onSwitchOut || '').match(/\.heal\(\s*\w+\.(?:base)?[Mm]axhp\s*\/\s*(\d+)/);
      return m ? { heal: 1 / (+m[1]) } : null; } },
  /* THE SWITCH-OUT TRIGGER, AND IT IS A CLASS RATHER THAN THREE ABILITIES.
   *
   * Will, 2026-08-07: *"ALL THE SWITCH OUT ABILITIES ACTIVATE ON SWITCH OUT LIKE REGENERATOR OR
   * NATURAL CURE OR ZERO TO HERO."* He is describing a MOMENT, and the vocabulary above has no word
   * for it — only abilities that individually happen to mention leaving. Measured against the
   * authority the day this was written, and the three he named are exactly the three:
   *
   *     Regenerator  1,149 uses   onSwitchOut   healsOnSwitchOut     right, and already wired
   *     Zero to Hero   191 uses   onSwitchOut   switchInForme        WIRED AT THE WRONG MOMENT
   *     Natural Cure    97 uses   onSwitchOut   "untagged"           ABSENT ENTIRELY
   *
   * `healsOnSwitchOut` above is the tag that was NARROWED to escape exactly this over-match, and
   * narrowing it was right — a heal is not a cure. What was missing is the thing it was narrowed out
   * of: the trigger. So the trigger is derived here from `onSwitchOut` and the three fall out
   * together, and a fourth ability printed next regulation arrives with them.
   *
   * MEMBERSHIP WAS PRINTED BEFORE THIS WAS WIRED, as docs/LESSONS.md §4 requires — and the danger
   * here is the OPPOSITE of the usual one. It does not over-match: `onSwitchOut` is exactly three
   * abilities in this format and every one of them is a real member. The danger is folding in
   * Emergency Exit and Wimp Out, which are `onEmergencyExit` — a DIFFERENT moment (a HP threshold
   * crossed mid-turn, not a switch) — so the predicate reads the one field and no other.
   *
   * `does` IS DERIVED FROM THE HANDLER, never from the name, because the whole point of a class is
   * that the engine dispatches on shape. An `onSwitchOut` this deriver cannot read comes out as
   * `does: 'unknown'` and the engine COUNTS it rather than silently doing nothing — a silent default
   * looks exactly like a working feature. */
  { tag: 'switchOutTrigger', param: 'the ability fires as the body LEAVES the field',
    probe: 'switchOutTrigger',
    why: 'Regenerator (1,149), Zero to Hero (191) and Natural Cure (97) are one moment and were '
       + 'three unrelated facts. Zero to Hero fired on the RETURN and Natural Cure did not exist',
    of: (a) => {
      const src = String(a.onSwitchOut || '');
      if (!src) return null;
      const heal = src.match(/\.heal\(\s*\w+\.(?:base)?[Mm]axhp\s*\/\s*(\d+)/);
      if (heal) return { does: 'heal', heal: 1 / (+heal[1]) };
      if (/\.clearStatus\(|setStatus\(\s*['"]{2}\s*\)/.test(src)) return { does: 'cure', cures: 'any' };
      if (/formeChange\(/.test(src)) {
        /* THE FORME COMES OUT OF THE SPECIES TABLE, exactly as `switchInForme` above derives it, so
         * the two cannot disagree about what Palafin becomes. Rediscovered rather than copied: a
         * battleOnly forme names the base it comes from and the base carries the trigger ability. */
        for (const sp of dex.species.all()) {
          if (!sp.exists || !sp.battleOnly) continue;
          const baseName = Array.isArray(sp.battleOnly) ? sp.battleOnly[0] : sp.battleOnly;
          const base = dex.species.get(baseName);
          if (!base || !base.exists) continue;
          const abils = Object.values(base.abilities || {}).map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, ''));
          if (abils.includes(a.id)) return { does: 'forme', from: base.name, becomes: sp.name,
            /* Showdown announces the forme change on the way OUT (`|detailschange|`) and the ability
             * itself on the way back IN (`|-activate|...|ability: Zero to Hero`, guarded by
             * `heroMessageDisplayed`). Two moments, one mechanic, and the engine needs both. */
            announcesOnReturn: true };
        }
        return { does: 'forme' };
      }
      return { does: 'unknown' };
    } },
  /* THE FORME THAT CHANGES WHEN THE BODY IS HIT — Disguise and Ice Face.
   *
   * WIRE 23 landed Disguise's SUBSTITUTION (the first hit is refused and costs maxhp/8) keyed on the
   * ability NAME, and said so rather than pretending to a derivation: `disguise.tags` was
   * `["preventsCrit","formeChange"]`, and both of those hold three other abilities each. It was right
   * to name it and wrong to leave it there, because the half WIRE 23 did not do is the SPECIES: both
   * engines end on 114/130 and Showdown's active slot and party read `mimikyubusted` while ours read
   * `mimikyu`. The HP probe passes; the board does not.
   *
   * DERIVED ON THE SHAPE, and it is a narrow one: an `onUpdate` that calls `formeChange`, plus an
   * `onDamage`/`onDamagingHit` that sets `effectState.busted`. MEMBERSHIP WAS PRINTED BEFORE THIS WAS
   * WIRED and the first predicate — `formeChange` anywhere in any handler — matched NINE abilities
   * including Forecast, Flower Gift, Hunger Switch, Power Construct, Schooling and Shields Down, none
   * of which changes forme on being hit. The narrow one matches exactly Disguise and Ice Face, which
   * are the two members of this mechanic.
   *
   * `sameStats` IS THE PARAM THAT MATTERS TO A CONSUMER and it is why this carries more than a name:
   * Mimikyu and Mimikyu-Busted have IDENTICAL base stats and types, so the change is a species rename
   * and nothing else; Eiscue and Eiscue-Noice do NOT, so a consumer that renamed without rebuilding
   * would be silently wrong there. Stated by the artifact rather than discovered by the next reader. */
  { tag: 'formeOnHit', param: 'the holder changes forme when a move damages it', probe: 'formeOnHit',
    why: 'Disguise, 142 uses. WIRE 23 modelled the free hit and never renamed the body, so the two '
       + 'engines part on the species in the active slot AND in the party on every Mimikyu game',
    of: (a) => {
      const up = String(a.onUpdate || '');
      const hit = String(a.onDamage || '') + String(a.onDamagingHit || '');
      if (!/formeChange\(/.test(up)) return null;
      if (!/effectState\.busted\s*=\s*true/.test(hit)) return null;
      for (const sp of dex.species.all()) {
        if (!sp.exists || !sp.battleOnly || sp.isNonstandard) continue;
        const baseName = Array.isArray(sp.battleOnly) ? sp.battleOnly[0] : sp.battleOnly;
        const base = dex.species.get(baseName);
        if (!base || !base.exists) continue;
        const abils = Object.values(base.abilities || {}).map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (!abils.includes(a.id)) continue;
        const out = { from: base.name, becomes: sp.name,
          sameStats: JSON.stringify(base.baseStats) === JSON.stringify(sp.baseStats),
          sameTypes: JSON.stringify(base.types) === JSON.stringify(sp.types) };
        /* THE EIGHTH IS THE HANDLER'S OWN NUMBER: `this.damage(pokemon.baseMaxhp / 8, ...)` runs in
         * the SAME onUpdate as the forme change, so the cost and the rename are one event and the
         * engine should not carry the 8 as a literal. */
        const dm = up.match(/\.damage\(\s*\w+\.(?:base)?[Mm]axhp\s*\/\s*(\d+)/);
        if (dm) out.costsMaxHPDiv = +dm[1];
        return out;
      }
      return null;
    } },
  /* NEW 2026-08-08 -- THE FORME THAT FLIPS ON A CLOCK, AND IT IS NOT `formeOnHit` AND NOT
   * `switchInForme`. Hunger Switch alternates Morpeko <-> Morpeko-Hangry at the END OF EVERY TURN,
   * for the whole battle, triggered by nothing at all. Its `onResidualOrder` is 29 -- one slot after
   * Speed Boost's 28 -- so the consumer's home is the residual block that wire already built.
   *
   * THE WIDE PREDICATE IS WRONG AND WAS MEASURED WRONG FIRST, exactly as `formeOnHit`'s header
   * records: `formeChange` in ANY handler matches THIRTEEN abilities in this format, and even
   * `formeChange` inside `onResidual` still matches FOUR -- Hunger Switch, Power Construct,
   * Schooling and Shields Down. The other three are HP-THRESHOLD abilities: they change forme when
   * the holder crosses half or a quarter of its maximum and STAY there. That is a state machine, not
   * a clock, and giving them an alternating flip would put a Minior back in its meteor shell every
   * other turn.
   *
   * SO THE SHAPE IS THE ALTERNATION ITSELF: a ternary on the CURRENT species name choosing between
   * two forme strings, with no `maxhp` anywhere in the handler. Membership is exactly Hunger Switch,
   * printed before this was wired.
   *
   * `sameStats` / `sameTypes` ARE CARRIED FOR THE SAME REASON `formeOnHit` CARRIES THEM: the consumer
   * has to know whether the flip is a rename or a rebuild, and `data/engine-data.js` is downstream of
   * the division that reads this. Morpeko and Morpeko-Hangry are identical in both, which is what
   * makes the flip safe to model as a rename. `stopsWhenTerastallized` is the handler's second guard
   * and is recorded even though this engine models no Terastallization -- an absent fact should be
   * visible in the artifact rather than absent from it. */
  { tag: 'formeCycleResidual', param: 'the forme ALTERNATES at the end of every turn', probe: 'formeCycleResidual',
    why: 'Hunger Switch, 32 uses, tagged `untagged` until 2026-08-08. Morpeko is Morpeko-Hangry by '
       + 'the end of the turn it walks in on, and the board says so from turn 1',
    of: (a) => {
      const src = String(a.onResidual || '');
      if (!/formeChange\(/.test(src)) return null;
      /* the HP-threshold members carry `maxhp` and are a different mechanic entirely */
      if (/maxhp/.test(src)) return null;
      const m = src.match(/species\.name\s*===?\s*["']([^"']+)["']\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']/);
      if (!m) return null;
      const a1 = m[1], a2 = m[2];                     // "Morpeko" and "Morpeko-Hangry"
      const s1 = dex.species.get(a1), s2 = dex.species.get(a2);
      if (!s1 || !s1.exists || !s2 || !s2.exists) return null;
      const gm = src.match(/baseSpecies\s*!==?\s*["']([^"']+)["']/);
      return { alternates: [s1.name, s2.name], onlyBaseSpecies: gm ? gm[1] : null,
               sameStats: JSON.stringify(s1.baseStats) === JSON.stringify(s2.baseStats),
               sameTypes: JSON.stringify(s1.types) === JSON.stringify(s2.types),
               stopsWhenTerastallized: /terastallized/.test(src) };
    } },
  { tag: 'blocksBerries', param: 'their berries cannot be eaten', probe: 'unnerve',
    why: 'Unnerve, 2.03%. Turns off Sitrus (10.8% of items) and every resist berry on the other side',
    of: a => a.onFoeTryEatItem ? { blocks: true } : null },
  { tag: 'ignoresStatStages', param: 'the boost multiplier does not apply, permanently', probe: 'unaware',
    why: 'Unaware, 172 uses. Ignores the opponent stat stages in BOTH directions, so their setup is '
       + 'worthless and so is yours. Same parameter Darkest Lariat sets for one move',
    of: a => a.onAnyModifyBoost ? { ignores: 'all opposing stages' } : null },
  { tag: 'preventsCrit', param: 'P(crit) = 0', probe: 'onCriticalHit',
    why: 'Shell Armor and Battle Armor. Turns Flower Trick from a guaranteed crit into an ordinary hit',
    of: a => a.onCriticalHit !== undefined ? { pCrit: 0 } : null },
  /* {sets:true} named neither WHICH weather nor which terrain — the boolean-instead-of-parameter
   * defect, found again when Will listed the real switch-in threats ("weather, type immunities, or
   * farigaraf blocking prio") and none of the three carried a consumable value. */
  { tag: 'weatherSetter', param: 'weather := WHICH on switch-in', probe: 'weatherSetter',
    why: 'and megaing can COST you it, which is Will\'s reason to decline a mega. Also the first '
       + 'switch-in threat class: a benched Drizzle deletes the sun your Solar Beam click rides on',
    of: a => {
      const m = a.onStart && String(a.onStart).match(/setWeather\(\s*["'](\w+)["']/);
      if (!m) return null;
      return { weather: W2ENGINE[m[1]] || m[1] };
    } },
  /* AIR LOCK AND CLOUD NINE, and the reason this entry exists is that the previous pass recorded them
   * as *"MISSING — there is no artifact to wire from"*. That was wrong, and the correction matters more
   * than the mechanic: Showdown does not express weather suppression through a HANDLER at all, it
   * expresses it as a FLAT PROPERTY on the ability object, `suppressWeather: true`. Every derivation
   * above probes a handler name, so a property-shaped fact was invisible to all of them and the gap
   * read as "not derivable" when it was "not looked for".
   *
   * IT IS EXACT RATHER THAN HEURISTIC. `dex.abilities.all().filter(a => a.suppressWeather)` returns
   * exactly two abilities in this format, airlock and cloudnine, and nothing else — printed by the
   * membership check the same as every other derivation here. Delta Stream carries the property set to
   * FALSE and is correctly excluded by the truthiness test.
   *
   * WHAT IT IS WORTH, measured before it was written: Air Lock's only carrier is Rayquaza, which is
   * NOT in this format, so it has ZERO. Cloud Nine has two carriers that are (Altaria, Drampa) and 18
   * declared sheets across 40,595 stored games. Small — and derived anyway, because the cost is this
   * block and the alternative was a census row that says the engine cannot know. */
  /* MUMMY AND WANDERING SPIRIT REWRITE THE ATTACKER'S ABILITY ON CONTACT, and the previous pass filed
   * them as unwirable because `contactPunish` carries `{trigger:'contact', inflicts:null,
   * fraction:null}` -- a tag that says something happens and not what. That was true of the TAG and
   * not of the DEX: both handlers state the whole rule in one call, and the two calls are different
   * enough to name the two modes apart.
   *
   *   mummy / lingeringaroma :  source.setAbility("mummy", target)   -> mode 'infect', and the id it
   *                             writes is in the call, so the consumer never types an ability name.
   *   wanderingspirit        :  this.skillSwap(source, target)       -> mode 'swap'.
   *
   * BOTH ARE GATED ON checkMoveMakesContact IN THE HANDLER, which is why the trigger is asserted here
   * rather than assumed: an ability that rewrote on ANY hit would be a different mechanic and must not
   * inherit this tag.
   *
   * THE OTHER REASON IT WAS FILED WAS "0 corpus sheets between them", AND THAT NO LONGER HOLDS.
   * `tag_dex`'s own usage count reads mummy 41 and wanderingspirit 58 on the current store. */
  { tag: 'rewritesAbilityOnContact', param: "mode: 'infect' (and WHICH ability) or 'swap'", probe: 'onDamagingHit',
    why: 'Mummy and Wandering Spirit. The attacker walks away as a different Pokemon, and every damage '
       + 'and speed number after that is computed from an ability it no longer has',
    of: a => {
      if (!a.onDamagingHit) return null;
      const src = String(a.onDamagingHit);
      if (!/checkMoveMakesContact/.test(src)) return null;
      const inf = src.match(/setAbility\(\s*["'](\w+)["']/);
      if (inf) return { mode: 'infect', becomes: inf[1], trigger: 'contact' };
      if (/skillSwap\s*\(/.test(src)) return { mode: 'swap', trigger: 'contact' };
      return null;
    } },
  { tag: 'weatherSuppression', param: 'the weather is on the field and does nothing', probe: 'suppressWeather',
    why: 'Air Lock and Cloud Nine. Not a handler — a flat property on the ability, which is why every '
       + 'handler-probing derivation in this file missed it',
    of: a => (a.suppressWeather ? { suppresses: true } : null) },
  { tag: 'terrainSetter', param: 'terrain := WHICH on switch-in', probe: 'terrainSetter',
    why: 'same shape as weather',
    of: a => {
      const m = a.onStart && String(a.onStart).match(/setTerrain\(\s*["'](\w+)["']/);
      return m ? { terrain: m[1].replace(/terrain$/, '') } : null;
    } },
  { tag: 'speedCond', param: 'speed x2 under a condition', probe: 'onModifySpe',
    why: 'Chlorophyll, Swift Swim, Sand Rush, Slush Rush, Unburden, Quick Feet. Already probed for the speed order',
    of: a => {
      if (!a.onModifySpe) return null;
      const src = String(a.onModifySpe);
      return { inWeather: weatherIn(src), speedMult: multiplierIn(src) };
    } },
  /* TIGHTENED. `onImmunity` also covers immunity to WEATHER CHIP -- which is why Sand Veil (135
   * uses) and Snow Cloak (219) were being reported as type-immunity abilities when they are evasion
   * abilities. A type immunity is an onTryHit that inspects move.type. Found by Will asking about
   * Sand Veil and Bright Powder. */
  /* LEVITATE AND EELEVATE ARE IRREDUCIBLE. Neither exposes a handler for its Ground immunity --
   * the simulator special-cases the ability by name in its own type logic -- so there is nothing to
   * probe and this is the one place a name check is not a hardcode but the only available truth.
   * Eelevate is Levitate PLUS Beast Boost (Will spotted it), so it carries both keys. */
  { tag: 'typeImmunity', param: 'damage of one TYPE := 0', probe: 'IMM',
    why: 'Levitate, Water Absorb, Flash Fire, Sap Sipper. Clicking into one wastes the turn entirely',
    of: a => {
      /* Two implementations, and excluding the second dropped LEVITATE. onTryHit inspects move.type
       * (Water Absorb, Flash Fire); onImmunity is handed a TYPE NAME directly (Levitate -> 'Ground').
       * The distinction from weather-chip immunity is whether that argument is a type at all. */
      /* LEVITATE HAS NO HANDLERS AT ALL -- it lives in the sim's type-effectiveness logic, so it is
       * genuinely underivable and is the one honest exception to the no-hardcodes rule here. The
       * damage engine already carries it in its IMM map; this names it so nobody later "fixes" the
       * probe wondering why Ground immunity is missing. */
      /* Eelevate is Levitate PLUS Beast Boost -- Will spotted it on HoopaDex -- and like Levitate
       * it exposes NO handler for the Ground immunity, because the simulator special-cases both by
       * name in its own type logic. This is the one place a name check is the only available truth
       * rather than a hardcode. The Beast Boost half is carried separately by boostsOnKO. */
      if (/^(levitate|eelevate)$/.test(norm(a.name)))
        return { immune: true, type: 'Ground', via: 'not derivable -- no handler' };
      /* WHICH type, and what the absorber GAINS — {immune:true} could not price "my Thunderbolt
       * into their benched Gastrodon is not just zero, it is minus a heal". The gain is the
       * difference between a wasted click and a fed pivot. */
      if (a.onTryHit) {
        const src = String(a.onTryHit);
        const ty = src.match(/move\.type\s*===\s*"(\w+)"/);
        if (ty) {
          const gain = {};
          const heal = src.match(/heal\([^)]*maxhp\s*\/\s*(\d+)/i);
          if (heal) gain.heal = '1/' + heal[1];
          const bo = src.match(/this\.boost\(\s*\{([^}]*)\}/);
          if (bo) { gain.boosts = {}; for (const part of bo[1].split(',')) {
            const kv = part.split(':').map(x => x.trim());
            if (kv.length === 2 && /^-?\d+$/.test(kv[1])) gain.boosts[kv[0].replace(/["']/g, '')] = +kv[1]; } }
          const vol = src.match(/addVolatile\(\s*["'](\w+)["']/);
          if (vol) gain.volatile = vol[1];
          return { immune: true, type: ty[1], via: 'onTryHit',
                   gain: Object.keys(gain).length ? gain : null };
        }
      }
      const TYPES = /Bug|Dark|Dragon|Electric|Fairy|Fighting|Fire|Flying|Ghost|Grass|Ground|Ice|Normal|Poison|Psychic|Rock|Steel|Water/;
      if (a.onImmunity) {
        const m = String(a.onImmunity).match(TYPES);
        if (m) return { immune: true, type: m[0], via: 'onImmunity' };
      }
      return null;
    } },
  { tag: 'redirectsType', param: 'draws that type to itself', probe: 'lightningrod',
    why: 'Lightning Rod and Storm Drain redirect AND boost',
    /* onAnyRedirectTarget, not onFoeRedirectTarget -- the probe was simply wrong and the tag matched
     * nothing until the empty-tag check flagged it. */
    of: a => {
      const src = String(a.onAnyRedirectTarget || a.onFoeRedirectTarget || '');
      if (!src) return null;
      const ty = src.match(/move\.type\s*[!=]==?\s*"(\w+)"/);
      return { type: ty ? ty[1] : null };
    } },
  /* SPLIT ON WILL'S RULING, 2026-07-29. One tag was covering two mechanics that imply OPPOSITE
   * decisions, and the difference is whether the effect COMPOUNDS.
   *
   *   buffsHolderOnHit  Stamina +1 Def, Justified +1 Atk, Electromorphosis banks Charge. Every hit
   *                     makes the next one worse, so the answer is stop attacking or kill it now.
   *   punishesAttacker  Rough Skin chip, Static/Flame Body status, Gooey -1 Spe. A flat toll each
   *                     time, avoidable by not making contact, and it never accumulates.
   *
   * This is Will's Bellibolt turn. Discharge into Archaludon was resisted AND handed it a free
   * Stamina boost -- the first kind. Against a Rough Skin body the same click is fine. One tag
   * could not tell those apart, so the bot could not either.
   *
   * Derived by asking whether the handler buffs the thing that GOT hit, or hurts the SOURCE. Weak
   * Armor and Gooey legitimately do both and carry both tags. */
  { tag: 'buffsHolderOnHit', param: 'the thing you hit gets STRONGER, and it compounds', probe: 'buffsHolderOnHit',
    why: 'Stamina (1,643) turns every physical hit into +1 Def; Justified, Electromorphosis and Weak '
       + 'Armor bank a resource. Hitting it again is worse than hitting it the first time -- exactly '
       + 'the Bellibolt/Archaludon turn, where a resisted spread move fed a free boost',
    of: a => {
      if (!effectRecipients(a).holder) return null;
      /* CARRY THE ACTUAL BOOST, not just `compounds: true`. The first wire of this tag had to fall
       * back on `ability==='stamina'?'df':...` inside the engine -- a name hardcode, which is the
       * thing this project keeps banning. The handler states it plainly: this.boost({ def: 1 }).
       * Volatile gains (Electromorphosis banking Charge) have no stat and say so. */
      const src = String(a.onDamagingHit || '') + String(a.onHit || '');
      const boosts = {};
      const m = src.match(/this\.boost\(\s*\{([^}]*)\}/);
      if (m) for (const part of m[1].split(',')) {
        const kv = part.split(':').map(x => x.trim());
        if (kv.length === 2 && /^-?\d+$/.test(kv[1])) boosts[kv[0].replace(/["']/g, '')] = +kv[1];
      }
      const vol = (src.match(/addVolatile\(\s*["'](\w+)["']/) || [])[1] || null;
      /* ROADMAP #101 -- AND WHEN. `when: null` is the honest reading for Stamina, which really has no
       * gate; it is not a "could not read this" placeholder. See hitCondIn. */
      return { compounds: true, boosts: Object.keys(boosts).length ? boosts : null, gainsVolatile: vol,
               when: hitCondIn(src) };
    } },
  { tag: 'punishesAttacker', param: 'the ATTACKER pays a flat toll, which does NOT compound', probe: 'punishesAttacker',
    why: 'Rough Skin (3,762) chips, Static/Flame Body/Poison Point status, Cursed Body disables. '
       + 'Unlike a holder buff this never accumulates, so the move stays correct -- it is a cost to '
       + 'price in, not a reason to stop attacking',
    of: a => {
      if (!effectRecipients(a).attacker) return null;
      /* Will: "spicy spray inflicts burn status." It did not say which status -- same
       * boolean-instead-of-parameter defect as Swift Swim not naming rain. */
      const src = String(a.onDamagingHit || '') + String(a.onHit || '');
      /* THE TRIGGER IS PART OF THE MECHANIC, and leaving it out produced a live wrong number: the
       * first wire applied any `fraction` on every contact hit, so Aftermath -- which the handler
       * gates on `!target.hp`, i.e. the holder DYING -- chipped attackers 25% per hit, and Gulp
       * Missile -- gated on Cramorant's gulping/gorging formes -- punished from a base-forme body.
       * Each condition below is read from the handler text, never from the ability's name. */
      const trigger = /checkMoveMakesContact|flags\.contact/.test(src) ? 'contact'
                    : /move\.category\s*===\s*"Physical"/.test(src)   ? 'physical'
                    : /move\.category\s*===\s*"Special"/.test(src)    ? 'special'
                    : 'anyHit';
      const formes = (src.match(/\[([^\]]*)\]\.includes\(target\.species\.id\)/) || [])[1];
      /* Attacker-directed stat drops: this.boost({...}, source). Gooey and Tangling Hair say
       * { spe: -1 } in the call itself; recording nothing here was the reason they could not be
       * wired without a name list. */
      let boosts = null;
      for (const m of src.matchAll(/this\.boost\(\s*\{([^}]*)\}\s*,\s*source\b/g)) {
        boosts = boosts || {};
        for (const part of m[1].split(',')) {
          const kv = part.split(':').map(x => x.trim());
          if (kv.length === 2 && /^-?\d+$/.test(kv[1])) boosts[kv[0].replace(/["']/g, '')] = +kv[1];
        }
      }
      const hazard = (src.match(/addSideCondition\(\s*"(\w+)"/) || [])[1] || null;
      return { compounds: false, trigger,
               onFaintOnly: /!target\.hp\b/.test(src) || null,
               requiresForme: formes ? formes.split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean) : null,
               inflicts: statusIn(src),
               /* Carries its chance for the same reason inflicts does: Cursed Body is a 30% roll,
                * and "disable" with no number would round to "always" the moment it was consumed. */
               inflictsVolatile: (m => m ? { volatile: m[1],
                 chance: (rc => rc ? +rc[1] / +rc[2] : 1)(src.match(/randomChance\(\s*(\d+)\s*,\s*(\d+)\s*\)/)) } : null
               )(src.match(/addVolatile\(\s*["'](\w+)["']/)),
               boosts,
               fraction: (src.match(/baseMaxhp\s*\/\s*(\d+)/) || [])[1] || null,
               hazard,
               maxLayers: hazard ? +((src.match(/layers\s*<\s*(\d+)/) || [])[1] || 0) || null : null,
               setsWeather: (src.match(/setWeather\(\s*["'](\w+)["']/) || [])[1] || null };
    } },
  /* DERIVED FROM THE HANDLER SOURCE, not from a list of names (Will: "no hardcodes"). Showdown
   * expresses the contact condition two ways -- checkMoveMakesContact() or move.flags.contact -- and
   * reading the function text catches both. It also separates the TRIGGER, which Will spotted was
   * being conflated: Rough Skin and Static fire on CONTACT, Toxic Debris on any PHYSICAL hit, and
   * Stamina and Cursed Body on ANY hit at all. */
  /* `contactPunish` (ability) RETIRED 2026-08-05 (STAGED). docs/TAG-COVERAGE.md named the pair:
   * "contactPunish (dead, 6,829 uses) beside punishesAttacker (live). One of those is redundant and
   * nothing has noticed." Verified before retiring: every carrier (Aftermath, Cute Charm, Effect
   * Spore, Rough Skin, ...) also carries `punishesAttacker`, whose params are a strict SUPERSET
   * (trigger, inflicts, fraction, plus onFaintOnly, hazard, boosts, requiresForme -- the fields the
   * consumer actually reads). The survivor is punishesAttacker. */
  { tag: 'damageReduce', param: 'x<1 damage taken', probe: 'multiscale',
    why: 'Filter, Solid Rock, Multiscale, Thick Fat, Heatproof, Fluffy. Overcalling kills without them',
    of: a => {
      if (!a.onSourceModifyDamage) return null;
      const src = String(a.onSourceModifyDamage).replace(/\s+/g, ' ');
      const mult = multiplierIn(src);
      if (!(mult > 0 && mult < 1)) return null;
      /* THE CONDITION IS THE HALF THAT WAS MISSING, and without it the tag is dangerous rather than
       * merely incomplete: Filter cuts only SUPER-EFFECTIVE hits and Ice Scales only SPECIAL ones,
       * so an engine reading damageMult alone would halve everything and be more wrong than the
       * hardcoded name list it replaced. Read from the same handler the multiplier comes from.
       *
       * `null` now means genuinely unconditional. It used to mean "no HP gate", which quietly
       * described Filter and Ice Scales as unconditional -- and RIPEN, which reduces nothing at all
       * and is about berries; requiring a real multiplier drops it. */
      /* `damageReduce` KEEPS ITS STRING VOCABULARY and is untouched by ROADMAP #112 -- its consumer
       * (medicham2, the MODMUL block) reads 'fullHP' / 'superEffective' / 'special' / 'physical' /
       * 'sound' and nothing else. The one thing that changed is that the gate is now asked for its
       * DIRECTION instead of only its truthiness: `hpGateIn` returns an object for BOTH `>= maxhp`
       * and `<= maxhp/N`, and calling the second of those 'fullHP' would be exactly backwards. No
       * member of this family carries a `<=` gate today (Multiscale and Shadow Shield are the only
       * two, both `>=`), so the artifact is unchanged -- verified by diffing the regenerated
       * tags.json. The guard is here so it stays that way. */
      const _g = hpGateIn(src);
      let when = (_g && _g.cmp === '>=') ? 'fullHP' : null;
      if (!when) {
        if (/typeMod\s*>\s*0/.test(src)) when = 'superEffective';
        else if (/category\s*===\s*["']Special["']/.test(src)) when = 'special';
        else if (/category\s*===\s*["']Physical["']/.test(src)) when = 'physical';
        else if (/sound/i.test(src)) when = 'sound';
        else if (/contact/.test(src)) when = 'contact';
      }
      return { damageMult: mult, onlyWhen: when };
    } },
  { tag: 'boostsMoveClass', param: 'x1.2-1.5 on moves carrying ONE FLAG', probe: 'boostsMoveClass',
    why: 'Tough Claws (contact, 272 uses), Sharpness (slicing, 155), Iron Fist (punch), Mega '
       + 'Launcher (pulse), Strong Jaw (bite). The join partner of moveClass -- the ability names '
       + 'the flag, the move carries it, and no per-ability case is needed',
    of: a => {
      const src = String(a.onBasePower || '') + String(a.onModifyAtk || '') + String(a.onModifySpA || '');
      if (!src) return null;
      for (const f of ['punch', 'bite', 'slicing', 'pulse', 'sound', 'bullet', 'wind', 'contact']) {
        /* Showdown writes move.flags["slicing"] with DOUBLE quotes -- checking only the dot and
         * single-quote forms matched nothing, which the empty-tag check above caught immediately. */
        if (src.includes(`flags.${f}`) || src.includes(`flags['${f}']`)
            || src.includes(`flags["${f}"]`))
          /* HOW MUCH, not just which flag. {boostsFlag:'contact'} without the x1.3 was the
           * boolean defect in miniature -- nothing could consume it. The handler states the
           * number in exact 4096ths and multiplierIn now reads that form. */
          return { boostsFlag: f, mult: multiplierIn(src) };
      }
      return null;
    } },
  /* The counterpart of powerFromFallen on the ability side — see that tag for Will's ruling on the
   * two freshness rules. perFallen is derived from the handler's own powMod table (4506/4096 - 1),
   * the cap from its Math.min, and countedAt says the number FREEZES at switch-in. */
  { tag: 'boostsFromFallen', param: 'x(1 + per x fallen) damage, fallen SNAPSHOT at switch-in', probe: 'supremeoverlord',
    why: 'Supreme Overlord, 64 uses (most Kingambit run Defiant, per Will). Small today; the death '
       + 'counter it shares with Last Respects is the part that had to exist',
    of: a => {
      const st = String(a.onStart || '');
      if (!/totalFainted/.test(st)) return null;
      const pm = String(a.onBasePower || '').match(/\[\s*(\d+)\s*,\s*(\d+)/);
      const cap = st.match(/Math\.min\([^,]*,\s*(\d+)\s*\)/);
      if (!pm) return null;
      return { perFallen: +(((+pm[2]) / (+pm[1])) - 1).toFixed(2),
               max: cap ? +cap[1] : 5, countedAt: 'switch-in' };
    } },
  { tag: 'damageBoost', param: 'x>1 damage dealt', probe: 'technician',
    why: 'Adaptability, Technician, Tinted Lens, Sheer Force, Iron Fist, Strong Jaw',
    of: a => {
      const src = String(a.onBasePower || '') + String(a.onModifyAtk || '') + String(a.onModifySpA || '');
      if (!src) return null;
      const w = weatherIn(src);
      /* Will: "solar power takes damage in the sun i think too." It does -- 1/8 max HP every turn
       * the sun is up, in onWeather. The boost was recorded and the COST was not, so the ability
       * read as free. A conditional buff with a per-turn price is a different decision from a
       * conditional buff. */
      const wx = String(a.onWeather || '');
      const chip = /this\.damage/.test(wx) ? (wx.match(/baseMaxhp\s*\/\s*(\d+)/) || [])[1] : null;
      /* Will, on Fire Mane: the boost is type-gated and the tag never said which type -- so Fire
       * Mane and Huge Power carried the same shape while one applies to a single type and the
       * other to everything. Same defect as Swift Swim not naming rain. */
      const ty = (src.match(/move\.type\s*===?\s*"(\w+)"/) || [])[1] || null;
      /* WIRE 157 -- RECKLESS'S CONDITION IS ABOUT THE MOVE, NOT ABOUT THE BODY, AND `onlyWhen` COULD
       * ONLY EVER SAY THINGS ABOUT THE BODY.
       *
       * `hpGateIn` reads `attacker.hp <= attacker.maxhp/3` and gives Blaze/Torrent/Overgrow/Swarm a
       * `{cond:'hpFraction'}` the consumer can evaluate. Reckless's handler is
       * `if (move.recoil || move.hasCrashDamage)` -- a property of the CLICK -- so it fell out with
       * `onlyWhen: null`, meaning "unconditional", and the consumer refused it for a different reason
       * (no `onType`) rather than applying a permanent 1.2x. Two wrongs; the second is what kept the
       * first invisible.
       *
       * IT IS EMITTED IN `condHolds`'s OWN `moveFlag` SHAPE -- the one medicham2 already evaluates
       * for `buffsHolderOnHit.when` -- so no new evaluator is needed and the two tags cannot drift
       * apart on what a condition looks like. `recoil` and `crashOnMiss` are both real move tags in
       * this artifact (`data/tags.json`), which is what makes the shape READABLE rather than a
       * plausible-looking string.
       *
       * MEMBERSHIP PRINTED BEFORE IT WAS WIRED, over every non-Past ability the format defines:
       *     onBasePower testing move.recoil or move.hasCrashDamage [1]: Reckless
       * ONE. Carriers in Reg M-B: Staraptor, Rhyperior, Emboar. */
      const rec = /move\.recoil/.test(src), crash = /hasCrashDamage/.test(src);
      const flags = [rec ? 'recoil' : null, crash ? 'crashOnMiss' : null].filter(Boolean);
      return { mult: multiplierIn(src), onType: ty, inWeather: w.length ? w : null,
               onlyWhen: flags.length ? { cond: 'moveFlag', is: flags } : hpGateIn(src),
               /* WHERE the multiplier is spent, because the family is split across two stages and the
                * consumer has to know which chain to fold into: Reckless/Analytic/Sand Force are
                * `onBasePower`, Steelworker/Transistor/Hustle/Gorilla Tactics are `onModifyAtk`. The
                * two are NOT interchangeable -- `runEvent('BasePower')` folds every member into one
                * relay and truncates once, above the formula, while a stat multiplier truncates
                * inside it. Read off whichever handler actually carried the multiplier, so the engine
                * holds no second copy of that split. */
               stage: a.onBasePower ? 'basePower'
                    : (a.onModifyAtk || a.onModifySpA) ? 'attackStat' : null,
               costsPerTurn: chip ? '1/' + chip + ' max HP' : null };
    } },
  { tag: 'blocksMove', param: 'WHICH class of move fails', probe: 'onFoeTryMove',
    why: 'already derived for allySideBlockProb -- Dazzling, Armor Tail, Good as Gold. Will\'s third '
       + 'switch-in threat: "farigaraf blocking prio" — a Sucker Punch plan dies to the pivot',
    of: a => {
      const src = String(a.onFoeTryMove || a.onTryHit || '');
      if (!a.onFoeTryMove && !(a.onTryHit && /category\s*===\s*"Status"/.test(src))) return null;
      const pr = src.match(/move\.priority\s*>\s*([\d.]+)/);
      if (pr) return { what: 'priority', priorityAbove: Math.floor(+pr[1]) };
      if (/category\s*===\s*"Status"/.test(src)) return { what: 'status moves at the holder' };
      return { what: 'unknown -- unrecognised handler idiom', via: a.onFoeTryMove ? 'onFoeTryMove' : 'onTryHit' };
    } },
  /* TIGHTENED 2026-08-05 (STAGED), found by tests/test-rollout-effects.js the day the tag gained a
   * consumer. `a.onChangeBoost ? {inverts:true}` matched THREE abilities and only one inverts:
   * Contrary's handler is `boost[i] *= -1`, SIMPLE's is `boost[i] *= 2` (it DOUBLES), and RIPEN's
   * doubles only boosts from a BERRY (`effect.isBerry`). The over-match sat harmless in the artifact
   * for as long as the tag was DEAD; the moment WIRE 100b read it by shape, a Simple target took
   * Intimidate as +1 where the official engine says -2 (verified by real battle at the pinned
   * commit). LESSONS §4: the extras are always plausible. The sign is now read out of the handler;
   * Simple gets its own tag with the multiplier; Ripen's berry-gated version carries neither. */
  { tag: 'invertsBoosts', param: 'stat changes flip sign', probe: 'onChangeBoost',
    why: 'Contrary alone. Simple DOUBLES and is amplifiesBoosts; Ripen doubles only berry boosts and is neither',
    of: a => (a.onChangeBoost && /\*=\s*-1/.test(String(a.onChangeBoost))) ? { inverts: true } : null },
  { tag: 'amplifiesBoosts', param: 'stat changes are multiplied (Simple x2)', probe: 'onChangeBoost',
    why: 'Simple, split out of invertsBoosts -- an inverted drop and a doubled drop point in opposite '
       + 'directions on the same click',
    of: a => {
      const src = String(a.onChangeBoost || '');
      if (!src || /isBerry/.test(src)) return null;          /* Ripen: berry boosts only, out of scope */
      const m = src.match(/\*=\s*(\d+)/);
      return m && +m[1] > 1 ? { mult: +m[1] } : null;
    } },
  /* Will, 2026-07-29: "why would you give me the prankster +1 presented like that... even that
   * category is unneeded right? just have a prankster ability tag influence all category status."
   *
   * He was reading a list where Prankster sat next to Scrappy, Infiltrator, Skill Link and Long
   * Reach -- none of which touch turn order. The cause was `|| a.onModifyMove`, a catch-all for any
   * ability that rewrites a move at all.
   *
   * The subtler half: Scrappy, Stalwart and Stance Change DO have `onModifyMovePriority`, and that
   * is not move priority. It is Showdown's internal sort key for which handler runs first inside a
   * single event. Same shape as selfBoost, Poltergeist's target.item and Super Fang's basePower 0 --
   * a field that exists, reads cleanly, and means something other than its name suggests.
   *
   * So this now reads onModifyPriority alone, and carries WHICH class of move moves and BY HOW
   * MUCH, which is the form the turn-order calculation can actually consume. */
  { tag: 'priorityMod', param: 'moves of one class shift by N in the turn order', probe: 'onModifyPriority',
    why: 'Prankster (4,692) gives every Status move +1, which decides who moves first on the turn '
       + 'a Tailwind or a Fake Out lands. Gale Wings needs FULL HP, so it is a condition, not a constant',
    of: a => {
      if (!a.onModifyPriority) return null;
      const src = String(a.onModifyPriority);
      const shift = (src.match(/priority\s*([+-])\s*(\d+)/) || [])
        .slice(1).reduce((_, __, i, m) => (m[0] === '-' ? -1 : 1) * +m[1], null);
      const cls = /category\s*===?\s*"Status"/.test(src) ? 'status'
                : /type\s*===?\s*"Flying"/.test(src) ? 'flying'
                : /flags\.heal|move\.flags\["heal"\]/.test(src) ? 'healing'
                : 'all';
      const cond = /hp\s*===?\s*[\w.]*maxhp/.test(src) ? 'only at full HP' : null;
      return { movesOfClass: cls, shift, condition: cond };
    } },
  /* SURFACED BY THE REPAIRED UNTAGGED GUARD. Once the entity table stopped holding only tagged
   * things, six real mechanics fell out immediately -- all of them above Will's 0.5% floor and all
   * of them invisible for as long as the check had been passing. */
  { tag: 'poisonsOnMyContact', param: 'MY contact moves carry a chance to poison', probe: 'onSourceDamagingHit',
    why: 'Poison Touch. The mirror image of punishesAttacker -- this fires when the holder ATTACKS, '
       + 'so it is a reason to pick a contact move rather than a reason to avoid one',
    of: a => a.onSourceDamagingHit ? { p: 0.3, needsContact: true } : null },
  { tag: 'boostsEachTurn', param: 'a stat rises every turn it stays in, with no action spent', probe: 'boostsEachTurn',
    why: 'Speed Boost. Compounds silently -- it outruns things it could not outrun two turns ago, '
       + 'and nothing recomputes the speed order for a boost nobody clicked',
    /* WHICH STAT, OR NOTHING. `{perTurn:true}` is true of Speed Boost, Moody and Opportunist and they
     * are three different mechanics: Speed Boost is a flat `boost({spe:1})`, Moody picks a RANDOM stat
     * up two and another down one, and Opportunist COPIES whatever the foe just gained. A consumer
     * reading only `perTurn` would have handed all three a Speed boost -- 453 corpus uses of an
     * ability that does not raise Speed. Only a literal boost object is emitted; the other two carry
     * the tag with no boosts and stay visibly unwired. */
    of: a => {
      if (!(a.onResidual && /boost/i.test(String(a.onResidual)))) return null;
      const p = { perTurn: true };
      const h = String(a.onResidual);
      /* A LITERAL object only. Moody builds `boost` from `this.sample(stats)` and Opportunist passes
       * `this.effectState.boosts`; neither matches, which is the point. */
      const bo = h.match(/this\.boost\(\s*\{([^}]*)\}/);
      if (bo) {
        const b = {};
        for (const kv of bo[1].split(',')) {
          const mm = kv.match(/([a-z]+)\s*:\s*(-?\d+)/); if (mm) b[mm[1]] = +mm[2];
        }
        if (Object.keys(b).length) p.boosts = b;
      }
      return p;
    } },
  { tag: 'blocksExplosion', param: 'self-destructing moves simply fail while it is on the field', probe: 'onAnyTryMove',
    why: 'Damp. It reaches across the whole field, not just its own side, so it invalidates an '
       + 'opposing Explosion the bot would otherwise score as a big hit',
    of: a => a.onAnyTryMove ? { blocksSelfDestruct: true } : null },
  { tag: 'noRecoil', param: 'recoil damage is zero', probe: 'noRecoil',
    why: 'Rock Head. Turns the recoil tag from a cost into nothing, so a Head Smash carrier is '
       + 'priced wrongly in both directions if only one of the two tags is read',
    of: a => (a.onDamage && /recoil/i.test(String(a.onDamage))) ? { recoil: 0 } : null },
  /* Will: "shadow tag is like trapping and infestation." Same mechanic -- the target cannot switch
   * -- arriving from an ability (Shadow Tag, 446 fields) and from a move (Infestation, Whirlpool).
   * They differ in duration and in whether they also chip, so those are the parameters rather than
   * a reason for separate tags. The consequence is identical and it is large: a trapped Pokemon has
   * its switch option DELETED, which changes the opponent's whole action set. */
  { tag: 'preventsSwitch', param: 'the target cannot switch out -- its escape option is deleted', probe: 'onFoeTrapPokemon',
    why: 'Shadow Tag reaches 446 fields and is on ZERO sheets. Nothing prunes switching from the '
       + 'opponent action set, so every reply distribution still contains a move that cannot be made',
    /* ENRICHED 2026-08-05 (STAGED): the per-carrier CONDITIONS were prose in `scope` and the
     * consumer (WIRE 92) needs them as facts -- Magnet Pull holds only Steel types
     * (hasType("Steel") in the handler) and Arena Trap only grounded bodies (isGrounded()).
     * Without them the consumer traps everything non-Ghost, stated at its site; with them it
     * fails closed per carrier. */
    of: a => {
      if (!a.onFoeTrapPokemon) return null;
      const src = String(a.onFoeTrapPokemon) + String(a.onFoeMaybeTrapPokemon || '');
      const typeM = src.match(/hasType\(\s*["'](\w+)["']/);
      return { source: 'ability', turns: null, chips: false,
               scope: /adjacent/i.test(src) ? 'adjacent foes' : 'all foes',
               onlyTypes: typeM ? [typeM[1]] : null,
               onlyGrounded: /isGrounded\(\)/.test(src) || null };
    } },
  { tag: 'onSwitchInDrop', param: 'stat stages on the foe at switch-in', probe: 'intimidate',
    why: 'Intimidate. Beaten by Clear Amulet and by White Herb, neither of which is checked',
    /* ENRICHED AND TIGHTENED 2026-08-05 (STAGED). Two defects at once: {drop:true} named neither
     * stat nor size (the boolean defect), and the membership included DOWNLOAD -- whose onStart
     * READS the foes' defences and boosts ITSELF, the exact plausible-extra LESSONS §4 warns about.
     * The table is read out of the handler's own this.boost({atk: -1}, ...); a handler whose boost
     * call carries no NEGATIVE literal table (Download's is computed, and aimed at self) drops out
     * of the tag. The consumer (applyEntryDrops, WIRE 100a) prefers these params and falls back to
     * the typed Intimidate row only until this regeneration lands. */
    of: a => {
      const src = String(a.onStart || '');
      if (!src || !/boost/i.test(src) || !/foe|adjacentFoes|activePokemon/.test(src)) return null;
      const bm = src.match(/\.boost\(\s*\{([^}]*)\}/);
      const boosts = {};
      if (bm) for (const kv of bm[1].split(',')) {
        const p = kv.split(':').map(s => s.trim().replace(/["']/g, ''));
        if (p.length === 2 && !isNaN(+p[1])) boosts[p[0]] = +p[1];
      }
      const drops = Object.fromEntries(Object.entries(boosts).filter(([, v]) => v < 0));
      if (!Object.keys(drops).length) return null;    /* Download: computed self-boost, no literal drop */
      /* WIRE 157 -- ONCE PER BATTLE IS NOT THE SAME AS ONCE PER ENTRY, AND THE TAG COULD NOT SAY SO.
       *
       * Intimidate drops again every time it walks in. Supersweet Syrup does NOT: its handler opens
       * `if (pokemon.syrupTriggered) return; pokemon.syrupTriggered = true;` and `syrupTriggered` is
       * set on the Pokemon in the CONSTRUCTOR (sim/pokemon.ts:263) and is NOT reset by
       * `clearVolatile()` -- checked line by line, because "it survives a switch" is the whole claim.
       * Measured before this landed: carrier leads (-1), leaves, returns -> ours -2, Showdown -1.
       *
       * MEMBERSHIP OF THE GUARD SHAPE, printed over every non-Past ability in the format:
       *     Dauntless Shield, Intrepid Sword, Supersweet Syrup
       * All three are genuinely once-per-battle. Only the third carries `onSwitchInDrop` (the other
       * two boost THEMSELVES and reach a different tag), so this field lands on one entry -- which is
       * why it is a param here and not a tag of its own. The flag NAME is read out of the handler so
       * a fourth member arrives with its own bookkeeping key rather than sharing Syrup's. */
      const g = src.replace(/\s+/g, ' ')
        .match(/if\s*\(\s*\w+\.(\w+)\s*\)\s*return\s*;\s*\w+\.\1\s*=\s*true/);
      return { drop: true, boosts: drops, oncePerBattle: g ? g[1] : null };
    } },
  /* WIRE 157 -- AN ENTRY ABILITY THAT REACHES THE BODY BESIDE IT, WHICH `onSwitchInDrop` ABOVE
   * STRUCTURALLY CANNOT EXPRESS: that tag reads a handler aimed at `foe`/`adjacentFoes`, and this one
   * walks `adjacentAllies()`. Curious Medicine wipes its PARTNER's stat stages on entry -- both
   * directions, so it undoes a Swords Dance as readily as an Intimidate -- and carried `untagged`.
   *
   * MEMBERSHIP PRINTED BEFORE IT WAS WIRED, over every non-Past ability the format defines:
   *     onStart walking adjacentAllies() [2]: Curious Medicine, Hospitality
   *     ... of which clearBoosts()       [1]: Curious Medicine
   * Hospitality HEALS the ally and is a different consumer entirely; matching on `adjacentAllies`
   * alone would have swept it in, which is why the EFFECT is half the predicate. One member, and the
   * ability has three corpus uses -- it is wired because the roster asked the authority and the
   * authority moved a board this engine left still. */
  { tag: 'clearsAllyBoostsOnEntry', param: 'the ALLY beside the arriving body has every stat stage reset to 0', probe: 'clearsAllyBoostsOnEntry',
    why: 'Curious Medicine (Slowking-Galar). The roster staged it and Showdown restored the ally to '
       + '0/0 where this engine left it at -1/-1',
    of: a => {
      const src = String(a.onStart || '').replace(/\s+/g, ' ');
      if (!/adjacentAllies\(\)/.test(src) || !/clearBoosts\(\)/.test(src)) return null;
      return { clears: 'all stages', scope: 'adjacent allies' };
    } },
  { tag: 'formeChange', param: 'the species changes mid-battle', probe: 'megaFormeOf',
    why: 'Zero to Hero (needs a switch), Illusion, Imposter, Disguise',
    of: a => /zerotohero|illusion|imposter|disguise|schooling|shieldsdown|powerconstruct/.test(norm(a.name)) ? { changes: true } : null },
  /* NEW 2026-08-08 -- THE TRANSFORM, AND IT IS NOT THE SAME MECHANIC AS `formeChange`.
   *
   * `formeChange` above says "the species changes"; every member of it becomes a KNOWN forme with a
   * row in data/engine-data.js (Palafin-Hero, Mimikyu-Busted, a mega). Imposter becomes an ARBITRARY
   * OPPOSING BODY, so there is no row to look up -- the new body has to be copied off the thing it
   * faced. That is a different consumer and it needs its own tag; a Zero to Hero handler and an
   * Imposter handler share a word and nothing else.
   *
   * WHICH BODY IT COPIES IS READ OUT OF THE HANDLER and not assumed to be "the one opposite":
   *     pokemon.side.foe.active[pokemon.side.foe.active.length - 1 - pokemon.position]
   * In doubles that is the DIAGONAL slot -- a Ditto in slot 0 becomes the foe's slot 1 -- which is the
   * negative the consumer's staged scenario turns on and which nobody would guess.
   *
   * MEMBERSHIP WAS PRINTED BEFORE THIS WAS WIRED, per docs/LESSONS.md §4: over the whole format
   * exactly ONE ability declares `transformInto` (Imposter, 80 uses) and exactly ONE move does
   * (Transform, 84 uses). The move is deliberately NOT given this tag -- it copies the body it was
   * AIMED at rather than a fixed slot, which is a different rule with a different negative. */
  { tag: 'transformsOnEntry', param: 'the body BECOMES the one it faces, on entry', probe: 'transformsOnEntry',
    why: 'Imposter, 80 uses, and every Ditto that matters runs it. data/tags.json already declared '
       + 'RAW-STORE-OK about the ABILITY being known; the TRANSFORM had no tag and no consumer, so '
       + 'a Ditto stood there as a 61-Attack Ditto in every rollout',
    of: a => {
      const src = String(a.onSwitchIn || '') + String(a.onStart || '');
      if (!/transformInto\s*\(/.test(src)) return null;
      /* the SLOT arithmetic, matched on the handler's own expression */
      const diagonal = /\.length\s*-\s*1\s*-\s*\w+\.position/.test(src);
      return { copies: 'facing body', diagonal, copiesHP: false,
               copiesItem: false, copiesBoosts: true, movePP: 5 };
    } },
  { tag: 'statusImmune', param: 'a status cannot land', probe: 'statusImmune',
    why: 'Limber, Immunity, Insomnia, Vital Spirit, Water Veil, Magma Armor. onSetStatus only -- '
       + 'onImmunity also means weather-chip immunity and was over-capturing',
    of: a => a.onSetStatus ? { immune: true } : null },
  /* NEW 2026-08-05 (STAGED) -- the CONDITIONAL DEFENSIVE STAT MULTIPLIER, which is the census's
   * Marvel Scale row: an onModifyDef/onModifySpD gated on `pokemon.status`. The census called this
   * "blocked on the derivation -- no derivation describes a conditional stat multiplier", and the
   * Air Lock / Mummy / WIRE 83 corrections all said that claim should be re-tested: the handler is
   * two lines and states both the condition and the chainModify. DEFENSIVE stats only, on purpose --
   * the offensive twin of this shape is GUTS, which is already consumed by name in dmgRange and
   * carries `damageBoost`; deriving it here too would double-apply the 1.5. Consumer: WIRE 112. */
  { tag: 'condStatMult', param: 'a DEFENSIVE stat x N while a body condition holds', probe: 'onModifyDef',
    why: 'Marvel Scale (36 uses): Defense x1.5 while statused. The census carried it as MISSING with '
       + '"no artifact describes it" -- this is the artifact describing it',
    of: a => {
      for (const [h, stat] of [['onModifyDef', 'def'], ['onModifySpD', 'spd']]) {
        const src = String(a[h] || '');
        if (!src) continue;
        if (!/if\s*\(\s*\w+\.status\s*\)/.test(src)) continue;
        const mult = multiplierIn(src);
        if (mult > 1) return { stat, mult, when: 'statused' };
      }
      return null;
    } },
  /* Will: "and things like sand veil and bright powder". accuracyMod existed for moves and items and
   * NOT for abilities, which is where the conditional ones live. A third mechanism feeding the same
   * P(hit): stages use one table, items are flat multipliers, and these are flat multipliers GATED
   * ON A CONDITION -- Sand Veil only in sand, Snow Cloak only in snow, Hustle only on physical. */
  { tag: 'accuracyMod', param: 'P(hit) scaled, often gated on a weather or a category', probe: 'onModifyAccuracy',
    why: 'Sand Veil (135 uses, x1.25 evasion in sand), Snow Cloak (219, in snow), Compound Eyes, '
       + 'Victory Star, Hustle, Wonder Skin, No Guard. Same P(hit) the kill distribution needs',
    of: a => (a.onModifyAccuracy || a.onSourceModifyAccuracy || a.onAccuracy || a.onSourceAccuracy)
             ? { accuracy: true } : null },
  /* IT OVER-MATCHED, AND PRINTING THE MEMBERSHIP IS WHAT CAUGHT IT (LESSONS §4, again).
   *
   * `onImmunity` is Showdown's ONE hook for "this body ignores a named source of harm", and the name
   * is the whole fact. Excluding the type names left every OTHER thing that hook can refuse:
   *
   *     OLD matched 8 : icebody magmaarmor oblivious overcoat sandforce sandrush sandveil snowcloak
   *     NEW matched 6 : icebody overcoat sandforce sandrush sandveil snowcloak
   *
   * Magma Armor's handler is `if (type === 'frz')` and Oblivious's is `if (type === 'attract')`.
   * Neither has anything to do with the weather, and wiring the tag as it stood would have handed a
   * sandstorm immunity to a Pokemon that takes the chip. Magma Armor is left with NO tag, which is
   * honest: its real mechanic is freeze immunity through onImmunity rather than onSetStatus, so the
   * statusImmune derivation next door does not describe it either.
   *
   * THE WEATHERS ARE READ OUT OF THE HANDLER, not assumed. Overcoat refuses sandstorm AND hail; Sand
   * Veil refuses only sandstorm; Ice Body only hail. `hail` is translated to this engine's `snow`
   * here, at the derivation, so the consumer never sees a second vocabulary. */
  { tag: 'weatherChipImmune', param: 'takes no residual damage from the named weathers', probe: 'onImmunity',
    why: 'Sand Veil, Sand Rush, Sand Force, Overcoat (sandstorm); Ice Body, Snow Cloak, Overcoat '
       + '(hail). The sandstorm residual is 1/16 a turn and this engine did not have it at all',
    of: a => {
      if (!a.onImmunity) return null;
      const src = String(a.onImmunity);
      const wx = [];
      if (/['"]sandstorm['"]/.test(src)) wx.push('sand');
      if (/['"]hail['"]/.test(src)) wx.push('snow');
      return wx.length ? { chipImmune: true, weathers: wx } : null;
    } },
  /* WIRE 157 -- THE WEATHER RESIDUAL IS A HP EVENT IN BOTH DIRECTIONS, AND THIS ENGINE HELD ONLY THE
   * IMMUNITY TO ONE OF THEM.
   *
   * `weatherChipImmune` directly above says a body takes NO sand damage. It cannot say that a body
   * GAINS HP, and `onWeather` is the one hook that does both. Ice Body read LIVE off the immunity
   * tag while its actual mechanic -- heal 1/16 every turn it snows -- reached no code at all
   * (roster: Showdown 71 -> 81 -> 91 -> 101, ours 71 flat).
   *
   * MEMBERSHIP PRINTED BEFORE IT WAS WIRED, over every non-Past ability the format defines:
   *     onWeather [4]: Dry Skin, Ice Body, Rain Dish, Solar Power
   * FOUR, and BOTH DIRECTIONS ARE DERIVED ON PURPOSE rather than just the heal the roster asked for.
   * Dry Skin heals 1/8 in rain AND takes 1/8 in sun out of the same handler; Solar Power only takes.
   * A tag that carried heals alone would have made Dry Skin strictly better than the real ability on
   * every sun board -- a one-directional error, which is the class this project keeps being caught
   * by, and it would have been introduced by fixing Ice Body.
   *
   * THE WEATHERS ARE TRANSLATED HERE, at the derivation, exactly as `weatherChipImmune` translates
   * `hail` to `snow`, so the consumer never sees Showdown's vocabulary. `primordialsea` and
   * `desolateland` map onto the same two skies; neither is reachable in this format (no carrier), and
   * they are folded in rather than dropped because the handler names them and a de-duplicated list is
   * what the consumer wants.
   *
   * THE DENOMINATOR IS READ OUT OF THE HANDLER (`baseMaxhp / 16`, `baseMaxhp / 8`), never typed. */
  { tag: 'weatherResidualHP', param: 'HP gained or lost every turn a named weather is up, and WHICH way', probe: 'weatherResidualHP',
    why: 'Ice Body heals 1/16 in snow and did nothing. Rain Dish and Dry Skin heal 1/16 and 1/8 in '
       + 'rain; Dry Skin and Solar Power pay 1/8 in sun. None of it existed',
    of: a => {
      const src = String(a.onWeather || '').replace(/\s+/g, ' ');
      if (!src) return null;
      const SKY = { raindance: 'rain', primordialsea: 'rain', sunnyday: 'sun', desolateland: 'sun',
                    sandstorm: 'sand', hail: 'snow', snowscape: 'snow' };
      /* The handler is a chain of `if (effect.id === ...) { this.heal|damage(...) }` blocks, so each
       * branch is cut at its own brace and read on its own. Reading the whole string at once would
       * give Dry Skin a heal in the sun. */
      const heals = {}, hurts = {};
      for (const m of src.matchAll(/(?:if|else if)\s*\(([^{]*?)\)\s*\{([^{}]*)\}/g)) {
        const skies = [...new Set([...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => SKY[x[1]]).filter(Boolean))];
        if (!skies.length) continue;
        const heal = m[2].match(/this\.heal\([^)]*baseMaxhp\s*\/\s*(\d+)/);
        const hurt = m[2].match(/this\.damage\([^)]*baseMaxhp\s*\/\s*(\d+)/);
        for (const s of skies) { if (heal) heals[s] = +heal[1]; if (hurt) hurts[s] = +hurt[1]; }
      }
      if (!Object.keys(heals).length && !Object.keys(hurts).length) return null;
      return { heals: Object.keys(heals).length ? heals : null,
               hurts: Object.keys(hurts).length ? hurts : null,
               /* `target.effectiveWeather() !== effect.id` is the Cloud Nine / Air Lock guard three of
                * the four carry. It is the same fact `field.wSup` already answers at the consumer, so
                * it travels as a flag rather than as a second implementation. */
               needsEffectiveWeather: /effectiveWeather\(\)\s*!==?/.test(src) || null };
    } },
];

/* ---- BUILD ----------------------------------------------------------------------------------- */
const U = usage();
/* Abilities that only ever appear AFTER a mega evolves have zero sheet usage, so the usage gate
 * excluded them, so nothing tagged them, so they were invisible in a document about which abilities
 * matter. Fairy Aura is on 1,455 fields and was not in this file at all. This admits anything a
 * stone on a real sheet can turn into. */
const REACHABLE = new Set();
try {
  for (const g of (F_GAMES || [])) for (const side of ['p1', 'p2'])
    for (const e of (g.sheets && g.sheets[side]) || []) {
      const it = dex.items.get(norm(e.item || ''));
      if (!it || !it.megaStone) continue;
      const base = dex.species.get(norm(e.species));
      const mega = dex.species.get(it.megaStone[base.baseSpecies] || Object.values(it.megaStone)[0]);
      if (mega && mega.abilities) for (const ab of Object.values(mega.abilities)) REACHABLE.add(norm(ab));
    }
} catch (e) { /* corpus unavailable -- fall back to usage-only, same as before */ }

function collect(kind, all, tags, usageMap) {
  const entries = {}, index = {};
  for (const t of tags) index[t.tag] = { tag: t.tag, kind, param: t.param, why: t.why,
    consumedBy: readsIt(t.probe) ? t.probe : null, used: readsIt(t.probe), n: 0, uses: 0, examples: [] };
  for (const o of all) {
    if (!o || !o.exists || o.isNonstandard) continue;
    const id = norm(o.id || o.name);
    const hit = [], params = {};
    for (const t of tags) {
      let v = null; try { v = t.of(o); } catch (e) { v = null; }
      if (!v) continue;
      hit.push(t.tag); params[t.tag] = v;
      const ix = index[t.tag];
      ix.n++; ix.uses += (usageMap[id] || 0);
      if (ix.examples.length < 6 && (usageMap[id] || 0) > 0) ix.examples.push(o.name);
    }
    /* ANYTHING TAGGED, PLUS ANYTHING ACTUALLY PLAYED. The second half is what makes the untagged
     * check mean something: it previously stored only entities with at least one tag, so the guard
     * that looks for untagged members iterated a set which by construction contained none. It ran
     * clean on every build and could not have failed. That is the exact shape of bug this file was
     * written to catch, sitting inside the guard written for Will's placeholder rule. */
    if (hit.length || (usageMap[id] || 0) > 0 || REACHABLE.has(id))
      entries[id] = { name: o.name, tags: hit, uses: usageMap[id] || 0, params };
  }
  return { entries, index };
}

const moves = collect('move', dex.moves.all(), MOVE_TAGS, U.move);
const items = collect('item', dex.items.all(), ITEM_TAGS, U.item);
const abils = collect('ability', dex.abilities.all(), ABILITY_TAGS, U.ability);

/* ---- LINKAGE ---------------------------------------------------------------------------------
 * Will, 2026-07-29: "i want to tie as many of these tags as possible to the move tags like the
 * unburden and acrobatics... rough skin and rocky helmet... spiky shield... is linkage a good idea"
 *
 * It is the best structural idea in this review, and the evidence is that ONE mechanic -- punish a
 * contact attacker for a fraction of max HP -- had arrived under three different names from three
 * different taxonomies:
 *
 *     Rough Skin    ability   punishesAttacker + contactPunish
 *     Iron Barbs    ability   punishesAttacker + contactPunish
 *     Spiky Shield  move      punishesContact
 *     Rocky Helmet  item      (0 sheets in this format)
 *
 * and their damage fractions genuinely differ, 1/8 against 1/6, so the parameter is real. Three
 * names meant three separate wirings, three places to get it wrong, and no way for the engine to
 * ask the one question it actually needs to ask.
 *
 * THE MODEL. A move EXPOSES properties. Items and abilities SUBSCRIBE to them. The engine asks once
 * per (move, target) pair -- "this move makes contact; who reacts?" -- and everything subscribed
 * answers. One dispatch instead of a branch per mechanic, and the 90-odd unread tags become
 * wirable as a group rather than one at a time.
 *
 * The couplings are DERIVED by reading which move property each handler tests, so a new ability in
 * a future generation joins the right key without anyone editing a list.
 */
const KEYS = [
  { key: 'contact',      test: /checkMoveMakesContact|flags\.contact|flags\["contact"\]/,
    note: 'the move touches the target' },
  { key: 'sound',        test: /flags\.sound|flags\["sound"\]/,          note: 'sound-based' },
  { key: 'punch',        test: /flags\.punch|flags\["punch"\]/,          note: 'a punching move' },
  { key: 'bullet',       test: /flags\.bullet|flags\["bullet"\]/,        note: 'ballistic' },
  { key: 'powder',       test: /flags\.powder|flags\["powder"\]/,        note: 'a powder' },
  { key: 'wind',         test: /flags\.wind|flags\["wind"\]/,            note: 'wind-based' },
  { key: 'slicing',      test: /flags\.slicing|flags\["slicing"\]/,      note: 'a cutting move' },
  { key: 'bite',         test: /flags\.bite|flags\["bite"\]/,            note: 'a biting move' },
  { key: 'heal',         test: /flags\.heal|flags\["heal"\]/,            note: 'a healing move' },
  /* WIRE 117, STAGED -- `priorityMove` HAD THREE REACTORS AND SHOULD HAVE HAD SIX, and the two it was
   * missing on the MOVE side are why the interaction matrix has never once staged a
   * Psychic-Terrain-against-priority case. `reactorMoves` for this key is EMPTY in the shipped
   * artifact.
   *
   * The old test was `move.priority > 0`, which is the idiom Armor Tail, Dazzling and Queenly
   * Majesty happen to use. Showdown writes the SAME predicate the other way round far more often --
   * `if (move.priority <= 0.1) return;`, the early-bail guard whose complement is exactly "this is a
   * priority move" -- and it also reaches the field through `effect.priority` and `baseMove.priority`
   * rather than `move.priority`, because a terrain's condition is handed an `effect`.
   *
   * DERIVED FROM THE HANDLER'S SHAPE, NOT FROM NAMING A TERRAIN. Psychic Terrain is picked up because
   * its condition tests a move's priority, so a terrain added next regulation with the same shape
   * arrives without an edit here -- docs/TAGS.md invariant 3.
   *
   * MEMBERSHIP PRINTED BEFORE STAGING, against the format dex (LESSONS §4). The two idioms are
   * enumerated rather than a loose `[<>]=?` because a loose one would also match `priority < 0`,
   * which is a NEGATIVE-priority reactor and a different key:
   *
   *     was   ability armortail, dazzling, queenlymajesty
   *     is    ability armortail, dazzling, queenlymajesty   (unchanged -- no ability moves)
   *           move    psychicterrain   the terrain's onTryHit, `effect.priority <= 0.1`
   *           move    quickguard       blocks priority for the side, and was simply absent
   *           move    upperhand        fails unless the TARGET is about to use a priority move --
   *                                    a carrier AND a reactor, which this table already allows for
   *
   * STAGED, NOT REGENERATED: `data/tags.json` is untouched by this pass. It is a frozen release
   * source and an input to the feature vector, so regenerating it is the coordinator's single-writer
   * moment, not ENGINE's to take while a measurement is running. */
  { key: 'priorityMove', test: /(?:move|effect|baseMove)\.priority\s*(?:>\s*0(?:\.1)?|<=\s*0\.1)/,
    note: 'the move has positive priority' },
  { key: 'statusMove',   test: /category\s*===?\s*"Status"/,             note: 'a status-category move' },
  { key: 'physicalMove', test: /category\s*===?\s*"Physical"/,           note: 'a physical move' },
  { key: 'specialMove',  test: /category\s*===?\s*"Special"/,            note: 'a special move' },
  { key: 'emptyItemSlot',test: /!\s*\w+\.item|hasItem\(\)\s*===?\s*false/, note: 'the holder has NO item' },
  { key: 'targetBoosted',test: /statsRaisedThisTurn/,                     note: 'the target just set up' },
  { key: 'moveType',     test: /move\.type\s*===?\s*"/,                  note: 'one specific move type' },
];

/* Every handler an ability or item can react through. */
function handlerText(o) {
  let out = '';
  for (const k of Object.keys(o)) if (k.startsWith('on') && typeof o[k] === 'function') out += String(o[k]);
  return out;
}

/* PRIORITIES #44 -- CARRIERS AND REACTORS ARE DIFFERENT RELATIONS AND HAD ONE KEY. 2026-08-04.
 *
 * `reactorsTo('contact').moves` returned 152 moves that CARRY contact -- Fake Out, Close Combat,
 * Flare Blitz. Those are attackers. The moves that actually REACT to contact -- Baneful Bunker,
 * Spiky Shield, King's Shield -- were not in the index at all and were reachable only through their
 * own `punishesContact` tag. A consumer handed the wrong list looks exactly like a consumer that is
 * working, which is this project's signature failure, and it is now on the critical path because
 * tests/test-game-diff.js GENERATES its interaction cases from this index.
 *
 * The split is `carrierMoves` (the move has the property) versus `reactorMoves` (the move's own
 * handler tests for it), and the reactor side is derived by the SAME handler probe already used for
 * abilities and items rather than by a second rule -- so a move and an ability that react to contact
 * are found the same way. `moves` is deliberately GONE rather than left as an alias: an alias would
 * keep every existing misreading working silently, and there are no consumers of it (checked:
 * engine/tags.js and the medicham2 stub are the only readers, and neither uses the field). */
const linkage = {};
for (const K of KEYS) linkage[K.key] = { note: K.note, abilities: [], items: [], carrierMoves: [], reactorMoves: [] };
for (const [kind, tbl, dexAll] of [['abilities', abils.entries, dex.abilities.all()],
                                   ['items', items.entries, dex.items.all()]]) {
  for (const o of dexAll) {
    if (!o || !o.exists || o.isNonstandard) continue;
    const id = norm(o.id || o.name);
    if (!tbl[id]) continue;                       /* only things tagged or actually played */
    const src = handlerText(o);
    if (!src) continue;
    for (const K of KEYS) if (K.test.test(src))
      linkage[K.key][kind].push({ id, name: o.name, uses: tbl[id].uses || 0 });
  }
}
/* And the MOVE side: which moves actually carry each key, so a subscription has a population. */
for (const m of dex.moves.all()) {
  if (!m || !m.exists || m.isNonstandard) continue;
  const id = norm(m.id);
  const u = U.move[id] || 0;
  if (!u) continue;
  const f = m.flags || {};
  for (const K of KEYS) {
    let hit = false;
    if (['contact','sound','punch','bullet','powder','wind','slicing','bite','heal'].includes(K.key)) hit = !!f[K.key];
    else if (K.key === 'priorityMove') hit = m.priority > 0;
    else if (K.key === 'statusMove')   hit = m.category === 'Status';
    else if (K.key === 'physicalMove') hit = m.category === 'Physical';
    else if (K.key === 'specialMove')  hit = m.category === 'Special';
    if (hit) linkage[K.key].carrierMoves.push({ id, name: m.name, uses: u });
    /* THE REACTOR SIDE OF THE MOVE TABLE, by the same handler probe the abilities and items use.
     * Spiky Shield's condition tests checkMoveMakesContact; Quick Guard's tests move.priority. A move
     * can be both -- Beak Blast CARRIES nothing and REACTS to contact during its charge turn. */
    if (K.test.test(handlerText(m) + String((m.condition && handlerText(m.condition)) || '')))
      linkage[K.key].reactorMoves.push({ id, name: m.name, uses: u });
  }
}
for (const k in linkage) {
  for (const side of ['abilities','items','carrierMoves','reactorMoves'])
    linkage[k][side].sort((a,b) => b.uses - a.uses);
  linkage[k].moveUses    = linkage[k].carrierMoves.reduce((s,x) => s + x.uses, 0);
  linkage[k].reactorUses = [...linkage[k].abilities, ...linkage[k].items, ...linkage[k].reactorMoves]
    .reduce((s,x) => s + x.uses, 0);
}

console.log('');
console.log('LINKAGE -- move properties, and what subscribes to them:');
console.log('  key             moves carrying it      things that react');
for (const [k, v] of Object.entries(linkage).sort((a,b) => b[1].reactorUses - a[1].reactorUses)) {
  const r = v.abilities.length + v.items.length + v.reactorMoves.length;
  if (!r) continue;
  console.log('  ' + k.padEnd(15) + String(v.carrierMoves.length).padStart(4) + ' moves / ' +
    String(v.moveUses).padStart(6) + ' uses   ' + String(r).padStart(3) + ' reactors / ' +
    String(v.reactorUses).padStart(6) + ' sheets');
}

const all = [...Object.values(moves.index), ...Object.values(items.index), ...Object.values(abils.index)];
const totalUses = { move: Object.values(U.move).reduce((a, b) => a + b, 0),
                    item: Object.values(U.item).reduce((a, b) => a + b, 0),
                    ability: Object.values(U.ability).reduce((a, b) => a + b, 0) };

console.log('TAGGING PASS — what each mechanic SETS, and whether anything reads it\n');
console.log(`  ${U.entries.toLocaleString()} sheet entries of real teams for the usage weighting\n`);

for (const kind of ['move', 'item', 'ability']) {
  const rows = all.filter(r => r.kind === kind)
    .sort((a, b) => (b.used === a.used ? b.uses - a.uses : (a.used ? 1 : -1)));
  console.log(`  ${kind.toUpperCase()}S`);
  console.log('  tag                  entries   usage share   read?');
  console.log('  ' + '-'.repeat(74));
  for (const r of rows) {
    const share = totalUses[kind] ? (100 * r.uses / totalUses[kind]) : 0;
    console.log('  ' + r.tag.padEnd(20) + String(r.n).padStart(6) + '   ' +
      (share.toFixed(1) + '%').padStart(10) + '   ' + (r.used ? 'yes' : '** NOT READ **'));
  }
  console.log('');
}

const unread = all.filter(r => !r.used).sort((a, b) => b.uses - a.uses);
/* NO HARDCODES is the rule (S13). Where a tag still identifies its members by NAME rather than by a
 * dex field or a handler probe, that is technical debt and it should be COUNTED rather than quietly
 * left in a regex. Some are irreducible -- Trick Room is one move and there is no field that says
 * "reverses speed" -- but they must be visible. */
const src = fs.readFileSync(__filename, 'utf8');
const selfSrc = fs.readFileSync(__filename, 'utf8');
const nameHits = (selfSrc.match(/\.test\(norm\((?:m|it|a)\.(?:id|name)\)\)/g) || []).length;
console.log(`  ${nameHits} tag definitions still identify members BY NAME (a regex over the id) rather`);
console.log('  than by a dex field or a handler probe. Some are irreducible -- Trick Room is one move');
console.log('  and no field says "reverses speed" -- but they are counted rather than hidden.');
console.log('');
console.log(`  ${unread.length} of ${all.length} tags are NOT read by board.js or the damage engine.`);
console.log('  (read? is a GREP for the probe string, so it can be wrong in both directions -- a shared');
console.log('   probe reads as used when it is not, and a mechanic handled under another name reads as');
console.log('   unused. Treat it as a shortlist to verify, not a verdict.)');
console.log('  Ordered by how often the tagged thing actually appears on a real team:');
for (const r of unread.slice(0, 12)) {
  const share = totalUses[r.kind] ? (100 * r.uses / totalUses[r.kind]) : 0;
  console.log(`    ${r.tag.padEnd(20)} ${share.toFixed(1).padStart(5)}%  ${r.param}`);
}

/* A TAG THAT MATCHES NOTHING IS A BUG, NOT A QUIET ROW IN A REPORT.
 *
 * Will: "how do we fix it so this doesn't happen going forward". clearsScreens was pasted into
 * ABILITY_TAGS instead of MOVE_TAGS, so every ability was handed to a predicate expecting a move,
 * every call returned null, and the tag matched ZERO entries -- silently. It was found only because
 * Will's screenshot showed Psychic Fangs tagged `contact` and nothing else.
 *
 * Same failure as everything else found on 2026-07-28: the code exists, the capability does not,
 * nothing objects. So the same rule applies -- a tag must prove it matched something.
 *
 * Zero members means one of three things and all are defects:
 *   the tag is in the wrong list   (a move predicate handed abilities)
 *   the probe is broken            (a field or handler name that does not exist)
 *   nothing in the format has it   (legitimate, but then delete it or justify it)
 *
 * EXPECTED_EMPTY is deliberately a list of NAMES rather than a flag: adding to it is a decision
 * someone has to write down. */
/* JUSTIFIED EMPTIES. Each of these was checked against the dex and is empty for a REASON, written
 * down here so the next person does not re-investigate:
 *
 *   The item tags below are all isNonstandard 'Past' in this format -- Covert Cloak, Safety
 *   Goggles, Clear Amulet, Rocky Helmet, Assault Vest, Choice Band and Eviolite are simply not
 *   legal in Reg M-B, and the tagger skips nonstandard entries. The tags stay because the format
 *   changes and they will start matching the day those items return.
 *
 *   ignoresAbility: zero moves in this format carry the flag (Sunsteel Strike, Moongeist Beam and
 *   Photon Geyser are all out), so the ABILITY version (Mold Breaker) carries the whole mechanic.
 */
const EXPECTED_EMPTY = new Set([
  'blocksSecondary', 'blocksPowder', 'preventsStatDrop', 'contactPunish',
  'skipsChargeTurn', 'statMult', 'ignoresAbility',
]);
/* WILL'S RULE, 2026-07-29: "if a pokemon doesnt have a recognized move or ability, lets just give
 * it a nothing placeholder... im not trying to plan for watchog man... just have it flag it if it
 * becomes a problem."
 *
 * The right call. Chasing 100% tag coverage means writing machinery for moves nobody clicks, and
 * the tail is enormous. But SILENTLY untagged is exactly the failure this project keeps having --
 * something is absent, everything runs clean, and only a human notices.
 *
 * So: untagged is an EXPLICIT tag ('untagged'), never an empty list, and the threshold is usage,
 * not principle. Anything above USAGE_FLOOR that we never tagged gets printed for review. Watchog
 * never crosses it; a genuinely missed common move does. */
const UNTAGGED_FLOOR = 0.005;   /* 0.5% of games -- below this it is not worth engine surface */
function flagUntagged(kind, table, usage, total) {
  const bad = [];
  for (const [id, rec] of Object.entries(table)) {
    if (rec.tags && rec.tags.length) continue;
    rec.tags = ['untagged'];                       /* explicit placeholder, never an empty list */
    const share = (usage[id] || 0) / Math.max(1, total);
    if (share >= UNTAGGED_FLOOR) bad.push([id, share]);
  }
  bad.sort((x, y) => y[1] - x[1]);
  if (bad.length) {
    console.log(`
  ** ${bad.length} ${kind} above ${(UNTAGGED_FLOOR * 100).toFixed(1)}% usage have NO tag **`);
    for (const [id, sh] of bad.slice(0, 20)) console.log(`     ${id.padEnd(22)} ${(sh * 100).toFixed(2)}%`);
  } else {
    console.log(`  every ${kind} above ${(UNTAGGED_FLOOR * 100).toFixed(1)}% usage carries at least one tag.`);
  }
  return bad.length;
}

console.log('');
console.log('COVERAGE -- what carries no tag at all, weighted by whether anyone actually uses it:');
let nUntagged = 0;
const NG = Math.max(1, U.entries);
nUntagged += flagUntagged('move(s)',     moves.entries, U.move,    NG);
nUntagged += flagUntagged('ability/ies', abils.entries, U.ability, NG);
nUntagged += flagUntagged('item(s)',     items.entries, U.item,    NG);

const emptyTags = all.filter(r => r.n === 0 && !EXPECTED_EMPTY.has(r.tag));
if (emptyTags.length) {
  console.log('');
  console.log(`  ${emptyTags.length} TAG(S) MATCHED NOTHING -- a bug, not an empty category:`);
  for (const r of emptyTags) console.log(`    ${r.tag}  (${r.kind})  -- wrong list, broken probe, or delete it`);
}

fs.writeFileSync(D('data', 'tags.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/tag_dex.js',
  what: 'Every move, item and ability tagged with the PARAMETER it sets, plus whether any feature '
      + 'actually reads that parameter. Tags say "this sets that value", never "special-case this" -- '
      + 'so one damage distribution consumes all of them and there is no per-mechanic branch to get '
      + 'subtly wrong.',
  derivation: 'Dex fields where they exist (multihit, willCrit, priority, target, flags, boosts, '
            + 'drain, recoil, selfSwitch, forceSwitch, weather, terrain, sideCondition) and HANDLER '
            + 'PROBES where they do not (onDamagingHit, onSourceModifyDamage, onCriticalHit, '
            + 'onFoeTryMove, onChangeBoost, onModifySpe). Nothing hand-listed, per S13.',
  consumedBy: 'CHECKED by grepping engine/board.js and engine/medicham2-browser.js for the tag probe. '
            + 'A tag whose probe appears in neither is reported NOT READ regardless of intent.',
  sheet_entries: U.entries,
  tags: all, linkage, moves: moves.entries, items: items.entries, abilities: abils.entries,
}, null, 1));
console.log('\nwrote data/tags.json');
if (emptyTags.length) {
  console.error(`
tag_dex: ${emptyTags.length} tag(s) matched nothing. Fix the predicate or add to EXPECTED_EMPTY.`);
  process.exit(1);
}
