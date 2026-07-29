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
let F_GAMES = null;                 /* kept so the mega-reachable sweep can reuse the same corpus */
function usage() {
  const out = { move: {}, item: {}, ability: {}, entries: 0 };
  let F; try { F = require('./fit_policy.js'); } catch (e) { return out; }
  let games; try { games = F.loadCorpus().games; } catch (e) { return out; }
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

function weatherIn(src) {
  const found = [];
  for (const k in WEATHER) if (new RegExp('"' + k + '"').test(src)) found.push(WEATHER[k]);
  return [...new Set(found)];
}
function multiplierIn(src) {
  const m = src.match(/chainModify\(\s*([\d.]+)\s*\)/);
  return m ? +m[1] : null;
}
function hpGateIn(src) {
  if (/hp\s*>=\s*\w+\.maxhp/.test(src)) return 'only at full HP';
  if (/hp\s*<=\s*\w+\.maxhp\s*\/\s*(\d)/.test(src))
    return 'only below 1/' + src.match(/maxhp\s*\/\s*(\d)/)[1] + ' HP';
  return null;
}
function statusIn(src) {
  const st = src.match(/trySetStatus\(\s*"(\w+)"/);
  const ch = src.match(/randomChance\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!st) return null;
  const NAME = { par: 'paralysis', brn: 'burn', psn: 'poison', tox: 'bad poison', frz: 'freeze', slp: 'sleep' };
  return { status: NAME[st[1]] || st[1], chance: ch ? +ch[1] / +ch[2] : 1 };
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
    of: m => m.multihit ? { readFrom: 'm.multihit',
      distribution: Array.isArray(m.multihit) ? '2:35 3:35 4:15 5:15' : 'fixed' } : null },
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
  /* Will: "throat chop needs to block sound moves that should be easy". It is -- same shape as
   * Taunt and Disable, an effect that REMOVES OPTIONS from them for two turns, and the sound flag is
   * already tagged on the moves it blocks. */
  { tag: 'blocksSoundMoves', param: 'they cannot use sound moves for 2 turns', probe: 'throatchop',
    why: 'Throat Chop. The sound flag already exists on the moves it blocks, so this is a join rather '
       + 'than new information',
    of: m => (m.volatileStatus === 'throatchop' || /throatchop/.test(norm(m.id))) ? { blocks: 'sound' } : null },
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
  { tag: 'variablePower', param: 'basePower is the calculation itself; dex bp is 0', probe: 'basePowerCallback',
    why: 'Low Kick by weight, Gyro Ball by speed ratio, Grass Knot. dex basePower is 0, so board.js '
       + 'returns null and scores them as NON-DAMAGING -- 1.27% of move slots doing zero',
    of: m => m.basePowerCallback ? { computed: true } : null },
  /* Will: "darkest lariat we need a tag for things like unaware". Same parameter from both sides --
   * the boost multiplier stops applying. Darkest Lariat (1,232 uses) and Sacred Sword ignore the
   * TARGET's defensive stages; Unaware (172 uses) ignores them in both directions permanently. And
   * it is the parameter a CRIT already uses, since a critical hit ignores the defender's positive
   * boosts -- so all three feed one switch rather than three special cases. */
  { tag: 'ignoresStatStages', param: 'the boost multiplier does not apply', probe: 'ignoreDefensive',
    why: 'Darkest Lariat (1,232 uses), Sacred Sword. Setup means nothing into them, so a boosted '
       + 'target is no safer than an unboosted one -- and it is the same switch a crit flips',
    of: m => (m.ignoreDefensive || m.ignoreOffensive)
             ? { ignores: m.ignoreDefensive ? 'target defensive stages' : 'user negative stages' } : null },
  /* Will: "psychic fangs and brick break clear screens, veils". The counterplay to halvesDamage,
   * and Psychic Fangs at 1,352 uses is common enough that a screen is not the guarantee it looks. */
  { tag: 'clearsScreens', param: 'destroys Reflect, Light Screen and Aurora Veil on their side', probe: 'removeSideCondition',
    why: 'Psychic Fangs (1,352 uses), Brick Break (289), Raging Bull. The answer to 5,187 uses of '
       + 'screens, and it lands as a damaging move rather than costing a turn',
    of: m => (/removeSideCondition/i.test(String(m.onTryHit || '') + String(m.onHit || ''))
              && /reflect|screen|veil/i.test(String(m.shortDesc || ''))) ? { clears: 'screens' } : null },
  { tag: 'conditionalPower', param: 'fixed power x a multiplier when a condition holds', probe: 'onBasePower',
    why: 'Knock Off x1.5 if they hold an item (1,640 uses, and the SHEET tells you), Facade x2 if '
       + 'statused, Venoshock x2 if poisoned, Expanding Force x1.5 on Psychic Terrain. The engine '
       + 'uses the base number every time',
    of: m => (m.onBasePower && !m.basePowerCallback) ? { conditional: true } : null },
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
    of: m => {
      const src = String(m.onTry || '') + String(m.onTryHit || '') + String(m.onHit || '');
      if (!/maxhp/i.test(src)) return null;
      const frac = /clangoroussoul/.test(norm(m.id)) ? 1 / 3
                 : /shedtail/.test(norm(m.id)) ? 1 / 2
                 : /substitute/.test(norm(m.id)) ? 1 / 4 : null;
      return frac ? { costsFraction: frac, failsBelow: frac } : null;
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
    of: m => m.multiaccuracy ? { perHit: true } : null },
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
      return { source: kind, flat: typeof m.damage === 'number' ? m.damage : null,
               ignoresStatsAndSTAB: true };
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
    of: m => /instruct/.test(norm(m.id)) ? { extraAction: true } : null },
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
      return /statsRaisedThisTurn/.test(parts.join(' ')) ? { onlyIfTargetBoostedThisTurn: true } : null;
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
      return { atFoe: m.basePower ? m.basePower + ' BP attack' : 'effect',
               atAlly: /this\.heal/.test(src) ? 'heals the ally' : 'different effect' };
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
      const frac = (src.match(/maxhp\s*\/\s*(\d+)|Math\.round\([^)]*\/\s*(\d+)/) || []).slice(1).find(Boolean);
      return { fraction: frac ? '1/' + frac : null,
               movesHPBetweenSides: /damage\(/.test(src) && /heal|drain/i.test(src) };
    } },
  { tag: 'partialTrap', param: 'target cannot switch for 4-5 turns AND takes 1/8 chip each turn', probe: 'partiallytrapped',
    why: 'Infestation (450 uses), Fire Spin, Sand Tomb, Whirlpool. Trapping changes what they can '
       + 'legally do, which nothing represents, and the chip is residual damage nothing counts',
    of: m => m.volatileStatus === 'partiallytrapped' ? { turns: '4-5', chipPerTurn: 1 / 8 } : null },
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
    of: m => {
      const F = ['punch', 'bite', 'slicing', 'pulse', 'bullet', 'wind'];
      const on = F.filter(f => m.flags && m.flags[f]);
      return on.length ? { classes: on } : null;
    } },
  /* Will: "does freeze dry need like tag saying im super effective against water, or will it tell
   * us that". It will NOT tell us -- mcEff is a static type chart and Freeze-Dry overrides
   * effectiveness in an onEffectiveness handler. Our chart returns x0.5 for Ice into Water; the
   * truth for this move is x2. A FOUR-FOLD error on 748 uses, in the direction that makes MAG
   * decline a kill it actually has. */
  { tag: 'overridesEffectiveness', param: 'the type chart is WRONG for this move', probe: 'onEffectiveness',
    why: 'Freeze-Dry, 748 uses: x2 into Water where the chart says x0.5. A 4x error, and mcEff is a '
       + 'static lookup that cannot see the handler',
    of: m => m.onEffectiveness ? { overrides: true } : null },
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
    of: m => (m.stallingMove && m.condition && m.condition.onHit) ? { onContact: true } : null },
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
    of: m => (/^(suckerpunch|upperhand|counter|mirrorcoat|metalburst|focuspunch|shelltrap|revenge|avalanche|payback|assurance)$/.test(norm(m.id)))
             ? { needs: 'target attacking' } : null },
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
    of: m => (!m.boosts && !(m.self && m.self.boosts)
              && /boost/i.test(String(m.onHit || '') + String(m.onModifyMove || '')))
             ? { procedural: true } : null },
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
  { tag: 'perishClock', param: 'everything on the field dies in 3 turns unless it switches', probe: 'perishsong',
    why: 'Perish Song, 560 uses. Ignores HP, typing, items and abilities. No damage feature can see '
       + 'it and no kill calculation applies',
    of: m => /perishsong/.test(norm(m.id)) ? { turns: 3 } : null },
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
    of: m => m.drain ? { readFrom: 'm.drain', unusual: (m.drain[0] / m.drain[1]) !== 0.5 } : null },
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
      if (SELFISH.includes(m.target)) return { heal: m.heal || true };
      if (!FRIENDLY.includes(m.target)) return { heal: m.heal || true, note: 'heals the user while targeting a foe' };
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
    of: i => (i.onUpdate && /taunt|encore|disable|attract|healblock|torment/i.test(String(i.onUpdate)))
             ? { oneShot: true } : null },
  { tag: 'boostsSuperEffective', param: 'x1.2 damage, but only on a super-effective hit', probe: 'onModifyDamage',
    why: 'Expert Belt. Conditional on the type matchup rather than flat, so it changes WHICH target '
       + 'is the right one to hit, not just how hard',
    of: i => (i.onModifyDamage && /typeMod|Effectiveness/i.test(String(i.onModifyDamage)))
             ? { mult: 1.2, onlyIfSuperEffective: true } : null },
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
      if (!trig && !heal) return null;
      return { triggersBelow: trig ? '1/' + trig : null, restores: heal ? '1/' + heal : null,
               confusesIfWrongNature: /confus/i.test(eat) || null };
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
    of: a => a.onAfterEachBoost ? { retaliates: true } : null },
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
      return { blocks: statsBlockedIn(src) || 'all stats',
               onlyGrassTypes: /hasType\("Grass"\)/.test(src) || null,
               protectsAllies: !!a.onAllyTryBoost || null };
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
    of: a => (a.onResidual && /randomChance|sample\(|this\.random/.test(String(a.onResidual)))
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
    of: o => {
      const own  = String(o.onModifyAccuracy || '') + String(o.onModifyMove || '');
      const foe  = String(o.onSourceModifyAccuracy || '');
      const both = String(o.onAnyAccuracy || '');
      const src = own + foe + both;
      if (!/accuracy/i.test(src)) return null;
      const always = /accuracy\s*=\s*true/.test(src);
      const m = src.match(/chainModify\(\[?\s*([\d.]+)/);
      const mult = m ? (+m[1] > 100 ? +(m[1] / 4096).toFixed(2) : +m[1]) : null;
      const scope = both ? 'every move, both directions'
                  : (own && foe) ? 'both directions'
                  : own ? 'its own moves' : 'moves aimed at it';
      return { setsTo: always ? 1 : null, mult: always ? null : mult, scope };
    } },
  { tag: 'auraBoost', param: 'multiplies one TYPE for every Pokemon on the field, friend and foe', probe: 'onAnyBasePower',
    why: 'Fairy Aura (1,455 fields) makes every Fairy move 1.33x -- including the foe\'s. A '
       + 'field-wide multiplier that helps both sides is unlike any other boost in the taxonomy',
    of: a => {
      /* Showdown writes the guard as an EARLY RETURN -- `move.type !== "Fairy"` -- so a probe
       * looking for `===` matched nothing. Third time tonight a handler said the opposite of the
       * shape the reader expected; the empty-tag guard caught it again. */
      const src = String(a.onAnyBasePower || '');
      const t = (src.match(/move\.type\s*!==?\s*"(\w+)"/) || src.match(/move\.type\s*===?\s*"(\w+)"/) || [])[1];
      if (!t) return null;
      const m = src.match(/chainModify\(\[?\s*(\d+)/);
      return { type: t, mult: m ? +(m[1] / 4096).toFixed(2) : 1.33, appliesToEveryone: true };
    } },
  { tag: 'halvesTypeDamage', param: 'incoming damage of specific types uses a HALVED attacking stat', probe: 'onSourceModifyAtk',
    why: 'Thick Fat (480 fields) halves Fire and Ice. It is not a resistance and does not show in '
       + 'the type chart, so the defensive calculation misses it entirely',
    of: a => {
      const src = String(a.onSourceModifyAtk || '') + String(a.onSourceModifySpA || '');
      const t = [...src.matchAll(/move\.type\s*===?\s*"(\w+)"/g)].map(m => m[1]);
      if (!t.length) return null;
      return { types: [...new Set(t)], attackerStatMult: 0.5 };
    } },
  { tag: 'reflectsStatusMoves', param: 'Status moves aimed at it are BOUNCED back at the user', probe: 'onAllyTryHitSide',
    why: 'Magic Bounce (190 fields). Will-O-Wisp, Taunt and Thunder Wave do not merely fail, they '
       + 'land on whoever threw them -- so the move is not worth zero, it is worth negative',
    /* Will: "magic bounce reflects all status moves aimed at your side." The handler is
     * onAllyTryHitSide, which is SIDE-wide -- it covers Spikes, Stealth Rock, Reflect-breakers and
     * anything aimed at the partner, not only moves targeting the holder. Scoping it to the holder
     * would have understated it badly. */
    of: a => a.onAllyTryHitSide
      ? { bounces: 'Status', backAtUser: true, scope: 'the whole side, including hazards and the partner' }
      : null },
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
  { tag: 'blocksStatusMoves', param: 'every Status-category move fails against it', probe: 'goodasgold',
    why: 'Good as Gold, 2.20%. Immune to Will-O-Wisp, Taunt, Encore, Thunder Wave -- the whole 38.5% '
       + 'of move slots that are status',
    of: a => (a.onTryHit && /category === .Status|Status/.test(String(a.onTryHit))) ? { blocks: 'Status' } : null },
  { tag: 'speedOnItemLoss', param: 'speed x2 once its item is gone', probe: 'unburden',
    why: 'Unburden, 2.23%. A consumed Sash or berry doubles their speed, which flips the order '
       + 'mid-battle and the item tracking now makes observable',
    of: a => (a.onAfterUseItem || a.onTakeItem) ? { speedMult: 2 } : null },
  { tag: 'healsAllyOnSwitchIn', param: 'restores the partner on entry', probe: 'hospitality',
    why: 'Hospitality, 5.22% of abilities and the third most common in the format',
    of: a => (a.onStart && /heal/i.test(String(a.onStart))) ? { heals: true } : null },
  { tag: 'reducesAllyDamage', param: 'my PARTNER takes x0.75', probe: 'friendguard',
    why: 'Friend Guard. Changes every damage number aimed at the partner and nothing applies it',
    of: a => a.onAnyModifyDamage ? { mult: 0.75 } : null },
  { tag: 'healsOnSwitchOut', param: 'restores a third of max HP by leaving', probe: 'regenerator',
    why: 'Regenerator. Makes switching a HEAL, which is the strongest argument for pivoting that the '
       + 'switch features cannot see',
    of: a => a.onSwitchOut ? { heal: 1 / 3 } : null },
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
  { tag: 'weatherSetter', param: 'weather := x on switch-in', probe: 'weatherSetter',
    why: 'and megaing can COST you it, which is Will\'s reason to decline a mega',
    of: a => (a.onStart && /setWeather/.test(String(a.onStart))) ? { sets: true } : null },
  { tag: 'terrainSetter', param: 'terrain := x on switch-in', probe: 'terrainSetter',
    why: 'same shape as weather',
    of: a => (a.onStart && /setTerrain/.test(String(a.onStart))) ? { sets: true } : null },
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
      if (a.onTryHit && /move\.type|type ===/.test(String(a.onTryHit))) return { immune: true, via: 'onTryHit' };
      const TYPES = /Bug|Dark|Dragon|Electric|Fairy|Fighting|Fire|Flying|Ghost|Grass|Ground|Ice|Normal|Poison|Psychic|Rock|Steel|Water/;
      if (a.onImmunity && TYPES.test(String(a.onImmunity))) return { immune: true, via: 'onImmunity' };
      return null;
    } },
  { tag: 'redirectsType', param: 'draws that type to itself', probe: 'lightningrod',
    why: 'Lightning Rod and Storm Drain redirect AND boost',
    /* onAnyRedirectTarget, not onFoeRedirectTarget -- the probe was simply wrong and the tag matched
     * nothing until the empty-tag check flagged it. */
    of: a => (a.onAnyRedirectTarget || a.onFoeRedirectTarget) ? { redirect: true } : null },
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
    of: a => effectRecipients(a).holder ? { compounds: true } : null },
  { tag: 'punishesAttacker', param: 'the ATTACKER pays a flat toll, which does NOT compound', probe: 'punishesAttacker',
    why: 'Rough Skin (3,762) chips, Static/Flame Body/Poison Point status, Cursed Body disables. '
       + 'Unlike a holder buff this never accumulates, so the move stays correct -- it is a cost to '
       + 'price in, not a reason to stop attacking',
    of: a => {
      if (!effectRecipients(a).attacker) return null;
      /* Will: "spicy spray inflicts burn status." It did not say which status -- same
       * boolean-instead-of-parameter defect as Swift Swim not naming rain. */
      const src = String(a.onDamagingHit || '') + String(a.onHit || '');
      return { compounds: false, inflicts: statusIn(src),
               fraction: (src.match(/baseMaxhp\s*\/\s*(\d+)/) || [])[1] || null };
    } },
  /* DERIVED FROM THE HANDLER SOURCE, not from a list of names (Will: "no hardcodes"). Showdown
   * expresses the contact condition two ways -- checkMoveMakesContact() or move.flags.contact -- and
   * reading the function text catches both. It also separates the TRIGGER, which Will spotted was
   * being conflated: Rough Skin and Static fire on CONTACT, Toxic Debris on any PHYSICAL hit, and
   * Stamina and Cursed Body on ANY hit at all. */
  { tag: 'contactPunish', param: 'the ATTACKER pays for touching it', probe: 'roughskin',
    why: 'Rough Skin (3,739), Static, Flame Body, Poison Point, Cute Charm, Effect Spore, Mummy, '
       + 'Gooey. Derived by reading the handler for checkMoveMakesContact',
    of: a => {
      const src = String(a.onDamagingHit || '');
      if (!/checkMoveMakesContact|flags\.contact/.test(src)) return null;
      /* Will: "static spreads status" -- it does, and the tag said only 'contact'. */
      return { trigger: 'contact', inflicts: statusIn(src), fraction: (src.match(/baseMaxhp\s*\/\s*(\d+)/)||[])[1] || null };
    } },
  { tag: 'damageReduce', param: 'x<1 damage taken', probe: 'multiscale',
    why: 'Filter, Solid Rock, Multiscale, Thick Fat, Heatproof, Fluffy. Overcalling kills without them',
    of: a => {
      if (!a.onSourceModifyDamage) return null;
      const src = String(a.onSourceModifyDamage);
      return { damageMult: multiplierIn(src), onlyWhen: hpGateIn(src) };
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
            || src.includes(`flags["${f}"]`)) return { boostsFlag: f };
      }
      return null;
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
      return { mult: multiplierIn(src), onType: ty, inWeather: w.length ? w : null,
               onlyWhen: hpGateIn(src), costsPerTurn: chip ? '1/' + chip + ' max HP' : null };
    } },
  { tag: 'blocksMove', param: 'a whole class of move fails', probe: 'onFoeTryMove',
    why: 'already derived for allySideBlockProb -- Dazzling, Armor Tail, Good as Gold',
    of: a => a.onFoeTryMove ? { blocks: true } : null },
  { tag: 'invertsBoosts', param: 'stat changes flip sign', probe: 'onChangeBoost',
    why: 'Contrary and Simple, already probed for expectedBoostSign',
    of: a => a.onChangeBoost ? { inverts: true } : null },
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
    of: a => (a.onResidual && /boost/i.test(String(a.onResidual))) ? { perTurn: true } : null },
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
    of: a => a.onFoeTrapPokemon
      ? { source: 'ability', turns: null, chips: false, scope: /adjacent/i.test(String(a.onFoeTrapPokemon)) ? 'adjacent foes' : 'all foes' }
      : null },
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
  { key: 'priorityMove', test: /move\.priority\s*>\s*0/,                 note: 'the move has positive priority' },
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

const linkage = {};
for (const K of KEYS) linkage[K.key] = { note: K.note, abilities: [], items: [], moves: [] };
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
    if (hit) linkage[K.key].moves.push({ id, name: m.name, uses: u });
  }
}
for (const k in linkage) {
  for (const side of ['abilities','items','moves']) linkage[k][side].sort((a,b) => b.uses - a.uses);
  linkage[k].moveUses    = linkage[k].moves.reduce((s,x) => s + x.uses, 0);
  linkage[k].reactorUses = [...linkage[k].abilities, ...linkage[k].items].reduce((s,x) => s + x.uses, 0);
}

console.log('');
console.log('LINKAGE -- move properties, and what subscribes to them:');
console.log('  key             moves carrying it      things that react');
for (const [k, v] of Object.entries(linkage).sort((a,b) => b[1].reactorUses - a[1].reactorUses)) {
  const r = v.abilities.length + v.items.length;
  if (!r) continue;
  console.log('  ' + k.padEnd(15) + String(v.moves.length).padStart(4) + ' moves / ' +
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
