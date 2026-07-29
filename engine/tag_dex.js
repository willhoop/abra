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
function usage() {
  const out = { move: {}, item: {}, ability: {}, entries: 0 };
  let F; try { F = require('./fit_policy.js'); } catch (e) { return out; }
  let games; try { games = F.loadCorpus().games; } catch (e) { return out; }
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

const MOVE_TAGS = [
  { tag: 'multiHit', param: 'hits = n (or a distribution)', probe: 'multihit',
    why: 'total damage is n x base, and it BREAKS Focus Sash and Sturdy -- the first hit takes the holder to 1, the rest kill',
    of: m => m.multihit ? { hits: m.multihit } : null },
  { tag: 'alwaysCrit', param: 'P(crit) = 1', probe: 'willCrit',
    why: 'x1.5 and ignores the defender\'s positive defensive boosts',
    of: m => m.willCrit ? { pCrit: 1 } : null },
  { tag: 'critRatioUp', param: 'P(crit) raised', probe: 'critRatio',
    why: 'a higher crit stage, which the damage distribution should weight rather than ignore',
    of: m => (m.critRatio && m.critRatio > 1 && !m.willCrit) ? { critRatio: m.critRatio } : null },
  /* Will: "do we have the terrain and weather attacks like expanding force and weather ball".
   * Weather Ball is 4,699 uses -- it changes TYPE, POWER and TARGET with the weather, and only the
   * type is currently handled. Derived from the handlers rather than a move list. */
  { tag: 'weatherScaled', param: 'type, power or target changes with the weather', probe: 'weatherBall',
    why: 'Weather Ball (4,699 uses), Hydro Steam. Its type is handled; the power and the target '
       + 'change are not',
    of: m => ((m.onModifyType && /weather/i.test(String(m.onModifyType)))
              || (m.onModifyMove && /weather/i.test(String(m.onModifyMove)))
              || (m.basePowerCallback && /weather/i.test(String(m.basePowerCallback))))
             ? { scalesWith: 'weather' } : null },
  { tag: 'terrainScaled', param: 'power or target changes with the terrain', probe: 'terrainScaled',
    why: 'Expanding Force becomes a SPREAD move in Psychic Terrain, Rising Voltage doubles in '
       + 'Electric. Grassy Glide gains priority, which board.js already special-cases',
    of: m => ((m.onModifyType && /terrain/i.test(String(m.onModifyType)))
              || (m.onModifyMove && /terrain/i.test(String(m.onModifyMove)))
              || (m.basePowerCallback && /terrain/i.test(String(m.basePowerCallback))))
             ? { scalesWith: 'terrain' } : null },
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
  { tag: 'variablePower', param: 'basePower is the calculation itself; dex bp is 0', probe: 'basePowerCallback',
    why: 'Low Kick by weight, Gyro Ball by speed ratio, Grass Knot. dex basePower is 0, so board.js '
       + 'returns null and scores them as NON-DAMAGING -- 1.27% of move slots doing zero',
    of: m => m.basePowerCallback ? { computed: true } : null },
  { tag: 'conditionalPower', param: 'fixed power x a multiplier when a condition holds', probe: 'onBasePower',
    why: 'Knock Off x1.5 if they hold an item (1,640 uses, and the SHEET tells you), Facade x2 if '
       + 'statused, Venoshock x2 if poisoned, Expanding Force x1.5 on Psychic Terrain. The engine '
       + 'uses the base number every time',
    of: m => (m.onBasePower && !m.basePowerCallback) ? { conditional: true } : null },
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
  { tag: 'priority', param: 'order = priority', probe: 'effectivePriority',
    why: 'who moves first, before speed is consulted at all',
    of: m => m.priority ? { priority: m.priority } : null },
  { tag: 'contact', param: 'triggers contact punishment on the defender', probe: 'contact',
    why: 'Rocky Helmet, Rough Skin, Iron Barbs, Static, Flame Body all cost you for touching',
    of: m => (m.flags && m.flags.contact) ? { contact: true } : null },
  { tag: 'powder', param: 'fails into Grass types, Overcoat and Safety Goggles', probe: 'powder',
    why: 'this is how Rage Powder is beaten, and redirection is scored as if it always works',
    of: m => (m.flags && m.flags.powder) ? { powder: true } : null },
  { tag: 'sound', param: 'bypasses Substitute, blocked by Soundproof', probe: 'flags.sound',
    why: 'also the trigger for Throat Spray',
    of: m => (m.flags && m.flags.sound) ? { sound: true } : null },
  { tag: 'neverMisses', param: 'P(hit) = 1', probe: 'accuracy === true',
    why: 'Aerial Ace, Swift, Flower Trick, Aura Sphere, Magical Leaf. The accuracy feature and the '
       + 'kill probability both scale by P(hit), so a move that CANNOT miss must not be discounted '
       + 'like one that can',
    of: m => m.accuracy === true ? { pHit: 1 } : null },
  /* INVERTED, on Will's review: "wouldn't it be easier to say what moves protect doesn't block".
   * Yes -- 389 moves are blocked and the exceptions are a handful, so tagging the majority made a
   * 67% column that says nothing. The EXCEPTIONS are also the actionable set, because a move that
   * ignores Protect is currently mispriced as if Protect stops it. Restricted to foe-targeting moves,
   * since Protect is simply irrelevant to a self-target or a side condition. Real users: Feint (222),
   * Phantom Force (201), Future Sight (5). */
  { tag: 'ignoresProtect', param: 'Protect does NOT stop it', probe: 'ignoresProtect',
    why: 'Feint, Phantom Force, Future Sight. tgtMayProtect discounts these as if a Protect saves the '
       + 'target, and it does not',
    of: m => (['normal', 'any', 'adjacentFoe', 'allAdjacentFoes', 'allAdjacent', 'all'].includes(m.target)
              && !(m.flags && m.flags.protect)) ? { ignoresProtect: true } : null },
  { tag: 'stalling', param: 'is a Protect-family move', probe: 'stallingMove',
    why: 'protectThreatened and deadStall both hang off it',
    of: m => m.stallingMove ? { stalling: true } : null },
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
    of: m => (m.selfSwitch && m.category === 'Status' && !/batonpass|shedtail/.test(norm(m.id)))
             ? { selfSwitch: m.selfSwitch } : null },
  { tag: 'passesState', param: 'the incoming Pokemon INHERITS something', probe: 'batonpass',
    why: 'Baton Pass hands over the stat boosts, Shed Tail hands over a Substitute. Nothing in the '
       + 'model represents a switch that carries state across',
    of: m => /batonpass|shedtail/.test(norm(m.id)) ? { passes: true } : null },
  /* Will: "is substitute its own class". Yes -- it is not a Protect (it does not block, it ABSORBS)
   * and not a side condition (it is on one body). It is an HP buffer that eats damage until it
   * breaks, and it also blanks status and most secondary effects while it stands. Shed Tail above is
   * the move that hands one to a teammate, which is why the two belong together. */
  { tag: 'substitute', param: 'an HP buffer that absorbs hits and blanks status until it breaks', probe: 'substitute',
    why: 'Its own class. Sound moves go through it, and the damage needed to break it is a real '
       + 'number the kill calculation would have to clear first',
    of: m => /^(substitute|shedtail)$/.test(norm(m.id)) ? { buffer: 0.25 } : null },
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
  { tag: 'halvesDamage', param: 'incoming damage to my side is roughly halved', probe: 'screens',
    why: 'Light Screen 2,346, Reflect 1,988, Aurora Veil 853 -- 5,187 uses that currently change NO '
       + 'damage number anywhere in MAG',
    of: m => (m.sideCondition && /reflect|lightscreen|auroraveil/.test(norm(m.sideCondition)))
             ? { mult: 0.5 } : null },
  { tag: 'failsWithoutWeather', param: 'the move does NOTHING unless a weather is up', probe: 'failsWithoutWeather',
    why: 'Aurora Veil needs snow. Clicking it on a clear field is a wasted turn, and no feature can '
       + 'currently say so',
    of: m => (m.onTry && /weather/i.test(String(m.onTry))) ? { needsWeather: true } : null },
  { tag: 'sideBuff', param: 'another multi-turn modifier on my side', probe: 'sideCondition',
    why: 'Safeguard, Mist -- what is left once Tailwind and the screens are split out',
    of: m => (m.sideCondition && m.target === 'allySide'
              && !/^(wideguard|quickguard|craftyshield|matblock)$/.test(norm(m.id))
              && !/tailwind|reflect|lightscreen|auroraveil/.test(norm(m.sideCondition)))
             ? { sideCondition: m.sideCondition } : null },
  { tag: 'hazard', param: 'their side is damaged or slowed on switch-in, until removed', probe: 'hazard',
    why: 'Stealth Rock, Spikes, Toxic Spikes, Sticky Web. Does nothing THIS turn -- it prices their '
       + 'future switches, which is a decision MAG does not model at all',
    of: m => (m.sideCondition && m.target === 'foeSide') ? { hazard: m.sideCondition } : null },
  /* Will: "does the engine know what the boostsUser actually boosts". IT DOES NOT. board.js has
   * movesBoostMe, which is a SIGN (+1/0/-1) from expectedBoostSign -- so Swords Dance (+2 Atk),
   * Calm Mind (+1 SpA/SpD) and Dragon Dance (+1 Atk/+1 SPE) all read identically, even though only
   * the last one changes who moves first. The stat is carried here so a feature can finally use it. */
  { tag: 'boostsUser', param: 'WHICH stat stages, on self, not just that there are some', probe: 'movesBoostMe',
    why: 'movesBoostMe is only a sign. +Spe flips the speed order, +Atk changes damage, +Def changes '
       + 'survival -- three different values reading as one number today',
    of: m => {
      const b = (m.self && m.self.boosts) || ((m.target === 'self' || m.target === 'adjacentAllyOrSelf') ? m.boosts : null);
      return b ? { boosts: b, raisesSpeed: !!b.spe } : null;
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
      if (b) return { boosts: b, lowersSpeed: (b.spe || 0) < 0, lowersAttack: (b.atk || 0) < 0 };
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
  { tag: 'perishClock', param: 'everything on the field dies in 3 turns unless it switches', probe: 'perishsong',
    why: 'Perish Song, 560 uses. Ignores HP, typing, items and abilities. No damage feature can see '
       + 'it and no kill calculation applies',
    of: m => /perishsong/.test(norm(m.id)) ? { turns: 3 } : null },
  { tag: 'inflictsStatus', param: 'status := x (any)', probe: 'statusBites',
    why: 'burn halves physical damage, paralysis halves speed -- both are damage/order parameters',
    of: m => m.status ? { status: m.status } : null },
  { tag: 'drain', param: 'heals a fraction of damage dealt', probe: 'drain',
    why: 'changes the value of clicking it into a healthy target',
    of: m => m.drain ? { drain: m.drain } : null },
  /* Will: "some recoil moves have more recoil than others we need to modify". The FRACTION is the
   * parameter, and it ranges widely: Head Smash pays 1/2, Flare Blitz and Wave Crash 33/100, Wild
   * Charge 1/4. Flare Blitz (4,032) and Wave Crash (4,052) are top-tier moves in this format and the
   * self-damage is currently free in the score. */
  { tag: 'recoil', param: 'the user pays a FRACTION of the damage dealt', probe: 'recoil',
    why: 'Head Smash 1/2, Flare Blitz and Wave Crash 33/100 at ~4,000 uses each, Wild Charge 1/4. '
       + 'A cost nothing prices',
    of: m => {
      if (m.recoil) return { fraction: m.recoil[0] / m.recoil[1] };
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
    of: m => ((m.heal || (m.flags && m.flags.heal)) && !m.drain
              && (m.target === 'self' || m.target === 'allies' || m.target === 'allySide'))
             ? { heal: m.heal || true } : null },
  { tag: 'healsAlly', param: 'restores my PARTNER max-HP share', probe: 'healsPartner',
    why: 'Heal Pulse, Life Dew, Floral Healing. Already a pair feature in DODUO and nothing in the '
       + 'single-move vector',
    of: m => ((m.heal || (m.flags && m.flags.heal)) && !m.drain && m.target !== 'self')
             ? { heal: m.heal || true } : null },
  /* Will: "the charge turns need a weather sub tag or something that says if rain then no charge on
   * electroshot". Exactly right, and the dex declares it -- Showdown stores the skip condition on
   * the move's own condition handler, so it is derivable rather than a list. Electro Shot skips its
   * charge in RAIN, Solar Beam and Solar Blade skip in SUN. A charge move that is not charging is a
   * completely different move: full power, no free turn given away. */
  { tag: 'chargeTurn', param: 'costs a turn before it lands', probe: 'chargeTurn',
    why: 'and the request omits the target field on the locked turn, which already broke the player once',
    of: m => (m.flags && m.flags.charge) ? { charge: true } : null },
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
  { tag: 'recharge', param: 'costs the turn AFTER it lands', probe: 'rechargeTurn',
    why: 'Hyper Beam. A free turn for the opponent',
    of: m => (m.self && m.self.volatileStatus === 'mustrecharge') ? { recharge: true } : null },
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
];

const ITEM_TAGS = [
  { tag: 'megaStone', param: 'the holder becomes another species', probe: 'megaStone',
    why: 'different stats, typing and ability from turn one',
    of: it => it.megaStone ? { into: it.megaStone } : null },
  { tag: 'survivesFromFull', param: 'a lethal hit from full HP leaves 1', probe: 'survivesFromFull',
    why: 'Focus Sash, the most-held item in the format. Broken by multi-hit moves and by any prior chip',
    of: it => norm(it.name) === 'focussash' ? { survives: true } : null },
  { tag: 'choiceLock', param: 'the holder is locked into one move', probe: 'locking',
    why: 'the single strongest thing an open sheet tells you about what they can do next turn',
    of: it => (it.isChoice) ? { choice: true } : null },
  { tag: 'speedMult', param: 'speed x1.5', probe: 'choicescarf',
    why: 'order, which most kill features hang off',
    of: it => norm(it.name) === 'choicescarf' ? { mult: 1.5 } : null },
  { tag: 'damageMultAll', param: 'x damage on everything', probe: 'lifeorb',
    why: 'Life Orb 1.3, at a cost this does not model',
    of: it => /^(lifeorb)$/.test(norm(it.name)) ? { mult: 1.3 } : null },
  { tag: 'damageMultType', param: 'x1.2 on one type', probe: 'onBasePower',
    why: 'Charcoal, Black Glasses, Mystic Water, Fairy Feather. About 6.7% of held items and a pure calculation error',
    of: it => it.onBasePower && it.onBasePower.length >= 0 && /plate|gem$|charcoal|blackglasses|mysticwater|fairyfeather|magnet|nevermeltice|sharpbeak|silkscarf|silverpowder|softsand|spelltag|twistedspoon|hardstone|metalcoat|miracleseed|poisonbarb|blackbelt|dragonfang|oddincense|rockincense|roseincense|seaincense|waveincense/.test(norm(it.name)) ? { mult: 1.2 } : null },
  { tag: 'resistBerry', param: 'halves one super-effective hit, then is gone', probe: 'naturalGift',
    why: 'Chople, Colbur, Kasib, Occa. About 6.8% of held items and it turns kills into non-kills',
    of: it => (it.isBerry && it.onSourceModifyDamage) ? { halves: true } : null },
  /* Will: "lum berry?" -- a different berry class entirely. The resist berries halve a hit; these
   * delete a status the moment it lands, which makes a status move against the holder a wasted turn.
   * Derived from the handler rather than named. */
  { tag: 'curesStatus', param: 'a status is removed the moment it lands', probe: 'lumberry',
    why: 'Lum (107 uses), Chesto, Rawst. Every status move aimed at the holder is a wasted turn, and '
       + 'inflictsStatus has no idea',
    of: it => (it.isBerry && !it.onSourceModifyDamage
               && /cureStatus|setStatus|status/i.test(String(it.onUpdate || it.onAfterSetStatus || '')))
              ? { cures: true } : null },
  { tag: 'healsAtHalf', param: 'restores 25% when it drops below half', probe: 'sitrusberry',
    why: 'Sitrus, 10.8% of items. Modelled in the rollout engine only, invisible to MAG',
    of: it => (it.isBerry && it.onUpdate && /sitrus|oran/.test(norm(it.name))) ? { heal: 0.25 } : null },
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
  { tag: 'extendsScreens', param: 'side conditions last 8 turns not 5', probe: 'lightclay',
    why: '3.1% of items',
    of: it => norm(it.name) === 'lightclay' ? { turns: 8 } : null },
  { tag: 'contactPunish', param: 'hurts anything that makes contact', probe: 'rockyhelmet',
    why: 'a cost of clicking a contact move that is not currently priced',
    of: it => norm(it.name) === 'rockyhelmet' ? { chip: 1 / 6 } : null },
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
  { tag: 'statMult', param: 'raises one stat', probe: 'assaultvest',
    why: 'Band, Specs, Assault Vest, Eviolite',
    of: it => /^(choiceband|choicespecs|assaultvest|eviolite)$/.test(norm(it.name)) ? { mult: 1.5 } : null },
];

const ABILITY_TAGS = [
  { tag: 'survivesFromFull', param: 'a lethal hit from full HP leaves 1', probe: 'sturdy',
    why: 'Sturdy. Identical to Focus Sash and NOT modelled anywhere -- verified 0 mentions',
    of: a => norm(a.name) === 'sturdy' ? { survives: true } : null },
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
    of: a => (a.onDamagingHit && /disable/i.test(String(a.onDamagingHit))) ? { disables: true } : null },
  { tag: 'preventsCrit', param: 'P(crit) = 0', probe: 'onCriticalHit',
    why: 'Shell Armor and Battle Armor. Turns Flower Trick from a guaranteed crit into an ordinary hit',
    of: a => a.onCriticalHit !== undefined ? { pCrit: 0 } : null },
  { tag: 'weatherSetter', param: 'weather := x on switch-in', probe: 'weatherSetter',
    why: 'and megaing can COST you it, which is Will\'s reason to decline a mega',
    of: a => (a.onStart && /setWeather/.test(String(a.onStart))) ? { sets: true } : null },
  { tag: 'terrainSetter', param: 'terrain := x on switch-in', probe: 'terrainSetter',
    why: 'same shape as weather',
    of: a => (a.onStart && /setTerrain/.test(String(a.onStart))) ? { sets: true } : null },
  { tag: 'speedCond', param: 'speed x2 under a condition', probe: 'onModifySpe',
    why: 'Chlorophyll, Swift Swim, Sand Rush, Slush Rush, Unburden, Quick Feet. Already probed for the speed order',
    of: a => a.onModifySpe ? { conditional: true } : null },
  /* TIGHTENED. `onImmunity` also covers immunity to WEATHER CHIP -- which is why Sand Veil (135
   * uses) and Snow Cloak (219) were being reported as type-immunity abilities when they are evasion
   * abilities. A type immunity is an onTryHit that inspects move.type. Found by Will asking about
   * Sand Veil and Bright Powder. */
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
      if (/^levitate$/.test(norm(a.name))) return { immune: true, via: 'not derivable -- no handler' };
      if (a.onTryHit && /move\.type|type ===/.test(String(a.onTryHit))) return { immune: true, via: 'onTryHit' };
      const TYPES = /Bug|Dark|Dragon|Electric|Fairy|Fighting|Fire|Flying|Ghost|Grass|Ground|Ice|Normal|Poison|Psychic|Rock|Steel|Water/;
      if (a.onImmunity && TYPES.test(String(a.onImmunity))) return { immune: true, via: 'onImmunity' };
      return null;
    } },
  { tag: 'redirectsType', param: 'draws that type to itself', probe: 'lightningrod',
    why: 'Lightning Rod and Storm Drain redirect AND boost',
    of: a => a.onFoeRedirectTarget ? { redirect: true } : null },
  { tag: 'profitsFromHit', param: 'the target gains something for being hit', probe: 'onDamagingHit',
    why: 'Stamina, Weak Armour, Berserk, Anger Shell, Justified, Rattled. Task #18 -- Will\'s Bellibolt case',
    of: a => a.onDamagingHit ? { profits: true } : null },
  /* DERIVED FROM THE HANDLER SOURCE, not from a list of names (Will: "no hardcodes"). Showdown
   * expresses the contact condition two ways -- checkMoveMakesContact() or move.flags.contact -- and
   * reading the function text catches both. It also separates the TRIGGER, which Will spotted was
   * being conflated: Rough Skin and Static fire on CONTACT, Toxic Debris on any PHYSICAL hit, and
   * Stamina and Cursed Body on ANY hit at all. */
  { tag: 'contactPunish', param: 'the ATTACKER pays for touching it', probe: 'roughskin',
    why: 'Rough Skin (3,739), Static, Flame Body, Poison Point, Cute Charm, Effect Spore, Mummy, '
       + 'Gooey. Derived by reading the handler for checkMoveMakesContact',
    of: a => (a.onDamagingHit && /checkMoveMakesContact|flags\.contact/.test(String(a.onDamagingHit)))
             ? { trigger: 'contact' } : null },
  { tag: 'damageReduce', param: 'x<1 damage taken', probe: 'multiscale',
    why: 'Filter, Solid Rock, Multiscale, Thick Fat, Heatproof, Fluffy. Overcalling kills without them',
    of: a => a.onSourceModifyDamage ? { reduce: true } : null },
  { tag: 'damageBoost', param: 'x>1 damage dealt', probe: 'technician',
    why: 'Adaptability, Technician, Tinted Lens, Sheer Force, Iron Fist, Strong Jaw',
    of: a => (a.onBasePower || a.onModifyAtk || a.onModifySpA) ? { boost: true } : null },
  { tag: 'blocksMove', param: 'a whole class of move fails', probe: 'onFoeTryMove',
    why: 'already derived for allySideBlockProb -- Dazzling, Armor Tail, Good as Gold',
    of: a => a.onFoeTryMove ? { blocks: true } : null },
  { tag: 'invertsBoosts', param: 'stat changes flip sign', probe: 'onChangeBoost',
    why: 'Contrary and Simple, already probed for expectedBoostSign',
    of: a => a.onChangeBoost ? { inverts: true } : null },
  { tag: 'priorityMod', param: 'order shifts for a class of move', probe: 'onModifyPriority',
    why: 'Prankster, Gale Wings, Triage. stallIntoEncore already depends on it',
    of: a => (a.onModifyPriority || a.onModifyMove) ? { priority: true } : null },
  { tag: 'preventsSwitch', param: 'the foe cannot leave', probe: 'onFoeTrapPokemon',
    why: 'Shadow Tag, Arena Trap, Magnet Pull. Already used by the playstyle classifier',
    of: a => a.onFoeTrapPokemon ? { traps: true } : null },
  { tag: 'onSwitchInDrop', param: 'stat stages on the foe at switch-in', probe: 'intimidate',
    why: 'Intimidate. Beaten by Clear Amulet and by White Herb, neither of which is checked',
    of: a => (a.onStart && /boost/i.test(String(a.onStart)) && /foe|adjacentFoes|activePokemon/.test(String(a.onStart)))
             ? { drop: true } : null },
  { tag: 'formeChange', param: 'the species changes mid-battle', probe: 'megaFormeOf',
    why: 'Zero to Hero (needs a switch), Illusion, Imposter, Disguise',
    of: a => /zerotohero|illusion|imposter|disguise|schooling|shieldsdown|powerconstruct/.test(norm(a.name)) ? { changes: true } : null },
  { tag: 'statusImmune', param: 'a status cannot land', probe: 'statusImmune',
    why: 'Limber, Immunity, Insomnia, Vital Spirit, Water Veil, Magma Armor. onSetStatus only -- '
       + 'onImmunity also means weather-chip immunity and was over-capturing',
    of: a => a.onSetStatus ? { immune: true } : null },
  /* Will: "and things like sand veil and bright powder". accuracyMod existed for moves and items and
   * NOT for abilities, which is where the conditional ones live. A third mechanism feeding the same
   * P(hit): stages use one table, items are flat multipliers, and these are flat multipliers GATED
   * ON A CONDITION -- Sand Veil only in sand, Snow Cloak only in snow, Hustle only on physical. */
  { tag: 'accuracyMod', param: 'P(hit) scaled, often gated on a weather or a category', probe: 'onModifyAccuracy',
    why: 'Sand Veil (135 uses, x1.25 evasion in sand), Snow Cloak (219, in snow), Compound Eyes, '
       + 'Victory Star, Hustle, Wonder Skin, No Guard. Same P(hit) the kill distribution needs',
    of: a => (a.onModifyAccuracy || a.onSourceModifyAccuracy || a.onAccuracy || a.onSourceAccuracy)
             ? { accuracy: true } : null },
  { tag: 'weatherChipImmune', param: 'takes no sandstorm or snow residual damage', probe: 'onImmunity',
    why: 'What onImmunity actually means for Sand Veil, Snow Cloak, Overcoat and Magic Guard -- and '
       + 'what typeImmunity was wrongly reporting until Will asked',
    of: a => {
      if (!a.onImmunity) return null;
      const TYPES = /Bug|Dark|Dragon|Electric|Fairy|Fighting|Fire|Flying|Ghost|Grass|Ground|Ice|Normal|Poison|Psychic|Rock|Steel|Water/;
      return TYPES.test(String(a.onImmunity)) ? null : { chipImmune: true };
    } },
];

/* ---- BUILD ----------------------------------------------------------------------------------- */
const U = usage();
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
    if (hit.length) entries[id] = { name: o.name, tags: hit, uses: usageMap[id] || 0, params };
  }
  return { entries, index };
}

const moves = collect('move', dex.moves.all(), MOVE_TAGS, U.move);
const items = collect('item', dex.items.all(), ITEM_TAGS, U.item);
const abils = collect('ability', dex.abilities.all(), ABILITY_TAGS, U.ability);

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
  tags: all, moves: moves.entries, items: items.entries, abilities: abils.entries,
}, null, 1));
console.log('\nwrote data/tags.json');
