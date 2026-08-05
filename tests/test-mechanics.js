/* IS THE MECHANIC LIVE, OR ONLY TAGGED?  node tests/test-mechanics.js
 *
 * Will tagged every move, ability and item in the format, and reasonably expected the engine to play
 * them. A tag is a FACT in data/abra-tags.js; something has to consume it. Electro Shot carried
 * `chargeTurn` since July while the engine's own comment said the tag had "no state to land on", and
 * that stayed true until a live game exposed it. 122 of 172 distinct tags are never referenced by
 * name (tests/mechanics_rank.js ranks them by the corpus usage they cover).
 *
 * UNREFERENCED IS NOT UNIMPLEMENTED, which is the whole reason this file exists rather than a grep.
 * Choice Scarf, Fake Out's flinch and Filter all work without their tag being read anywhere. The only
 * way to know is to make the thing happen and look.
 *
 * EVERY PROBE CLEARS ITS OWN CONTROL, and that rule was learned the expensive way. The first version
 * of this reported Choice Scarf as MISSING: it built a "plain" Basculegion to compare against, and
 * buildMon hands a Pokemon its USAGE item -- which is a Choice Scarf. It compared a scarf to a scarf
 * and called the engine broken. So nothing here assumes a default; the varied thing is always set to
 * a known value on BOTH sides, and both sides are printed so a null result reads as a null result.
 *
 * A FAILING PROBE IS NOT A FAILING TEST. This reports a census, not a pass/fail suite -- MISSING is
 * the current honest state of several mechanics and the file would be useless if it went red and got
 * ignored. It exits 0 and prints a count. What must never happen is a mechanic going from WORKS to
 * MISSING, so the count is written to data/mechanics-census.json for a ratchet to hold.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));

/* NOTHING ASSUMED: item and ability are blanked, so a probe sets what it is testing and nothing else
 * can supply it silently. */
const bare = (sp) => {
  const b = M.buildMon(sp, {});
  if (!b) throw new Error('no MC row for ' + sp);
  b.item = ''; b.ability = 'none';
  return b;
};
const FIELD = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0, wgA: false, wgB: false };
const fresh = () => Object.assign({}, FIELD);
/* Mid-roll rng: 0.5 defeats nothing and triggers nothing at the extremes, so a probe that needs a
 * chance effect forces it explicitly rather than hoping. */
const rng5 = () => 0.5;

const results = [];
/* A PROBE THAT THREW IS NOT THE SAME AS A MECHANIC THAT IS ABSENT, and until 2026-08-04 the census
 * could not tell you which had happened. Both land in `missing`, which is right — a probe that
 * cannot run has not shown the mechanic working — but a THROW usually means the PROBE is broken
 * (nine of the entries on the ENGINE list were), and a broken probe silently deflating `live` is
 * exactly the number this division is not allowed to soften. So they are counted separately and the
 * count is printed and written to the census. */
let threw = 0;
/* A HOLLOW PROBE IS ONE THAT CANNOT FAIL FOR THE REASON IT CLAIMS, and this file shipped three of
 * them: `healsAllyOnSwitchIn`, `priorityMod` and `weatherChipImmune` all returned LIVE from
 * `readFileSync(medicham2) + a regex`. The last one was the expensive case — it matched the word
 * `magmaarmor` in an unrelated FREEZE table and reported a weather-chip immunity as working while the
 * engine had no weather chip at all. A hollow entry is worse than a missing one, because it occupies
 * a slot in a number that may never fall.
 *
 * THE DETECTOR IS STRUCTURAL, NOT A JUDGEMENT: a probe's own source is captured and any probe that
 * READS A FILE instead of running the engine is flagged. It is exact, it costs nothing, and it is
 * asserted at ZERO at the bottom of this file. Every one of the three would have been caught the day
 * it was written. What it does NOT catch is a two-armed probe whose arms happen to agree — see the
 * IDENTICAL-ARMS section at the bottom, which is measured rather than asserted, and why. */
/* THE ARMS PROTOCOL — the second detector, made real. 2026-08-04.
 *
 * The structural detector above catches a probe that READS THE SOURCE. It cannot catch the other
 * shape, which is the one that made the Disable probe a false LIVE for as long as it existed: a probe
 * with ONE arm, whose result an engine with the mechanic DELETED would also produce. The heuristic at
 * the bottom of this file counts LIVE probes whose `detail` carries two equal numbers, and it is a
 * heuristic precisely because `detail` is prose -- it cannot tell an ARM from an ANNOTATION.
 *
 * So a probe may now RETURN its arms: `{ works, detail, arms: { control, test } }`. When it does,
 * this harness asserts `control !== test` structurally, with no parsing and no judgement, and a probe
 * whose arms agree is marked HOLLOW and fails the file exactly like a source grep does.
 *
 * WHY THE PROTOCOL IS OPT-IN, AND WHY THAT IS NOT A HOLE. A probe that keeps returning only `detail`
 * would opt itself out silently, which is the same defect in a new place -- so the count of UNARMED
 * probes is computed, printed, written to the census as `unarmed`, and RATCHETED: it may go down and
 * it may never go up. A new probe therefore cannot be written without arms without failing the file,
 * and the 100-odd existing ones convert at whatever rate a pass can afford. That is the cheapest
 * version that actually closes the hole rather than costing a day up front.
 *
 * ARMS ARE COMPARED BY VALUE, so a probe can hand back objects, arrays or numbers. A MISSING probe is
 * exempt: two equal arms on a probe reporting MISSING is the mechanic being absent, which is the probe
 * working. */
const armsAgree = (a) => a && 'control' in a && 'test' in a
  && JSON.stringify(a.control) === JSON.stringify(a.test);
const probe = (kind, tag, label, fn) => {
  let works = false, detail = '', arms = null;
  const src = String(fn);
  let hollow = /readFileSync/.test(src);
  try { const r = fn(); works = !!r.works; detail = r.detail; arms = r.arms || null; }
  catch (e) { works = false; threw++; detail = 'THREW: ' + e.message.slice(0, 60); }
  if (works && armsAgree(arms)) hollow = true;
  results.push({ kind, tag, label, works, detail, hollow, armed: !!arms });
};

/* ---- ITEMS -------------------------------------------------------------------------------------- */

probe('item', 'speedMult', 'Choice Scarf raises Speed', () => {
  const a = bare('basculegion'), b = bare('basculegion');
  b.item = 'choicescarf';
  const sa = M.effSpeed(a, fresh(), 'A'), sb = M.effSpeed(b, fresh(), 'A');
  return { works: sb > sa * 1.4, detail: `no item ${sa}  ->  scarf ${sb}` };
});

probe('item', 'passiveHeal', 'Leftovers heals at end of turn', () => {
  const run = (item) => {
    const me = bare('incineroar'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    me.item = item; me.curHP = Math.floor(me.st.hp / 2);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]);
    const before = me.curHP;
    M.battleTurn(S, rng5, fa, fb);
    return me.curHP - before;
  };
  const none = run(''), left = run('leftovers');
  return { works: left > none, detail: `no item ${none} hp  ->  leftovers ${left} hp` };
});

probe('item', 'megaStone', 'a mega stone builds the mega body', () => {
  const z = M.buildMon('charizard-mega-y', {});
  return { works: !!z && /mega/.test(z.name), detail: 'built ' + (z && z.name) };
});

/* THE MEGA ROW'S OWN ABILITY MUST BE COMPARABLE, NOT MERELY PRESENT.
 *
 * 85 of the 318 MC.mons rows key a mega and store `ab` in DISPLAY case -- "Technician", "Huge Power",
 * "Tough Claws". buildMon passed that string straight through, while every ability test in this
 * engine compares against a lowercase-alphanumeric literal (att.ability==='technician'). So a body
 * built FROM ITS MEGA ROW carried the right ability and not one line of it fired.
 *
 * WHY NOBODY SAW IT: a body built from the BASE row plus a stone goes through megaAbility(), which
 * returns from a hand-written lowercase map, so that path was always correct. Only the mega-keyed
 * path -- position_features.js, sets.js, winProb2 called with a mega name -- was wrong.
 *
 * Three arms are printed, because two would not distinguish "Technician does nothing here" from
 * "this string is not the one the code looks for". */
probe('ability', 'megaRowAbilityCase', 'a mega built from its own row still gets its ability', () => {
  const def = bare('garchomp');
  const hit = (ab) => {
    const a = M.buildMon('scizor-mega', {}); a.item = '';
    if (ab !== undefined) a.ability = ab;
    return { ab: a.ability, max: M.dmgRange(a, def, MC.moves['bulletpunch'], fresh(), false).max };
  };
  const asBuilt = hit(undefined), off = hit('none'), on = hit('technician');
  /* The 85-row figure is NOT recomputed here on purpose: sweeping Object.keys(MC.mons) is a
   * hand-rolled index into that table and tests/test-mc-key.js bans it, correctly. */
  return { works: on.max > off.max && asBuilt.max === on.max,
           detail: `Bullet Punch max: ability none ${off.max}, 'technician' ${on.max}, `
                 + `as built (ability=${JSON.stringify(asBuilt.ab)}) ${asBuilt.max}` };
});

/* A SHEET LISTS THE PRE-MEGA ABILITY, so a paste of "Scizor @ Scizorite / Ability: Swarm" describes a
 * body that will be on the field with TECHNICIAN. buildMonFromSet wrote `declaredAb || megaAbility(...)`
 * and let the sheet win, so every imported mega ran its base forme's ability -- the mega ability gap
 * that tests/test-effective-identity.js exists to stop, living in the engine instead of in board.js.
 *
 * The control is the same paste with the ability line REMOVED. If the two arms disagree the sheet is
 * still steering; if they agree at the un-boosted number the ability is not firing at all, so the
 * absolute damage is asserted too, not just the equality. */
probe('ability', 'megaSheetAbility', "a sheet's pre-mega ability does not override the mega's", () => {
  const def = bare('garchomp');
  const run = (declared) => {
    const paste = 'Scizor @ Scizorite\n' + (declared ? 'Ability: ' + declared + '\n' : '')
                + 'Adamant Nature\n- Bullet Punch';
    const a = M.buildMonFromSet(M.parsePaste(paste)[0]);
    if (!a) return { name: null, ab: null, max: -1 };
    return { name: a.name, ab: a.ability, max: M.dmgRange(a, def, MC.moves['bulletpunch'], fresh(), false).max };
  };
  const sheet = run('Swarm'), silent = run(null);
  /* The un-boosted reading, taken from the same body with the ability explicitly blanked, so the
   * "is it firing" half of the assertion is measured rather than remembered. */
  const off = (() => { const a = M.buildMonFromSet(M.parsePaste('Scizor @ Scizorite\nAdamant Nature\n- Bullet Punch')[0]);
    a.ability = 'none'; return M.dmgRange(a, def, MC.moves['bulletpunch'], fresh(), false).max; })();
  return { works: sheet.ab === 'technician' && sheet.max === silent.max && sheet.max > off,
           detail: `sheet says Swarm -> ${sheet.name} ability=${JSON.stringify(sheet.ab)} ${sheet.max}; `
                 + `sheet silent -> ability=${JSON.stringify(silent.ab)} ${silent.max}; `
                 + `same body with no ability ${off}` };
});

/* ---- MOVES -------------------------------------------------------------------------------------- */

probe('move', 'neverMisses', 'Aerial Ace cannot miss', () => {
  const acc = M.moveAccuracy('aerialace', fresh());
  return { works: acc >= 100, detail: 'accuracy=' + acc };
});

probe('move', 'stalling', 'repeated Protect starts failing', () => {
  /* RE-DERIVING THE RULE IS NOT TESTING IT. The first version computed (1/3)^n here and asserted its
   * own arithmetic -- it would have passed with the engine deleted. This spends real turns and asks
   * whether the third consecutive Protect actually stops blocking. */
  const me = bare('incineroar'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const dealt = [];
  for (let t = 0; t < 3; t++) {
    const fa = new Map([[me, M.playerAction(me, 'protect', null, S.field)], [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]);
    const before = me.curHP;
    M.battleTurn(S, rng5, fa, fb);
    dealt.push(before - me.curHP);
    me.curHP = me.st.hp;                       // heal back so turn 3 is not a faint
  }
  return { works: dealt[0] === 0 && dealt[dealt.length - 1] > 0,
           detail: `damage taken per consecutive Protect: ${dealt.join(', ')}` };
});

probe('move', 'flinches', 'Fake Out stops the foe attacking', () => {
  const run = (useFO) => {
    const me = bare('incineroar'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, useFO ? M.playerAction(me, 'fakeout', f1, S.field) : { kind: 'pass' }],
                        [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]);
    const before = me.curHP;
    M.battleTurn(S, rng5, fa, fb);
    return before - me.curHP;
  };
  const off = run(false), on = run(true);
  return { works: on < off, detail: `foe dealt ${off} without  ->  ${on} after Fake Out` };
});

probe('move', 'recoil', 'Brave Bird hurts its user', () => {
  const me = bare('staraptor'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'bravebird', f1, S.field)], [ally, { kind: 'pass' }]]);
  const fb = new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]);
  const before = me.curHP;
  M.battleTurn(S, rng5, fa, fb);
  return { works: me.curHP < before, detail: `user lost ${before - me.curHP} hp to recoil` };
});

/* ARMED, 2026-08-04. `def -1 spd -1` is also what an engine that dropped the user on EVERY attack
 * would print, so the control is a different physical contact move that must leave the stages alone. */
probe('move', 'lowersUser', 'Close Combat drops the user Def/SpD and Brave Bird does not', () => {
  /* `board` and `PASS2` are declared further down this file and are in their temporal dead zone here,
     so the bodies are written out rather than the helpers moved — the same call the Hospitality probe
     already makes, and for the same reason. */
  const run = (mv) => {
    const me = bare('staraptor'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [me.boosts.df, me.boosts.sd];
  };
  const control = run('bravebird'), test = run('closecombat');
  return { works: test[0] < 0 && test[1] < 0 && control[0] === 0 && control[1] === 0,
           arms: { control, test },
           detail: `def/spd after Brave Bird ${control.join('/')}, after Close Combat ${test.join('/')}` };
});

probe('move', 'boostsUser', 'Swords Dance raises Attack', () => {
  const me = bare('incineroar'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'swordsdance', null, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: me.boosts.at > 0, detail: 'atk stage ' + me.boosts.at };
});

probe('move', 'lowersTarget', 'Charm drops the target Attack', () => {
  const me = bare('whimsicott'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'charm', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.boosts.at < 0, detail: 'target atk stage after the turn: ' + f1.boosts.at };
});

/* THE PROBE MUST NOT APPLY THE EFFECT ITSELF. The first version called applyStatus(foe,'brn') and
 * then asserted foe.status === 'brn' -- it tested applyStatus, not Will-O-Wisp, and would pass even
 * if the move did nothing. Same defect as the Encore probe: checking the classification instead of
 * the outcome. These run the turn and let the engine do it. */
const statusProbe = (tag, label, user, mv, want) => probe('move', tag, label, () => {
  const me = bare(user), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.status === want, detail: `target status after the turn: ${f1.status || 'none'} (wanted ${want})` };
});
statusProbe('inflictsBurn', 'Will-O-Wisp burns', 'incineroar', 'willowisp', 'brn');

statusProbe('inflictsParalysis', 'Thunder Wave paralyses', 'raichu', 'thunderwave', 'par');

probe('move', 'locksTarget', 'Encore locks the target in', () => {
  /* THE FOURTH VERSION. v1 accepted kind !== 'pass' (Encore returns 'status' and applied nothing).
   * v2 accepted "some state moved" (the volatile was recorded while the target still chose freely).
   * v3 was right about what to measure and wrong about how to stage it: it had the foe PROTECT on the
   * turn it was Encored, and Protect blocks Encore -- correctly -- so the probe measured its own
   * setup. Whimsicott is also faster than Garchomp, so on that turn the foe had not moved yet and
   * there was no last move to copy.
   *
   * Staged properly now: the foe commits a move on its own turn FIRST, is Encored on the next turn,
   * and is then left completely free. If Encore is real it repeats. */
  const me = bare('whimsicott'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  /* Turn 1 -- the foe uses Rock Slide, so it HAS a last move. */
  M.battleTurn(S, rng5,
    new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'rockslide', me, S.field)], [f2, { kind: 'pass' }]]));
  const committed = f1._lastMove;
  /* Turn 2 -- Encore it. */
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'encore', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const locked = !!(f1._vol && f1._vol.encore > 0);
  /* Turn 3 -- nothing forced. It must repeat. */
  M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]), null);
  const repeated = f1._lastMove === committed;
  return { works: locked && repeated,
           detail: `committed ${committed}, volatile set=${locked}, free choice next turn was ${f1._lastMove}` };
});

/* THE PROBE WAS CONFOUNDED AND THE ENGINE WAS HALF RIGHT, WHICH MAKES ABOUT TWENTY-FOUR.
 *
 * It compared a clean Incineroar against a BURNED one, and a burn halves physical damage — so the
 * x2 and the x0.5 cancelled to `clean 51 -> burnt 50` and read exactly like a dead knob. Two
 * separate corrections came out of that:
 *   1. PARALYSIS is the clean arm. Facade excludes only sleep, so par doubles it and touches
 *      nothing else in the damage formula.
 *   2. FACADE IS EXEMPT FROM THE BURN HALVING from Gen 6 (Showdown: `gen < 6 || move.id !==
 *      "facade"`), and this engine applied it. That is a REAL defect the confounded probe was
 *      hiding, and it is the third arm below. */
probe('move', 'conditionalPower', 'Facade doubles when statused, and ignores its own burn penalty', () => {
  const def = bare('garchomp'), mv = MC.moves['facade'], ctl = MC.moves['bodyslam'];
  if (!mv || !ctl) return { works: false, detail: 'facade or bodyslam not in MC.moves' };
  const hit = (status, move) => { const a = bare('incineroar'); a.status = status; return M.dmgRange(a, def, move, fresh(), false).max; };
  const control = hit('', mv), test = hit('par', mv);
  /* the control's control: a normal physical move must still LOSE damage to the same paralysis-free
     burn, or "Facade ignores burn" would pass on an engine that had simply dropped the burn rule. */
  const slamClean = hit('', ctl), slamBurnt = hit('brn', ctl);
  const facadeBurnt = hit('brn', mv);
  return { works: test > control * 1.8 && slamBurnt < slamClean && facadeBurnt > control * 1.8,
           arms: { control, test },
           detail: `Facade clean ${control}, paralysed ${test}, burned ${facadeBurnt} (must NOT be halved); `
                 + `control Body Slam clean ${slamClean} -> burned ${slamBurnt} (must be halved)` };
});

/* ---- ABILITIES ---------------------------------------------------------------------------------- */

probe('ability', 'onSwitchInDrop', 'Intimidate drops Attack', () => {
  const foe = bare('garchomp');
  const before = foe.boosts.at;
  M.applyIntimidate(foe);
  return { works: foe.boosts.at < before, detail: `atk ${before} -> ${foe.boosts.at}` };
});

/* THIS PROBE WAS HOLLOW — `/isPrankster/.test(src)` — LIVE by SOURCE GREP, not by behaviour. It would
 * have returned LIVE for a call that was commented out, renamed, or applied to the wrong body, and it
 * occupied a slot in a number that may never fall. Same shape as `healsAllyOnSwitchIn` before it.
 *
 * BEHAVIOURAL, TWO ARMS, AND THE OUTCOME RATHER THAN THE BRACKET. Grimmsnarl (base 60 Speed) is
 * SLOWER than Weavile (base 125), so a 0-priority Reflect goes up AFTER the hit it is meant to blunt
 * and does nothing to it. +1 from Prankster is the only thing that can put it in front, and the
 * receipt is the DAMAGE the user takes on that same turn — halved if the screen landed first.
 *
 * The comment at medicham2's own sort names this exact case ("a Prankster screen went up AFTER the
 * attack it was meant to blunt"), so the probe is staged on the case the wire claims to fix. */
probe('ability', 'priorityMod', 'Prankster puts a status move in front of a faster foe', () => {
  const run = (ab) => {
    /* `board()` and PASS2 are declared further down this file and are in their temporal dead zone
     * here, so the staging is written out — the same call healsAllyOnSwitchIn already makes. */
    const me = bare('grimmsnarl'), ally = bare('incineroar');
    const f1 = bare('weavile'), f2 = bare('garchomp');
    me.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'reflect', null, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'iciclecrash', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  /* S.lastActs IS NOT THE RESOLUTION ORDER and is deliberately not read here: medicham2 writes it
   * from `acts` BEFORE the sort, so it records what was committed, not who went first. A probe that
   * printed it would print the same name in both arms and look like a dead knob. The damage is the
   * receipt. x0.667, not x0.5 — doubles screens. */
  const off = run('none'), on = run('prankster');
  return { works: off > 0 && on > 0 && on < off,
           detail: `Icicle Crash into the Reflect user: ability none ${off}, Prankster ${on} `
                 + `(the doubles screen is x0.667, so ${off} -> ${Math.floor(off * 2732 / 4096)} is the screen landing first)` };
});

probe('ability', 'damageBoost', 'Aerilate converts and boosts', () => {
  const on = bare('staraptor'), off = bare('staraptor');
  on.ability = 'aerilate';
  const def = bare('garchomp'), mv = MC.moves['bodyslam'];
  const a = M.dmgRange(off, def, mv, fresh(), false);
  const b = M.dmgRange(on, def, mv, fresh(), false);
  return { works: b.max !== a.max, detail: `none ${a.max}  ->  aerilate ${b.max}` };
});

probe('ability', 'damageReduce', 'Filter cuts super-effective damage', () => {
  const atk = bare('garchomp');
  const off = bare('charizard'), on = bare('charizard');
  on.ability = 'filter';
  const mv = MC.moves['stoneedge'] || MC.moves['rockslide'];
  const a = M.dmgRange(atk, off, mv, fresh(), false);
  const b = M.dmgRange(atk, on, mv, fresh(), false);
  return { works: b.max < a.max, detail: `none ${a.max}  ->  filter ${b.max}` };
});

probe('ability', 'damageReduce', 'Ice Scales halves special damage', () => {
  const atk = bare('garchomp');
  const off = bare('milotic'), on = bare('milotic');
  on.ability = 'icescales';
  const mv = MC.moves['earthpower'] || MC.moves['hydropump'];
  const a = M.dmgRange(atk, off, mv, fresh(), false);
  const b = M.dmgRange(atk, on, mv, fresh(), false);
  return { works: b.max < a.max, detail: `none ${a.max}  ->  icescales ${b.max}` };
});

probe('ability', 'statusImmune', 'Insomnia refuses sleep', () => {
  const m = bare('gholdengo'); m.ability = 'insomnia';
  M.applyStatus(m, 'slp');
  return { works: m.status !== 'slp', detail: 'status=' + (m.status || 'none') };
});

/* ONE-ARMED UNTIL 2026-08-04, AND FOUND BY THE IDENTICAL-ARMS SCAN AT THE BOTTOM OF THIS FILE. It read
 * `atk 0 -> 0` and called that a refusal — which is also what an engine with no Intimidate at all
 * prints. Exactly the shape that made the Disable probe a false LIVE. */
probe('ability', 'preventsStatDrop', 'Clear Body refuses Intimidate', () => {
  const run = (ab) => { const m = bare('garchomp'); m.ability = ab; M.applyIntimidate(m); return m.boosts.at; };
  const off = run('none'), on = run('clearbody');
  return { works: off < 0 && on === 0, detail: `atk stage after Intimidate: ability none ${off}, Clear Body ${on}` };
});

probe('ability', 'boostsWhenLowered', 'Defiant raises Attack when dropped', () => {
  const m = bare('kingambit'); m.ability = 'defiant';
  M.applyIntimidate(m);
  return { works: m.boosts.at > 0, detail: 'atk stage ' + m.boosts.at };
});

probe('ability', 'contactPunish', 'Rough Skin hurts a contact attacker', () => {
  const run = (ab) => {
    const me = bare('staraptor'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    f1.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]);
    const before = me.curHP;
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const none = run('none'), rough = run('roughskin');
  return { works: rough > none, detail: `attacker lost ${none} vs none, ${rough} vs Rough Skin` };
});

probe('ability', 'formeChange', 'Zero to Hero upgrades Palafin on return', () => {
  /* THE RULE HAS TWO HALVES AND THE NEGATIVE ONE IS THE ONE THAT PROVES IT. Will: "PALAFIN GOTTA
   * BE SENT OUT FIRST AND THEN SWITCH AND COME BACK TO ACTIVATE". So a Palafin arriving from the
   * bench for the FIRST time must stay ordinary -- a transform that fires on any entry would pass
   * a test that only checks it fires, while being wrong in every game.
   *
   * Both halves are asserted here: first entry does nothing, the return upgrades. */
  const firstEntry = (() => {
    const bench = M.buildMon('palafin', {}); bench.ability = 'zerotohero';
    const lead = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([lead, ally, bench], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[lead, { kind: 'switch', to: bench }], [ally, { kind: 'pass' }]]), null);
    return { name: bench.name, atk: bench.st.at };
  })();

  const me = M.buildMon('palafin', {}); me.ability = 'zerotohero';
  const ally = bare('incineroar'), back = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally, back], [f1, f2], { seeded: true });
  const atkBefore = me.st.at;
  M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: back }], [ally, { kind: 'pass' }]]), null);
  M.battleTurn(S, rng5, new Map([[back, { kind: 'switch', to: me }], [ally, { kind: 'pass' }]]), null);

  const firstStayedBase = firstEntry.name === 'palafin' && firstEntry.atk === atkBefore;
  const returnUpgraded = me.st.at > atkBefore;
  return { works: firstStayedBase && returnUpgraded,
           detail: 'first entry from bench: ' + firstEntry.name + ' ' + firstEntry.atk + ' Atk (must stay base)'
                 + '  |  out and back: ' + me.name + ' ' + me.st.at + ' Atk' };
});

/* ---- BATCH 2 — the next sixteen by corpus usage ------------------------------------------------
 *
 * Ordered by tests/mechanics_rank.js, which ranks by the clicks a tag covers rather than the number
 * of ids carrying it. Every probe here follows the four rules the first batch cost us: clear the
 * control explicitly; never apply the effect yourself; test the OUTCOME and not the classification;
 * and treat identical results across a varied knob as proof the knob is not wired.
 */

probe('move', 'neverMissesAttack', 'Aura Sphere cannot miss', () => {
  const acc = M.moveAccuracy('aurasphere', fresh());
  return { works: acc >= 100, detail: 'accuracy=' + acc };
});

probe('move', 'inflictsFreeze', 'Ice Beam can freeze', () => {
  /* A 10% secondary, so the roll is forced LOW. At rng 0.5 it would never fire and the probe would
   * report MISSING on a mechanic that works -- the same class of staging error as having the target
   * Protect on the turn it was meant to be Encored. */
  /* THE TARGET HAS TO SURVIVE THE HIT. The first version fired Ice Beam at Garchomp -- 4x on
   * Dragon/Ground -- which knocked it out, and a fainted Pokemon takes no status. The probe read
   * 'none' and blamed the engine. Corviknight resists Ice and lives. */
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('corviknight'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'icebeam', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, () => 0.01, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.status === 'frz',
           detail: 'target ' + (f1.fainted ? 'FAINTED' : 'survived at ' + f1.curHP) + ', status: ' + (f1.status || 'none') };
});

probe('move', 'inflictsPoison', 'Toxic poisons', () => {
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'toxic', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: /psn|tox/.test(f1.status || ''), detail: 'target status: ' + (f1.status || 'none') };
});

probe('move', 'inflictsConfusion', 'Confuse Ray confuses', () => {
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'confuseray', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: !!(f1._vol && f1._vol.confusion), detail: 'volatiles on target: ' + JSON.stringify(f1._vol || {}) };
});

probe('move', 'oneTurnGuard', 'Wide Guard blocks a spread move', () => {
  const run = (guard) => {
    /* THE ALLY MUST BE ABLE TO TAKE THE MOVE. The first version used Corviknight, which is
     * Flying and immune to Earthquake -- so the probe read 0 damage with and without the guard
     * and reported a working mechanic as missing. Milotic has no Ground immunity. */
    const me = bare('incineroar'), ally = bare('milotic');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, guard ? M.playerAction(me, 'wideguard', null, S.field) : { kind: 'pass' }],
                        [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]);
    const before = ally.curHP;
    M.battleTurn(S, rng5, fa, fb);
    return before - ally.curHP;
  };
  const off = run(false), on = run(true);
  return { works: on < off, detail: 'ally took ' + off + ' without  ->  ' + on + ' behind Wide Guard' };
});

probe('move', 'weightBased', 'Grass Knot scales with target weight', () => {
  const me = bare('venusaur');
  const light = bare('whimsicott'), heavy = bare('archaludon');
  const mv = MC.moves['grassknot'];
  if (!mv) return { works: false, detail: 'grassknot not in MC.moves' };
  const a = M.dmgRange(me, light, mv, fresh(), false);
  const b = M.dmgRange(me, heavy, mv, fresh(), false);
  return { works: a.max !== b.max, detail: 'vs light ' + a.max + '  ->  vs heavy ' + b.max };
});

probe('move', 'swapsStat', 'Body Press attacks with Defense', () => {
  /* Two identical bodies but for the stat that should matter. If Body Press reads Attack instead,
   * the high-Defense one deals the SAME damage -- that equality is the null result to look for. */
  const lowDef = bare('corviknight'), highDef = bare('corviknight');
  highDef.st = Object.assign({}, highDef.st, { df: highDef.st.df * 2 });
  const def = bare('garchomp'), mv = MC.moves['bodypress'];
  if (!mv) return { works: false, detail: 'bodypress not in MC.moves' };
  const a = M.dmgRange(lowDef, def, mv, fresh(), false);
  const b = M.dmgRange(highDef, def, mv, fresh(), false);
  return { works: b.max > a.max,
           detail: 'def ' + lowDef.st.df + ' deals ' + a.max + ', def ' + highDef.st.df + ' deals ' + b.max };
});

probe('move', 'ignoresStatStages', 'Sacred Sword ignores a Defense boost', () => {
  const atk = bare('garchomp');
  const plain = bare('corviknight'), boosted = bare('corviknight');
  boosted.boosts.df = 4;
  const mv = MC.moves['sacredsword'];
  if (!mv) return { works: false, detail: 'sacredsword not in MC.moves' };
  const a = M.dmgRange(atk, plain, mv, fresh(), false);
  const b = M.dmgRange(atk, boosted, mv, fresh(), false);
  return { works: a.max === b.max, detail: 'unboosted ' + a.max + ' vs +4 Def ' + b.max + ' (equal = ignored)' };
});

probe('move', 'readsTargetItem', 'Knock Off removes the item', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  f1.item = 'lifeorb';
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: !f1.item, detail: 'target item after Knock Off: ' + JSON.stringify(f1.item || '') };
});

probe('move', 'healsAlly', 'Life Dew heals the partner', () => {
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  ally.curHP = Math.floor(ally.st.hp / 2);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const before = ally.curHP;
  const fa = new Map([[me, M.playerAction(me, 'lifedew', null, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: ally.curHP > before, detail: 'partner ' + before + ' -> ' + ally.curHP + ' hp' };
});

probe('ability', 'stabBoost', 'Adaptability raises same-type damage', () => {
  const on = bare('basculegion'), off = bare('basculegion');
  on.ability = 'adaptability';
  const def = bare('garchomp');
  const mv = MC.moves['wavecrash'] || MC.moves['surf'] || MC.moves['liquidation'];
  if (!mv) return { works: false, detail: 'no water move in MC.moves' };
  const a = M.dmgRange(off, def, mv, fresh(), false);
  const b = M.dmgRange(on, def, mv, fresh(), false);
  return { works: b.max > a.max, detail: 'none ' + a.max + '  ->  adaptability ' + b.max };
});

probe('ability', 'speedCond', 'Chlorophyll doubles Speed in sun', () => {
  const m = bare('venusaur'); m.ability = 'chlorophyll';
  const dry = M.effSpeed(m, Object.assign(fresh(), { weather: '' }), 'A');
  const sun = M.effSpeed(m, Object.assign(fresh(), { weather: 'sun' }), 'A');
  return { works: sun > dry * 1.8, detail: 'no sun ' + dry + '  ->  sun ' + sun };
});

/* ONE-ARMED UNTIL 2026-08-04, AND FOUND BY THE IDENTICAL-ARMS SCAN AT THE BOTTOM OF THIS FILE. It read
 * `target atk stage after Charm: 0 (0 = refused)` — and 0 is also what an engine that never applied
 * Charm at all would print. The control is the same board with the ability off, and it must show the
 * drop landing, or "refused" is indistinguishable from "never happened". */
probe('ability', 'blocksStatusMoves', 'Good as Gold refuses a status move', () => {
  const run = (ab) => {
    const me = bare('whimsicott'), ally = bare('incineroar');
    const f1 = bare('gholdengo'), f2 = bare('garchomp');
    f1.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, 'charm', f1, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return f1.boosts.at;
  };
  const off = run('none'), on = run('goodasgold');
  return { works: off < 0 && on === 0,
           detail: 'target atk stage after Charm: ability none ' + off + ', Good as Gold ' + on + ' (0 = refused)' };
});

/* THIS PROBE WAS HOLLOW AND IT WAS MASKING A DEAD WIRE, which is the worse of the two outcomes.
 *
 * It read `/icebody|weatherChipImmune|magmaarmor/.test(src)` and passed on the word `magmaarmor` —
 * which appears in this engine ONCE, inside the FREEZE-immunity table at medicham2:1097, and has
 * nothing whatever to do with weather. So the census reported an immunity as LIVE while the thing it
 * is immune TO did not exist: the engine applied burn, poison, Toxic and Leech Seed at end of turn
 * and NO sandstorm residual at all. Sand is 1,705 Sand Stream sheets and 6,167 sandstorm events.
 *
 * THREE ARMS, because two cannot tell an immunity from an absent mechanic. The chip must LAND on a
 * plain body, be REFUSED by the ability, and be refused by a Rock/Ground/Steel TYPE with no ability
 * at all — the last is the half CLAUDE.md already states ("Bring Steels against Tyranitar sand").
 *
 * SNOW IS NOT A CHIP IN THIS GENERATION. Snowscape replaced Hail and deals no residual damage, so a
 * fourth arm asserts snow costs the same body nothing; an engine that chipped in snow would be a new
 * wrong number rather than a wired mechanic. */
probe('ability', 'weatherChipImmune', 'sandstorm chips, and Sand Veil / a Steel type ignore it', () => {
  const run = (ab, sp, wx) => {
    const me = bare(sp), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    me.ability = ab;
    me.curHP = Math.floor(me.st.hp / 2);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    S.field.weather = wx;
    const before = me.curHP;
    const pass2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, pass2(me, ally), pass2(f1, f2));
    return { d: before - me.curHP, sixteenth: Math.floor(me.st.hp / 16) };
  };
  const plain = run('none', 'milotic', 'sand');
  const veil = run('sandveil', 'milotic', 'sand');
  const steel = run('none', 'archaludon', 'sand');
  const snow = run('none', 'milotic', 'snow');
  return { works: plain.d === plain.sixteenth && veil.d === 0 && steel.d === 0 && snow.d === 0,
           detail: `sand, Milotic: ability none -${plain.d} (a sixteenth is ${plain.sixteenth}), `
                 + `Sand Veil -${veil.d}; sand, Archaludon (Steel) -${steel.d}; snow, Milotic -${snow.d}` };
});

probe('ability', 'speedOnItemLoss', 'Unburden doubles Speed once the item is gone', () => {
  /* THROUGH battleInit, because that is where the engine stamps what each body STARTED holding --
   * the flag that distinguishes 'lost its item' from 'never had one'. The first version called
   * effSpeed on a loose body, so the flag was undefined and the probe reported the engine broken
   * while measuring its own shortcut. */
  const m = bare('weavile'); m.ability = 'unburden'; m.item = 'focussash';
  const ally = bare('incineroar'), f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([m, ally], [f1, f2], { seeded: true });
  const held = M.effSpeed(m, S.field, 'A');
  m.item = '';                                     // the Sash is spent
  const gone = M.effSpeed(m, S.field, 'A');
  return { works: gone > held * 1.8, detail: 'holding ' + held + '  ->  item gone ' + gone };
});

probe('move', 'takesTargetItem', 'Covet steals the item', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  f1.item = 'lifeorb'; me.item = '';
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const act = M.playerAction(me, 'covet', f1, S.field);
  if (!act || act.kind === 'pass') return { works: false, detail: 'covet resolves to kind ' + (act && act.kind) };
  M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: me.item === 'lifeorb',
           detail: 'attacker item ' + JSON.stringify(me.item) + ', target item ' + JSON.stringify(f1.item) };
});


/* ---- BATCH 3 — the next by corpus usage -------------------------------------------------------
 *
 * Written while an R4 self-play run was in flight, which is why nothing here touches the engine:
 * a probe reads, it does not change, so the run keeps measuring the build it started on.
 */

probe('move', 'setsWeather', 'Sandstorm sets the weather', () => {
  const me = bare('tyranitar'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  S.field.weather = '';
  const fa = new Map([[me, M.playerAction(me, 'sandstorm', null, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: !!S.field.weather, detail: 'weather after the turn: ' + (S.field.weather || 'none') };
});

probe('move', 'inflictsSleep', 'Spore puts the target to sleep', () => {
  const me = bare('venusaur'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const mv = MC.moves['spore'] ? 'spore' : 'sleeppowder';
  const fa = new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: f1.status === 'slp', detail: mv + ' -> target status: ' + (f1.status || 'none') };
});

probe('move', 'forbidsStatusMoves', 'Taunt stops the target using a status move', () => {
  /* Staged like the Encore probe: the target is Taunted, then left FREE, and what it picks is the
   * measurement. Checking only that the volatile was recorded would pass on a Taunt nothing reads. */
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('whimsicott'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'taunt', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const tainted = !!(f1._vol && f1._vol.taunt);
  M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]), null);
  const picked = f1._lastMove || '';
  const isStatus = picked && MC.moves[picked] && !MC.moves[picked].bp;
  return { works: tainted && !isStatus,
           detail: 'volatile=' + tainted + ', free choice was ' + (picked || 'nothing') };
});

probe('move', 'ignoresProtect', 'Feint goes through Protect', () => {
  const run = (mv) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, M.playerAction(f1, 'protect', null, S.field)], [f2, { kind: 'pass' }]]);
    const before = f1.curHP;
    M.battleTurn(S, rng5, fa, fb);
    return before - f1.curHP;
  };
  if (!MC.moves['feint']) return { works: false, detail: 'feint not in MC.moves' };
  const blocked = run('bulletpunch'), through = run('feint');
  return { works: through > 0 && blocked === 0,
           detail: 'a normal move into Protect dealt ' + blocked + ', Feint dealt ' + through };
});

probe('move', 'recharge', 'Giga Impact costs the following turn', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const mv = MC.moves['gigaimpact'] ? 'gigaimpact' : 'hyperbeam';
  if (!MC.moves[mv]) return { works: false, detail: 'no recharge move in MC.moves' };
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const hpAfterFirst = f1.curHP;
  /* Turn two: the RECHARGING USER is left free and everyone else is pinned to a pass. The first
   * version passed `null` for the whole side, which left the ALLY free too -- so Corviknight clicked
   * Brave Bird into the same target and the probe measured the partner's attack, not the recharge.
   * A control arm that can move the number for a reason the probe is not about is not a control. */
  M.battleTurn(S, rng5, new Map([[ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const spent = f1.curHP === hpAfterFirst;
  /* ARMED, 2026-08-04, with the SAME staging and a move that does NOT recharge. `83 -> 83` on its own
   * is also what a free turn prints when the chooser happens to pick a status move. */
  const ctl = (() => {
    const a1 = bare('incineroar'), a2 = bare('corviknight');
    const b1 = bare('garchomp'), b2 = bare('garchomp');
    const S2 = M.battleInit([a1, a2], [b1, b2], { seeded: true });
    M.battleTurn(S2, rng5,
      new Map([[a1, M.playerAction(a1, 'flareblitz', b1, S2.field)], [a2, { kind: 'pass' }]]),
      new Map([[b1, { kind: 'pass' }], [b2, { kind: 'pass' }]]));
    const h = b1.curHP;
    M.battleTurn(S2, rng5, new Map([[a2, { kind: 'pass' }]]),
      new Map([[b1, { kind: 'pass' }], [b2, { kind: 'pass' }]]));
    return b1.curHP === h;
  })();
  return { works: spent && !ctl, arms: { control: ctl, test: spent },
           detail: 'after Flare Blitz (no recharge) the free turn did nothing: ' + ctl
                 + ';  after ' + mv + ' the free turn did nothing: ' + spent
                 + '   (foe hp ' + hpAfterFirst + ' then ' + f1.curHP + ')' };
});

probe('move', 'needsTargetToAttack', 'Avalanche doubles after being hit', () => {
  const mv = MC.moves['avalanche'];
  if (!mv) return { works: false, detail: 'avalanche not in MC.moves' };
  const fresh1 = bare('corviknight'), hurt = bare('corviknight');
  hurt.curHP = Math.floor(hurt.st.hp / 2);
  const def = bare('garchomp');
  const a = M.dmgRange(fresh1, def, mv, fresh(), false);
  const b = M.dmgRange(hurt, def, mv, fresh(), false);
  return { works: b.max > a.max, detail: 'untouched ' + a.max + '  ->  already hit ' + b.max };
});

probe('move', 'needsUntrackedState', 'Gyro Ball scales with the speed gap', () => {
  const mv = MC.moves['gyroball'];
  if (!mv) return { works: false, detail: 'gyroball not in MC.moves' };
  const slow = bare('archaludon'), fast = bare('weavile');
  const def = bare('garchomp');
  const a = M.dmgRange(slow, def, mv, fresh(), false);
  const b = M.dmgRange(fast, def, mv, fresh(), false);
  return { works: a.max !== b.max, detail: 'slow user ' + a.max + '  vs  fast user ' + b.max };
});

probe('ability', 'redirectsType', 'Lightning Rod pulls an Electric move', () => {
  /* THE AIMED TARGET WAS GARCHOMP, WHICH IS GROUND AND IMMUNE TO ELECTRIC. So "aimed target took 0"
   * was true no matter what the ability did, and the probe could have passed its own headline claim
   * on a completely absent mechanic. Corviknight is Flying/Steel and takes Electric at 2x, so the
   * zero now means something. Same defect as the Follow Me probe next door, and found by the same
   * question: which of these zeros did I build in myself.
   *
   * A CONTROL ARM as well, so "the rod did not pull" cannot be confused with "the move did nothing". */
  const run = (ab) => {
    const me = bare('raichu'), ally = bare('incineroar');
    const f1 = bare('corviknight'), f2 = bare('milotic');
    f2.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const before1 = f1.curHP, before2 = f2.curHP;
    const fa = new Map([[me, M.playerAction(me, 'thunderbolt', f1, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { aimed: before1 - f1.curHP, rod: before2 - f2.curHP, spa: f2.boosts.sa };
  };
  const off = run('none'), on = run('lightningrod');
  /* THE ROD HOLDER MUST TAKE ZERO, AND THE FIRST VERSION DEMANDED IT TAKE DAMAGE. Lightning Rod
   * both DRAWS the move and ABSORBS it -- the artifact says so in one line, `typeImmunity` with a
   * `gain` of +1 SpA sitting beside `redirectsType`. So "the rod holder took 101" would have been a
   * broken engine, and asserting it would have made the correct fix fail. What proves the draw is
   * that the AIMED target stops taking the hit while the holder's Special Attack goes up: the boost
   * is the receipt. Eighth probe in this file to be corrected before the engine was. */
  return { works: off.aimed > 0 && on.aimed === 0 && on.rod === 0 && on.spa > 0,
           detail: 'no ability: aimed ' + off.aimed + ' / other ' + off.rod + ' / spa ' + off.spa
                 + '   |   Lightning Rod: aimed ' + on.aimed + ' / rod ' + on.rod + ' / spa ' + on.spa };
});

/* THIS PROBE USED TO BE A SOURCE GREP — `/hospitality|healsAllyOnSwitchIn/.test(src)` — and it would
 * have returned LIVE for a mechanic that was commented out, renamed, or wired to the wrong body. A
 * census entry that reads the FILE rather than the BEHAVIOUR is hollow, and hollow is worse than
 * missing because it occupies a slot in a number that may never fall. Two others of the same shape
 * are still LIVE-by-grep and are named in docs/ENGINE.md: `priorityMod` and `weatherChipImmune`.
 *
 * Behavioural now, both arms, and the partner is DAMAGED first — a full-HP partner reads 0 -> 0
 * whatever the engine does. The heal happens on ENTRY, so it is driven through a real switch rather
 * than by calling applyEntryEffects by hand. */
probe('ability', 'healsAllyOnSwitchIn', 'Hospitality heals the partner on entry', () => {
  const run = (ab) => {
    const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('sinistcha');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    bench.ability = ab;
    ally.curHP = Math.floor(ally.st.hp / 3);
    const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
    const before = ally.curHP;
    /* PASS2 is declared further down this file and is in its temporal dead zone here — written out
     * rather than moved, because moving a shared helper to satisfy one probe is how a census file
     * starts reordering itself around its newest entry. */
    M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: bench }], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { d: ally.curHP - before, quarter: Math.floor(ally.st.hp / 4) };
  };
  const off = run('none'), on = run('hospitality');
  return { works: off.d === 0 && on.d === on.quarter,
           detail: `partner hp change: ability none ${off.d}, Hospitality ${on.d} (a quarter is ${on.quarter})` };
});

/* THE LAST TWO SOURCE-GREP PROBES IN THIS FILE, NOW BEHAVIOURAL. Both reported MISSING, so they were
 * honest negatives rather than hollow LIVEs — but a probe that passes on a STRING would have flipped
 * to LIVE the day somebody typed `unnerve` into a comment, and `weatherChipImmune` is exactly how that
 * ends. The hollow check at the bottom of this file now asserts there are none left. */
probe('ability', 'blocksBerries', 'Unnerve stops the foe eating a berry', () => {
  const run = (ab) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('milotic'), f2 = bare('garchomp');
    me.ability = ab;
    /* The berry fires below half, so the holder is put there and the CONTROL must show it eating. */
    f1.item = 'sitrusberry'; f1.curHP = Math.floor(f1.st.hp / 3);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const before = f1.curHP;
    const pass2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, pass2(me, ally), pass2(f1, f2));
    return { d: f1.curHP - before, item: f1.item };
  };
  const off = run('none'), on = run('unnerve');
  return { works: off.d > 0 && on.d === 0 && on.item === 'sitrusberry',
           detail: `foe hp change: ability none +${off.d} (berry now ${JSON.stringify(off.item)}), `
                 + `Unnerve +${on.d} (berry now ${JSON.stringify(on.item)})` };
});

probe('ability', 'disablesAttacker', 'Cursed Body can disable the move that hit it', () => {
  /* THE CONTROL MUST REPEAT, the correction the Disable probe next door already carries. The first
   * version committed Dragon Claw and the free foe then picked Protect in BOTH arms, so "it did not
   * repeat" was the chooser's ordering and the probe could not have passed whatever the engine did.
   * Earthquake is what this body picks when left alone, so the no-ability arm repeats it.
   *
   * rng is pinned LOW because Cursed Body is a 30% roll: at rng5 (0.5) a faithful wire correctly does
   * nothing, and the probe would report a working engine as missing. */
  const run = (ab) => {
    const me = bare('milotic'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    me.ability = ab;
    const rngLow = () => 0.05;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const pass2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
    M.battleTurn(S, rngLow, pass2(me, ally),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    const hit = f1._lastMove;
    /* The foe is then left COMPLETELY FREE. A forced action bypasses chooseAction and would measure
     * the caller's obedience — the correction the Encore probe already carries. */
    M.battleTurn(S, rngLow, pass2(me, ally), new Map([[f2, { kind: 'pass' }]]));
    const rec = (S.lastActs || []).find(x => x.side === 'B');
    return { hit, then: rec && (rec.move || rec.kind), sealed: f1._sealed || null };
  };
  const off = run('none'), on = run('cursedbody');
  return { works: off.hit === 'earthquake' && off.then === 'earthquake' && on.then !== 'earthquake',
           detail: `foe hit with ${off.hit}; next free pick: ability none ${off.then}, `
                 + `Cursed Body ${on.then} (sealed=${JSON.stringify(on.sealed)})` };
});

probe('item', 'restoresStats', 'White Herb undoes a stat drop', () => {
  const m = bare('garchomp'); m.item = 'whiteherb';
  const ally = bare('incineroar'), f1 = bare('incineroar'), f2 = bare('garchomp');
  const S = M.battleInit([m, ally], [f1, f2], { seeded: true });
  M.applyIntimidate(m);
  const dropped = m.boosts.at;
  M.battleTurn(S, rng5, new Map([[m, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: dropped < 0 && m.boosts.at === 0,
           detail: 'dropped to ' + dropped + ', after the turn ' + m.boosts.at + ' (0 = restored)' };
});

probe('move', 'statChangeInCode', 'Belly Drum maxes Attack', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const mv = MC.moves['bellydrum'] ? 'bellydrum' : null;
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const act = M.playerAction(me, mv || 'bellydrum', null, S.field);
  if (!act || act.kind === 'pass') return { works: false, detail: 'belly drum resolves to kind ' + (act && act.kind) };
  const hpBefore = me.curHP;
  M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const test = [me.boosts.at, hpBefore - me.curHP];
  /* ARMED, 2026-08-04. `atk stage 6` alone cannot tell a working Belly Drum from a body that was
   * already at +6, and the HALF-HP COST is the other half of the move -- an engine that granted the
   * boost for free would be a new wrong number rather than a wired mechanic. Both are asserted, and
   * the control is the same body on the same turn with no click. */
  const control = (() => {
    const m2 = bare('incineroar'), a2 = bare('corviknight');
    const g1 = bare('garchomp'), g2 = bare('garchomp');
    const S2 = M.battleInit([m2, a2], [g1, g2], { seeded: true });
    const h = m2.curHP;
    M.battleTurn(S2, rng5, new Map([[m2, { kind: 'pass' }], [a2, { kind: 'pass' }]]),
      new Map([[g1, { kind: 'pass' }], [g2, { kind: 'pass' }]]));
    return [m2.boosts.at, h - m2.curHP];
  })();
  return { works: test[0] >= 6 && test[1] === Math.floor(me.st.hp / 2) && control[0] === 0,
           arms: { control, test },
           detail: 'no click: atk ' + control[0] + ' hp cost ' + control[1]
                 + ';  Belly Drum: atk ' + test[0] + ' (needs +6) hp cost ' + test[1]
                 + ' (half is ' + Math.floor(me.st.hp / 2) + ')' };
});

probe('move', 'proceduralStatus', 'Tri Attack can burn, freeze or paralyse', () => {
  const me = bare('gholdengo') , ally = bare('incineroar');
  const f1 = bare('corviknight'), f2 = bare('garchomp');
  const mv = MC.moves['triattack'];
  if (!mv) return { works: false, detail: 'triattack not in MC.moves' };
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map([[me, M.playerAction(me, 'triattack', f1, S.field)], [ally, { kind: 'pass' }]]);
  M.battleTurn(S, () => 0.01, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { works: !!f1.status, detail: 'target status with the roll forced low: ' + (f1.status || 'none') };
});

/* ---- BATCH 4 — the tag walk, in descending corpus usage ---------------------------------------
 *
 * 126 of 180 tags had never been probed. tests/mechanics_rank.js orders them by the clicks they
 * cover; this walks that order from the top and stops being useful somewhere below a thousand uses.
 *
 * PROBE FIRST, ALWAYS. Every probe here was written and RUN RED OR GREEN BEFORE anything was decided
 * about the engine, because a probe written after a fix tests the fix and not the mechanic. Several
 * of these came back green and that is a result too: unreferenced is not unimplemented, and the only
 * way to tell is to make the thing happen and look.
 *
 * Nothing in this batch touches engine source. A probe reads; it does not change.
 */

/* One standard doubles board, so the staging is identical across probes and a difference between two
 * arms is the varied knob and not the setup. seeded:true skips entry effects -- a probe that wants
 * Intimidate or Drizzle must ask for them, exactly like every other input here. */
const board = (meSp, allySp, f1Sp, f2Sp) => {
  const me = bare(meSp), ally = bare(allySp), f1 = bare(f1Sp), f2 = bare(f2Sp);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  return { me, ally, f1, f2, S };
};
const PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);

probe('move', 'priority', 'Bullet Punch moves before a faster foe', () => {
  /* THE OUTCOME, NOT THE BRACKET. Asking movePriority() what number it returns tests a lookup
   * table. This asks whether the slower Pokemon actually got there first, and the only way to see
   * that in damage is to make going first MATTER: the fast foe is left on 1 HP, so if the priority
   * move lands first the foe never acts and the user takes nothing. */
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('archaludon', 'incineroar', 'weavile', 'garchomp');
    f1.curHP = 1;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'closecombat', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const normal = run('ironhead'), prio = run('bulletpunch');
  return { works: normal > 0 && prio === 0,
           detail: 'slow user took ' + normal + ' with a 0-priority move, ' + prio + ' with Bullet Punch' };
});

probe('move', 'contact', 'a contact move triggers Rough Skin and a special one does not', () => {
  /* BOTH DIRECTIONS. A probe that only checks Close Combat gets punished would pass on an engine
   * that punished EVERY move, which is the more likely bug. */
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    f1.ability = 'roughskin';
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - me.curHP;
  };
  const touch = run('closecombat'), noTouch = run('flamethrower');
  return { works: touch > 0 && noTouch === 0,
           detail: 'contact move cost the user ' + touch + ', special non-contact cost ' + noTouch };
});

probe('move', 'spreadFoes', 'Rock Slide hits both foes', () => {
  const { me, ally, f1, f2, S } = board('tyranitar', 'incineroar', 'garchomp', 'milotic');
  const b1 = f1.curHP, b2 = f2.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'rockslide', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (b1 - f1.curHP) > 0 && (b2 - f2.curHP) > 0,
           detail: 'aimed foe took ' + (b1 - f1.curHP) + ', the OTHER foe took ' + (b2 - f2.curHP) };
});

probe('move', 'spreadAll', 'Earthquake hits your own partner too', () => {
  const { me, ally, f1, f2, S } = board('garchomp', 'milotic', 'incineroar', 'incineroar');
  const bAlly = ally.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (bAlly - ally.curHP) > 0,
           detail: 'own partner (Milotic, no Ground immunity) took ' + (bAlly - ally.curHP) };
});

probe('move', 'weatherScaled', 'Blizzard cannot miss in snow', () => {
  const dry = M.moveAccuracy('blizzard', fresh());
  const snow = M.moveAccuracy('blizzard', Object.assign(fresh(), { weather: 'snow' }));
  return { works: snow >= 100 && dry < 100, detail: 'no weather ' + dry + '  ->  snow ' + snow };
});

probe('move', 'thawsTarget', 'Flare Blitz thaws a frozen target', () => {
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  f1.status = 'frz';                                   // Garchomp resists Fire, so it survives to be looked at
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'flareblitz', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: !f1.fainted && f1.status !== 'frz',
           detail: 'target ' + (f1.fainted ? 'FAINTED' : 'survived') + ', status now ' + (f1.status || 'none') };
});

probe('item', 'survivesFromFull', 'Focus Sash leaves 1 HP from full', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('garchomp', 'incineroar', 'alakazam', 'garchomp');
    f1.item = item;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { hp: f1.curHP, dead: !!f1.fainted };
  };
  const none = run(''), sash = run('focussash');
  return { works: none.dead && !sash.dead && sash.hp === 1,
           detail: 'no item: ' + (none.dead ? 'FAINTED' : none.hp + ' hp') + '  ->  Sash: '
                 + (sash.dead ? 'FAINTED' : sash.hp + ' hp') };
});

probe('item', 'healsAtThreshold', 'Sitrus Berry heals when it drops below half', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'corviknight', 'garchomp');
    f1.item = item; f1.curHP = Math.floor(f1.st.hp * 0.55);
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'surf', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.curHP;
  };
  const none = run(''), berry = run('sitrusberry');
  return { works: berry > none, detail: 'no item ended on ' + none + ' hp  ->  Sitrus ended on ' + berry };
});

probe('item', 'resistBerry', 'Chople Berry halves a super-effective Fighting hit', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'kingambit', 'garchomp');
    f1.item = item; f1.curHP = f1.st.hp;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run(''), berry = run('chopleberry');
  return { works: berry < none, detail: 'no item took ' + none + '  ->  Chople took ' + berry };
});

probe('item', 'damageMultAll', 'Life Orb raises damage', () => {
  const on = bare('incineroar'), off = bare('incineroar');
  on.item = 'lifeorb';
  const def = bare('garchomp');
  const a = M.dmgRange(off, def, MC.moves['closecombat'], fresh(), false);
  const b = M.dmgRange(on, def, MC.moves['closecombat'], fresh(), false);
  return { works: b.max > a.max, detail: 'no item ' + a.max + '  ->  Life Orb ' + b.max };
});

probe('item', 'damageMultType', 'Black Glasses raises Dark damage only', () => {
  /* THE SECOND ARM IS THE ONE THAT MATTERS. An item that raised every move would pass a probe that
   * only looked at Crunch, and would be a worse bug than doing nothing. */
  const on = bare('incineroar'), off = bare('incineroar');
  on.item = 'blackglasses';
  const def = bare('garchomp');
  const dk = (m) => M.dmgRange(m, def, MC.moves['crunch'], fresh(), false).max;
  const fi = (m) => M.dmgRange(m, def, MC.moves['closecombat'], fresh(), false).max;
  return { works: dk(on) > dk(off) && fi(on) === fi(off),
           detail: 'Dark ' + dk(off) + '->' + dk(on) + ', Fighting ' + fi(off) + '->' + fi(on) + ' (must not move)' };
});

probe('move', 'doublesSideSpeed', 'Tailwind doubles the side Speed', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
  const before = M.effSpeed(ally, S.field, 'A');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'tailwind', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const after = M.effSpeed(ally, S.field, 'A');
  return { works: after > before * 1.8, detail: 'partner speed ' + before + '  ->  ' + after };
});

probe('move', 'sealsMoves', 'Disable stops the target repeating that move', () => {
  /* Staged like Encore and Taunt: the foe commits a move on its own, is Disabled, and is then left
   * COMPLETELY FREE. What it picks is the measurement. Checking the volatile alone would pass on a
   * Disable nothing reads.
   *
   * THIS PROBE WAS A FALSE LIVE FOR AS LONG AS IT EXISTED, and it is the exact failure the header of
   * this file warns about. It ran ONE arm: the foe committed Rock Slide, was Disabled, chose freely
   * and picked Earthquake, and the probe called the mechanic live. Run the same sequence with the
   * Disable click REMOVED and the foe picks Earthquake anyway -- the engine read `_vol.disable`
   * nowhere. Identical results across a varied knob mean the knob is unwired, not that it does not
   * matter, and a one-armed probe cannot tell the difference. Both arms are printed now. */
  /* THE CONTROL MUST REPEAT, or "it picked something else" is the chooser's ordering rather than the
   * seal. Earthquake is what this body picks when left alone, so committing Earthquake makes the
   * no-Disable arm repeat it and the assertion says something. Rock Slide — the original staging —
   * is exactly the move the control does NOT repeat, which is why it read live while dead.
   *
   * READ FROM S.lastActs, NOT FROM _lastMove. `_lastMove` is not written by every action kind, so a
   * turn that produced a pass or a switch leaves yesterday's move sitting there and the probe reads a
   * repeat that never happened. `lastActs` is the engine's own record of what was clicked. */
  const run = (disable) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    const committed = f1._lastMove;
    M.battleTurn(S, rng5,
      new Map([[me, disable ? M.playerAction(me, 'disable', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    M.battleTurn(S, rng5, PASS2(me, ally), new Map([[f2, { kind: 'pass' }]]));
    const rec = (S.lastActs || []).find(x => x.side === 'B');
    return { committed, then: rec && (rec.move || rec.kind) };
  };
  const free = run(false), sealed = run(true);
  return { works: !!free.committed && free.then === free.committed && sealed.then !== sealed.committed,
           detail: 'committed ' + free.committed + '; free choice repeated ' + free.then
                 + ', after Disable it clicked ' + (sealed.then || 'nothing') };
});

/* THE WHOLE HEALING CLASS IS INVISIBLE TO THE DIFFERENTIAL, and this file is its only guard.
 *
 * `tests/test-engine-diff.js` compares ONE call to `moveHit` against one call to `dmgRange` — a
 * single-hit DAMAGE number. Healing is HP over turns: a drain's return, a Leftovers tick, a pinch
 * berry, Regenerator on the way out, and Heal Block stopping all four. None of it changes the damage
 * roll the differential reads, so a residual of 1/400 says nothing whatever about this class. Same
 * statement as `multiHit` carries, and for the same structural reason.
 *
 * The class, with its corpus weight: sitrusberry 11,163 · leftovers 6,483 · hospitality 5,025 ·
 * matchagotcha 4,991 · lifedew 2,252 · roost 2,007 · gigadrain 1,259 · drainpunch 918 ·
 * regenerator 845 · drainingkiss 816 · strengthsap 630 · recover 572 · psychicnoise 196. */
probe('move', 'drain', 'Drain Punch heals the user', () => {
  /* THE DAMAGE DEALT IS PRINTED TOO. A drain that healed nothing and a move that never landed look
   * identical from the user's HP alone, and only one of them is an engine gap. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  me.curHP = Math.floor(me.st.hp / 2);
  const before = me.curHP, foeBefore = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'drainpunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: me.curHP > before,
           detail: 'move dealt ' + (foeBefore - f1.curHP) + ' to the foe; user ' + before + ' -> ' + me.curHP + ' hp' };
});

probe('move', 'redirects', 'Follow Me pulls the attack onto the partner', () => {
  /* THE FIRST VERSION AIMED ROCK SLIDE, WHICH IS A SPREAD MOVE. It hits both targets by design, so
   * both bodies took damage and the probe called a redirect broken while measuring its own staging.
   * Sixteenth time a probe in this project was wrong before the engine was; the tell was that the
   * "aimed" target and the "redirected" one BOTH took a number. Dragon Claw is single-target. */
  /* TWO ARMS, because the one-armed version read 0 and 0 and could not say which of three things
   * happened: the redirect worked and the hit vanished, the redirect did nothing and the hit
   * vanished, or the move never resolved at all. The no-Follow-Me arm settles it.
   *
   * THE REDIRECTOR MUST NOT BE IMMUNE TO THE MOVE, and getting that wrong nearly cost an engine
   * "fix" to a mechanic that works. The two-arm version used WHIMSICOTT, which is Grass/FAIRY, and
   * aimed DRAGON Claw at it: the redirect fired correctly, pulled the attack off Incineroar, and
   * landed it on a body that takes exactly zero from Dragon. Both arms read 0, and it was written up
   * as "the attack VANISHES — the worst bug in the repo". It is not a bug at all. Milotic is pure
   * Water and takes Dragon neutrally, and the same staging then reads aimed 0 / redirector 101.
   *
   * That is the seventh probe in this file to be wrong before the engine was, and the first to have
   * been believed. Lesson 5, and the reason a red probe is a QUESTION and not a finding. */
  const run = (useFollowMe) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'milotic', 'garchomp', 'garchomp');
    const bMe = me.curHP, bAlly = ally.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, { kind: 'pass' }],
               [ally, useFollowMe ? M.playerAction(ally, 'followme', null, S.field) : { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'dragonclaw', me, S.field)], [f2, { kind: 'pass' }]]));
    return { aimed: bMe - me.curHP, guard: bAlly - ally.curHP };
  };
  const off = run(false), on = run(true);
  return { works: off.aimed > 0 && on.guard > 0 && on.aimed === 0,
           detail: 'no Follow Me: aimed ' + off.aimed + ' / partner ' + off.guard
                 + '   |   Follow Me: aimed ' + on.aimed + ' / partner ' + on.guard };
});

probe('move', 'powder', 'Sleep Powder fails into a Grass type', () => {
  const run = (foeSp) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', foeSp, 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'sleeppowder', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  const normal = run('garchomp'), grass = run('venusaur');
  return { works: normal === 'slp' && grass !== 'slp',
           detail: 'into Garchomp: ' + normal + ', into Venusaur (Grass): ' + grass };
});

probe('move', 'halvesDamage', 'Reflect halves physical damage', () => {
  const run = (screen) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, screen ? M.playerAction(me, 'reflect', null, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    me.curHP = me.st.hp;
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const off = run(false), on = run(true);
  return { works: on < off, detail: 'took ' + off + ' with no screen  ->  ' + on + ' behind Reflect' };
});

probe('ability', 'weatherSetter', 'Drizzle sets rain on entry', () => {
  const run = (ab) => {
    const me = bare('pelipper'), ally = bare('incineroar');
    me.ability = ab;
    const S = M.battleInit([me, ally], [bare('garchomp'), bare('garchomp')], {});   // NOT seeded: entry effects fire
    return S.field.weather || 'none';
  };
  const none = run('none'), rain = run('drizzle');
  return { works: none === 'none' && rain === 'rain', detail: 'ability none -> ' + none + ', Drizzle -> ' + rain };
});

probe('move', 'pivotStatus', 'Parting Shot switches the user out', () => {
  const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('milotic');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'partingshot', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: S.actA.indexOf(bench) >= 0 && S.actA.indexOf(me) < 0,
           detail: 'active side A after the turn: ' + S.actA.map(x => x && x.name).join(', ') };
});

probe('move', 'pivotDamaging', 'U-turn damages and then switches the user out', () => {
  const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('milotic');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
  const before = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'uturn', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (before - f1.curHP) > 0 && S.actA.indexOf(bench) >= 0 && S.actA.indexOf(me) < 0,
           detail: 'foe took ' + (before - f1.curHP) + ', active side A: ' + S.actA.map(x => x && x.name).join(', ') };
});

probe('move', 'reversesSpeed', 'Trick Room lets the slow user move first', () => {
  /* Same shape as the priority probe -- the fast foe sits on 1 HP, so who moved first is visible in
   * whether the user took anything at all. The user's HP is restored between the setup turn and the
   * measured turn so the setup cannot contaminate the reading. */
  const run = (tr) => {
    const { me, ally, f1, f2, S } = board('archaludon', 'incineroar', 'weavile', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, tr ? M.playerAction(me, 'trickroom', null, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    me.curHP = me.st.hp; f1.curHP = 1;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'ironhead', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'closecombat', me, S.field)], [f2, { kind: 'pass' }]]));
    return { took: before - me.curHP, tr: S.field.tr };
  };
  const off = run(false), on = run(true);
  return { works: on.tr > 0 && off.took > 0 && on.took === 0,
           detail: 'field.tr=' + on.tr + '; slow user took ' + off.took + ' normally, ' + on.took + ' under Trick Room' };
});

/* ONE-ARMED UNTIL 2026-08-04, AND FOUND BY THE IDENTICAL-ARMS SCAN AT THE BOTTOM OF THIS FILE. "the
 * foe took 0" is also what an engine that could not resolve Fly AT ALL would print — a move dropped
 * to `kind: pass` reads exactly the same. The control is the SAME body clicking Brave Bird, which
 * must land, and the second turn is played so the charge is shown to FIRE rather than to vanish. */
probe('move', 'chargeTurn', 'Fly deals nothing on the turn it is clicked and lands on the next', () => {
  const run = (mv, turns) => {
    const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
    const before = f1.curHP; const out = [];
    for (let i = 0; i < turns; i++) {
      const hp = f1.curHP;
      M.battleTurn(S, rng5,
        new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
      out.push(hp - f1.curHP);
    }
    void before; return out;
  };
  const bird = run('bravebird', 1), fly = run('fly', 2);
  return { works: bird[0] > 0 && fly[0] === 0 && fly[1] > 0,
           detail: `Brave Bird turn 1 dealt ${bird[0]}; Fly dealt ${fly[0]} on the charge turn and ${fly[1]} on the next` };
});

probe('move', 'chargeSkippedByWeather', 'Solar Beam fires the same turn in sun and not otherwise', () => {
  const run = (weather) => {
    const { me, ally, f1, f2, S } = board('venusaur', 'incineroar', 'garchomp', 'garchomp');
    S.field.weather = weather;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'solarbeam', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const dry = run(''), sun = run('sun');
  return { works: sun > 0 && dry === 0,
           detail: 'turn-1 damage: no sun ' + dry + ' (must be 0), sun ' + sun + ' (must be > 0)' };
});

probe('move', 'failsIfTargetNotAttacking', 'Sucker Punch fails against a target that is not attacking', () => {
  const run = (foeAttacks) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'suckerpunch', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, foeAttacks ? M.playerAction(f1, 'earthquake', me, S.field) : { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return before - f1.curHP;
  };
  const attacking = run(true), idle = run(false);
  return { works: attacking > 0 && idle === 0,
           detail: 'foe attacking: ' + attacking + ', foe idle: ' + idle + ' (must be 0)' };
});

probe('item', 'choiceLock', 'Choice Scarf locks the holder into its first move', () => {
  /* THIS IS NOT "NOBODY IMPLEMENTED CHOICE LOCK". tests/test-choice-lock.js asserts it four ways and
   * passes -- on board.js, where B.candidates() removes the other moves from the SEARCH's action set.
   * MEDICHAM's battleTurn honours whatever action it is handed, so the rule exists on one engine and
   * not the other. That is CLAUDE.md's FACTS ARE GLOBAL rule broken: whether a Choice item locks you
   * is a fact about the game, and two engines that disagree about it will keep disagreeing invisibly,
   * because each keeps working. The probe stays red until MEDICHAM enforces it too. */
  const { me, ally, f1, f2, S } = board('basculegion', 'incineroar', 'garchomp', 'garchomp');
  me.item = 'choicescarf';
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'crunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const first = me._lastMove;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: first === 'crunch' && me._lastMove === 'crunch',
           detail: 'turn 1 used ' + first + ', turn 2 asked for closecombat and used ' + me._lastMove };
});

probe('move', 'healsSelf', 'Recover restores the user', () => {
  const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'garchomp', 'garchomp');
  me.curHP = Math.floor(me.st.hp / 3);
  const before = me.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'recover', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: me.curHP > before, detail: 'user ' + before + ' -> ' + me.curHP + ' hp' };
});

probe('ability', 'blocksMove', 'Armor Tail refuses a priority move', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'farigiraf', 'garchomp');
    f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'bulletpunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run('none'), tail = run('armortail');
  return { works: none > 0 && tail === 0, detail: 'no ability took ' + none + ', Armor Tail took ' + tail };
});

probe('ability', 'typeImmunity', 'Levitate takes nothing from Earthquake', () => {
  const atk = bare('garchomp');
  const off = bare('hydreigon'), on = bare('hydreigon');
  on.ability = 'levitate';
  const a = M.dmgRange(atk, off, MC.moves['earthquake'], fresh(), false);
  const b = M.dmgRange(atk, on, MC.moves['earthquake'], fresh(), false);
  return { works: a.max > 0 && b.max === 0, detail: 'no ability ' + a.max + '  ->  Levitate ' + b.max };
});

probe('ability', 'convertsMoveType', 'Aerilate makes Body Slam hit a Ghost', () => {
  /* THE SHARPEST FORM OF THIS TEST. Normal does exactly ZERO to a Ghost; Flying does not. So a
   * working conversion turns a 0 into a number, which no partial implementation can fake. The
   * existing damageBoost probe only asked whether the number MOVED. */
  const on = bare('staraptor'), off = bare('staraptor');
  on.ability = 'aerilate';
  const def = bare('gengar');
  const a = M.dmgRange(off, def, MC.moves['bodyslam'], fresh(), false);
  const b = M.dmgRange(on, def, MC.moves['bodyslam'], fresh(), false);
  return { works: a.max === 0 && b.max > 0, detail: 'no ability ' + a.max + ' (Normal vs Ghost)  ->  Aerilate ' + b.max };
});

probe('move', 'multiHit', 'Rock Blast lands more than one hit', () => {
  /* THE CONTROL IS A COPY OF THE MOVE WITH ITS ID CHANGED, so the tag lookup misses and the copy is
   * a single 25-BP hit by construction. If the engine returns the same number for both, multiHit is
   * not wired -- that is Lesson 5's rule: an identical result across a varied knob means the knob is
   * unwired, not that it does not matter. dmgRange stamps ids onto MC.moves entries only, so this
   * local copy is untouched by it. */
  const att = bare('tyranitar'), def = bare('garchomp');
  const real = MC.moves['rockblast'];
  if (!real) return { works: false, detail: 'rockblast not in MC.moves' };
  const oneHit = Object.assign({}, real, { id: '__rockblast_onehit' });
  const a = M.dmgRange(att, def, oneHit, fresh(), false);
  const b = M.dmgRange(att, def, real, fresh(), false);
  return { works: b.max > a.max * 1.5,
           detail: 'one hit ' + a.max + '  ->  Rock Blast as the engine prices it ' + b.max
                 + ' (real average is about 3.2 hits)' };
});

probe('move', 'powerFromFallen', 'Last Respects grows with fallen allies', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const mv = MC.moves['lastrespects'];
  if (!mv) return { works: false, detail: 'lastrespects not in MC.moves' };
  const a = M.dmgRange(me, f1, mv, S.field, false);
  S.sfA.fainted = 3;                                   // the input, not the effect: three of ours are down
  const b = M.dmgRange(me, f1, mv, S.field, false);
  return { works: b.max > a.max, detail: '0 fallen ' + a.max + '  ->  3 fallen ' + b.max };
});

probe('move', 'overridesEffectiveness', 'Freeze-Dry beats Ice Beam into a Water type', () => {
  /* THE MOVE'S ENTIRE IDENTITY, and found by the differential test rather than by anyone reading a
   * list. Ice is normally RESISTED by Water; Freeze-Dry is super effective on it. So the correct
   * answer is not "different", it is FOUR TIMES Ice Beam, and the probe asks for the direction. */
  const att = bare('weavile'), def = bare('vaporeon');
  const ib = M.dmgRange(att, def, MC.moves['icebeam'], fresh(), false);
  const fd = M.dmgRange(att, def, MC.moves['freezedry'], fresh(), false);
  return { works: fd.max > ib.max, detail: 'Ice Beam ' + ib.max + '  ->  Freeze-Dry ' + fd.max + ' (must be higher)' };
});

probe('ability', 'reducesAllyDamage', 'Friend Guard cuts what the partner takes', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'milotic');
    f2.ability = ab;                                   // the partner of the Pokemon being hit
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run('none'), fg = run('friendguard');
  return { works: fg < none, detail: 'took ' + none + ' with a plain partner  ->  ' + fg + ' with Friend Guard' };
});

/* THE TARGET WAS A CORVIKNIGHT AND CORVIKNIGHT IS STEEL, 2026-08-04. Steel types cannot be poisoned
 * at all, so this arm read `none` with a fully working Poison Touch and would have reported the
 * engine broken forever -- the twenty-first probe in this project to be wrong before the engine was,
 * and the same shape as the Toxic-into-a-Steel case already recorded on this list. Milotic is pure
 * Water: poisonable, and bulky enough to survive a Close Combat so the status has a body to land on. */
probe('ability', 'poisonsOnMyContact', 'Poison Touch poisons on a contact hit', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'milotic', 'garchomp');
    me.ability = ab;
    M.battleTurn(S, () => 0.01, new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    /* A FAINTED TARGET TAKES NO STATUS, and the Ice Beam probe already cost us that lesson once. */
    return (f1.fainted ? 'FAINTED' : (f1.status || 'none'));
  };
  const none = run('none'), pt = run('poisontouch');
  return { works: none === 'none' && /psn|tox/.test(pt),
           detail: 'no ability -> ' + none + ', Poison Touch -> ' + pt };
});

probe('ability', 'immuneToMoveClass', 'Bulletproof refuses Rock Blast', () => {
  const atk = bare('tyranitar');
  const off = bare('kommoo'), on = bare('kommoo');
  on.ability = 'bulletproof';
  const a = M.dmgRange(atk, off, MC.moves['rockblast'], fresh(), false);
  const b = M.dmgRange(atk, on, MC.moves['rockblast'], fresh(), false);
  return { works: a.max > 0 && b.max === 0, detail: 'no ability ' + a.max + '  ->  Bulletproof ' + b.max };
});

probe('ability', 'boostsMoveClass', 'Iron Fist raises a punch and nothing else', () => {
  const on = bare('incineroar'), off = bare('incineroar');
  on.ability = 'ironfist';
  const def = bare('garchomp');
  const punch = (m) => M.dmgRange(m, def, MC.moves['drainpunch'], fresh(), false).max;
  const kick = (m) => M.dmgRange(m, def, MC.moves['closecombat'], fresh(), false).max;
  return { works: punch(on) > punch(off) && kick(on) === kick(off),
           detail: 'punch ' + punch(off) + '->' + punch(on) + ', non-punch ' + kick(off) + '->' + kick(on) + ' (must not move)' };
});

probe('ability', 'writesAccuracy', 'No Guard makes an 80%-accurate move land on a losing roll', () => {
  /* THE ROLL IS PINNED ABOVE THE MOVE'S ACCURACY, so the control MUST miss. A probe run at rng 0.5
   * would hit either way and report a working mechanic whatever the engine does. */
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'corviknight', 'garchomp');
    me.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, () => 0.9,
      new Map([[me, M.playerAction(me, 'hydropump', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run('none'), ng = run('noguard');
  return { works: none === 0 && ng > 0, detail: 'roll 0.9 vs 80% accuracy: no ability dealt ' + none + ', No Guard dealt ' + ng };
});

probe('ability', 'accuracyMod', 'Sand Veil makes the attacker miss a roll it would have hit', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'garchomp', 'garchomp');
    S.field.weather = 'sand'; f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, () => 0.7,
      new Map([[me, M.playerAction(me, 'hydropump', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const none = run('none'), sv = run('sandveil');
  return { works: none > 0 && sv === 0, detail: 'roll 0.7 in sand: no ability took ' + none + ', Sand Veil took ' + sv };
});

probe('ability', 'boostsEachTurn', 'Speed Boost raises Speed every turn', () => {
  const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
  me.ability = 'speedboost';
  M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  return { works: me.boosts.sp > 0, detail: 'speed stage after one turn: ' + me.boosts.sp };
});

probe('ability', 'healsOnSwitchOut', 'Regenerator heals a third on the way out', () => {
  /* BOTH ARMS, and the amount is asserted EXACTLY rather than as "went up". The tag that feeds this
   * over-matched before it was wired — `a.onSwitchOut ? {heal:1/3}` gave the same 33% to Natural Cure
   * and Zero to Hero, neither of which heals — so a probe that only asked "did HP rise" would have
   * gone green on a body being handed a heal it does not have. The third is the mechanic.
   *
   * Staged at a third of max HP: a full-HP body reads 0 -> 0 whatever the engine does. */
  const run = (ab) => {
    const me = bare('milotic'), ally = bare('corviknight'), bench = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    me.ability = ab; me.curHP = Math.floor(me.st.hp / 3);
    const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
    const before = me.curHP;
    M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: bench }], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { d: me.curHP - before, third: Math.floor(me.st.hp / 3) };
  };
  const off = run('none'), on = run('regenerator');
  return { works: off.d === 0 && on.d === on.third,
           detail: `on the bench, hp change: ability none ${off.d}, Regenerator ${on.d} (a third is ${on.third})` };
});

probe('ability', 'buffsHolderOnHit', 'Justified raises Attack when hit by a Dark move', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'corviknight', 'garchomp');
    f1.ability = ab;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'crunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.boosts.at;
  };
  const none = run('none'), j = run('justified');
  return { works: none === 0 && j > 0, detail: 'no ability atk stage ' + none + ', Justified ' + j };
});

probe('move', 'fixedDamage', 'Seismic Toss deals the level, whoever it hits', () => {
  const att = bare('incineroar');
  const mv = MC.moves['seismictoss'];
  if (!mv) return { works: false, detail: 'seismictoss not in MC.moves' };
  const soft = M.dmgRange(att, bare('alakazam'), mv, fresh(), false);
  const hard = M.dmgRange(att, bare('corviknight'), mv, fresh(), false);
  return { works: soft.max === hard.max && soft.max === 50,
           detail: 'mv.bp=' + mv.bp + '; vs frail ' + soft.max + ', vs bulky ' + hard.max + ' (both must be 50)' };
});

probe('move', 'perishClock', 'Perish Song faints the target three turns later', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'perishsong', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  for (let t = 0; t < 3; t++) M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  return { works: !!f1.fainted, detail: 'target after four turns: ' + (f1.fainted ? 'FAINTED' : f1.curHP + ' hp') };
});

probe('move', 'costsUserHP', 'Substitute costs the user a quarter', () => {
  /* The ACTION KIND is printed, because "the engine resolved this to a pass" and "the engine did the
   * move and forgot the cost" are different bugs with the same HP reading. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const act = M.playerAction(me, 'substitute', null, S.field);
  const before = me.curHP;
  M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: me.curHP < before,
           detail: 'resolved to kind ' + (act && act.kind) + '; user ' + before + ' -> ' + me.curHP
                 + ' hp (a quarter is ' + Math.floor(me.st.hp / 4) + ')' };
});

probe('move', 'delayedSleep', 'Yawn puts the target to sleep on the following turn', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'yawn', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const immediate = f1.status || 'none';
  M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  return { works: immediate !== 'slp' && f1.status === 'slp',
           detail: 'same turn: ' + immediate + ' (must not be slp), next turn: ' + (f1.status || 'none') };
});

probe('move', 'partialTrap', 'Infestation chips at the end of each turn', () => {
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const full = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'infestation', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const afterHit = f1.curHP;
  M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  /* THE HIT ITSELF IS PRINTED. "the trap chips nothing" and "the move never landed" are different
   * bugs and the target's HP after one idle turn cannot tell them apart on its own. */
  return { works: f1.curHP < afterHit,
           detail: 'the move dealt ' + (full - afterHit) + '; after the hit ' + afterHit
                 + ', after an idle turn ' + f1.curHP };
});

/* ARMED, 2026-08-04. `2 / 2` is what Decorate grants and also what a probe reads off a body nobody
 * touched if the engine ever seeded stages, so the control is the same turn without the click. */
probe('move', 'boostsTarget', 'Decorate raises the partner', () => {
  const run = (click) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, click ? M.playerAction(me, 'decorate', ally, S.field) : { kind: 'pass' }],
               [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [ally.boosts.at, ally.boosts.sa];
  };
  const control = run(false), test = run(true);
  return { works: test[0] > 0 && test[1] > 0 && control[0] === 0 && control[1] === 0,
           arms: { control, test },
           detail: 'partner atk/spa without the click ' + control.join('/') + ', after Decorate ' + test.join('/') };
});

probe('move', 'clearsScreens', 'Brick Break removes the opposing Reflect', () => {
  const run = (breakIt) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    /* the FOE puts up Reflect, then side A optionally breaks it, then the foe is hit physically */
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'reflect', null, S.field)], [f2, { kind: 'pass' }]]));
    M.battleTurn(S, rng5,
      new Map([[me, breakIt ? M.playerAction(me, 'brickbreak', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    f1.curHP = f1.st.hp;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const behind = run(false), broken = run(true);
  return { works: broken > behind, detail: 'screen up ' + behind + '  ->  after Brick Break ' + broken };
});

probe('move', 'blocksSoundMoves', 'Throat Chop stops the target using a sound move', () => {
  const run = (chop) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, chop ? M.playerAction(me, 'throatchop', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    me.curHP = me.st.hp;
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'boomburst', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const free = run(false), chopped = run(true);
  return { works: free > 0 && chopped === 0, detail: 'sound move dealt ' + free + ' normally, ' + chopped + ' after Throat Chop' };
});

probe('move', 'ignoresBoosts', 'Darkest Lariat ignores a Defense boost', () => {
  const atk = bare('incineroar');
  const plain = bare('corviknight'), boosted = bare('corviknight');
  boosted.boosts.df = 4;
  const mv = MC.moves['darkestlariat'];
  if (!mv) return { works: false, detail: 'darkestlariat not in MC.moves' };
  const a = M.dmgRange(atk, plain, mv, fresh(), false);
  const b = M.dmgRange(atk, boosted, mv, fresh(), false);
  return { works: a.max === b.max, detail: 'unboosted ' + a.max + ' vs +4 Def ' + b.max + ' (equal = ignored)' };
});

probe('move', 'failsWithoutWeather', 'Aurora Veil fails when it is not snowing', () => {
  const run = (weather) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    S.field.weather = weather;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'auroraveil', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    me.curHP = me.st.hp;
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const dry = run(''), snow = run('snow');
  return { works: snow < dry, detail: 'took ' + dry + ' after Aurora Veil in clear weather (must be unreduced), '
                                    + snow + ' in snow' };
});

probe('move', 'punishesContact', 'Spiky Shield hurts the attacker it blocked', () => {
  /* WHETHER THE BLOCK EVEN HAPPENED IS PART OF THE READING. A shield that never blocked and a shield
   * that blocked without punishing both leave the attacker on full HP, and only the second is the
   * mechanic this probe is named for. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const before = f1.curHP, meBefore = me.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'spikyshield', null, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'dragonclaw', me, S.field)], [f2, { kind: 'pass' }]]));
  const blocked = (meBefore - me.curHP) === 0;
  return { works: blocked && (before - f1.curHP) > 0,
           detail: 'the shield ' + (blocked ? 'blocked' : 'DID NOT BLOCK — user took ' + (meBefore - me.curHP))
                 + '; blocked attacker lost ' + (before - f1.curHP) + ' hp' };
});

/* THIS PROBE ASKED dmgRange THE WRONG QUESTION AND WAS REWRITTEN, 2026-08-04.
 *
 * It used to read `dmgRange(Night Slash) > dmgRange(the same move with its id changed)` -- i.e. it
 * demanded the PRICER carry a crit EXPECTATION. That is not a mechanic the range may have: dmgRange
 * returns a min/max, `max` is the maximum roll, and tests/test-engine-diff.js compares exactly that
 * against Showdown's non-crit damage. Folding 1.0625 into it would put every ratio move permanently
 * out of step with the differential and would stop `max` meaning anything.
 *
 * The RATE belongs in the battle loop's roll, where a flat `rng()<1/24` already lived, so the probe
 * is now behavioural and pinned at a roll that SEPARATES the two rates: 0.1 is below 1/8 (0.125) and
 * above 1/24 (0.0417). A move at the base rate cannot crit on it; a move one stage up must.
 *
 * FOUR ARMS, because two cannot attribute it. Shell Armor is the discriminator on the ratio move, and
 * Crunch -- Dark, physical, same attacker, same target, NO crit ratio -- is the control that must not
 * move at all. An engine that simply raised the base rate for everything passes a two-armed version
 * and fails here. */
probe('move', 'critRatioUp', 'Night Slash crits on a roll Crunch does not', () => {
  const rng10 = () => 0.1;
  const run = (mvId, defAb) => {
    const me = bare('weavile'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    f1.ability = defAb;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const before = f1.curHP;
    M.battleTurn(S, rng10,
      new Map([[me, M.playerAction(me, mvId, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const nsPlain = run('nightslash', 'none'), nsArmor = run('nightslash', 'shellarmor');
  const cPlain = run('crunch', 'none'), cArmor = run('crunch', 'shellarmor');
  return { works: nsPlain > nsArmor && nsArmor > 0 && cPlain === cArmor && cPlain > 0,
           detail: 'roll 0.1 (above 1/24, below 1/8): Night Slash plain ' + nsPlain + ' / Shell Armor '
                 + nsArmor + '   |   Crunch plain ' + cPlain + ' / Shell Armor ' + cArmor + ' (must be equal)' };
});

/* `preventsCrit` — 151 uses, never probed. Staged on an ALWAYS-crit move so the reading is exact and
 * deterministic rather than a rate: Flower Trick is +50% on every hit, Shell Armor takes it back to
 * the plain number, and a third arm (a move with no crit tag at all) shows the plain number is really
 * the un-crit one rather than a coincidence. Through dmgRange because that is where the CERTAIN half
 * of a crit lives (see WIRE 35). */
probe('ability', 'preventsCrit', 'Shell Armor takes the guaranteed crit off Flower Trick', () => {
  const att = bare('meowscarada');
  const plain = bare('garchomp'), armor = bare('garchomp');
  armor.ability = 'shellarmor';
  const real = MC.moves['flowertrick'];
  if (!real) return { works: false, detail: 'flowertrick not in MC.moves' };
  const flat = Object.assign({}, real, { id: '__flowertrick_nocrit' });
  const a = M.dmgRange(att, plain, real, fresh(), false).max;
  const b = M.dmgRange(att, armor, real, fresh(), false).max;
  const c = M.dmgRange(att, plain, flat, fresh(), false).max;
  return { works: a > b && b === c,
           detail: 'Flower Trick max: plain ' + a + ', Shell Armor ' + b + ', no crit tag at all ' + c
                 + ' (Shell Armor must equal the untagged number)' };
});

/* ARMED, 2026-08-04. `0 / 0` on its own is also what a probe reads off two bodies whose stages were
 * never set, so the control is the SAME staged stages with no Haze -- they must survive the turn. */
probe('move', 'clearsBoosts', 'Haze wipes the boosts off both sides', () => {
  const run = (click) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    f1.boosts.at = 4; me.boosts.at = 2;
    const act = click ? M.playerAction(me, 'haze', null, S.field) : { kind: 'pass' };
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { kind: act.kind, foe: f1.boosts.at, own: me.boosts.at };
  };
  const control = run(false), test = run(true);
  return { works: test.foe === 0 && test.own === 0 && control.foe === 4 && control.own === 2,
           arms: { control: [control.foe, control.own], test: [test.foe, test.own] },
           detail: 'resolved to kind ' + test.kind + '; staged +4/+2 survives an idle turn as '
                 + control.foe + '/' + control.own + ', after Haze ' + test.foe + '/' + test.own };
});

/* ARMED, 2026-08-04. `dealt 0` on the second click is also what an engine that never resolved the
 * move at all prints, so the control is the same body clicking a move with NO lockout twice. */
probe('move', 'cantUseTwice', 'Gigaton Hammer cannot be clicked twice in a row', () => {
  if (!MC.moves['gigatonhammer']) return { works: false, detail: 'gigatonhammer not in MC.moves' };
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('tinkaton', 'corviknight', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    const first = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return first - f1.curHP;
  };
  const control = run('playrough'), test = run('gigatonhammer');
  return { works: test === 0 && control > 0, arms: { control: control > 0, test: test > 0 },
           detail: 'second consecutive Play Rough dealt ' + control + ' (a move with no lockout must '
                 + 'still land), second consecutive Gigaton Hammer dealt ' + test + ' (must be 0)' };
});

probe('move', 'terrainScaled', 'Expanding Force gains power on Psychic Terrain', () => {
  const att = bare('alakazam'), def = bare('garchomp');
  const mv = MC.moves['expandingforce'];
  if (!mv) return { works: false, detail: 'expandingforce not in MC.moves' };
  const at = (t) => M.dmgRange(att, def, mv, Object.assign(fresh(), { terrain: t }), false).max;
  /* BOTH VOCABULARIES, and the WRONG terrain as a third arm. A wire that multiplied under ANY terrain
   * would pass a two-armed probe and would be wrong on every Electric Terrain board. */
  const none = at(''), eng = at('psychic'), boardWord = at('psychicterrain'), wrong = at('electric');
  return { works: eng > none && boardWord === eng && wrong === none,
           detail: `Expanding Force max: no terrain ${none}, 'psychic' ${eng}, 'psychicterrain' ${boardWord}, `
                 + `'electric' ${wrong} (must equal no terrain)` };
});

probe('move', 'swapsStat', 'Foul Play attacks with the TARGET Attack', () => {
  /* Two identical targets but for their Attack. If Foul Play reads the USER's Attack the two are
   * equal, and that equality is the null result. Confirmed against Showdown independently:
   * spiritomb foulplay -> pelipper reads 28-34 there and 51-61 here. */
  const att = bare('spiritomb');
  const weak = bare('pelipper'), strong = bare('pelipper');
  strong.st = Object.assign({}, strong.st, { at: strong.st.at * 3 });
  const mv = MC.moves['foulplay'];
  if (!mv) return { works: false, detail: 'foulplay not in MC.moves' };
  const a = M.dmgRange(att, weak, mv, fresh(), false);
  const b = M.dmgRange(att, strong, mv, fresh(), false);
  return { works: b.max > a.max,
           detail: 'target atk ' + weak.st.at + ' -> ' + a.max + ', target atk ' + strong.st.at + ' -> ' + b.max };
});

probe('ability', 'formeChange', 'Disguise eats the first hit', () => {
  /* CLOSE COMBAT WAS THE WRONG MOVE AND THE CONTROL SAID SO: Mimikyu is Ghost/Fairy, so Fighting
   * does exactly ZERO to it, and the first version read 0 with the ability and 0 without and would
   * have gone green the moment Disguise was implemented OR deleted. Crunch is Dark -- 2x on Ghost,
   * 0.5x on Fairy, net neutral -- and physical contact, which is what Disguise is meant to eat. */
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'mimikyu', 'garchomp');
    f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'crunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  /* THE ASSERTION IS THE GEN-9 RULE, NOT "ABOUT ZERO". The first version demanded the Disguise arm
   * take at most 15% of the real hit, which was written while expecting a flat nullification -- and
   * it would have REJECTED the correct behaviour: since Gen 8 the busted disguise costs the holder
   * exactly maxhp/8, which on Mimikyu is 16 against a 92 hit, i.e. 17%. A probe whose threshold
   * encodes the wrong rule fails the fix and passes the bug. Exact number, both halves. */
  const eighth = Math.floor(M.buildMon('mimikyu', {}).st.hp / 8);
  const none = run('none'), dis = run('disguise');
  return { works: none > 0 && dis === eighth,
           detail: 'no ability took ' + none + ', Disguise took ' + dis + ' (must be exactly maxhp/8 = ' + eighth + ')' };
});

probe('ability', 'untagged', 'Marvel Scale raises Defense while statused', () => {
  /* `untagged` is a BUCKET, not a mechanic -- 45 abilities carry it, worth 2,129 clicks between
   * them. Probed here under that name because that is what the artifact says, with the mechanic
   * named in the label so the census row is readable. Marvel Scale is on the differential's hand
   * list; the tag walk found it has no tag at all to be wired from. */
  const atk = bare('garchomp');
  const off = bare('milotic'), on = bare('milotic');
  off.status = 'brn'; on.status = 'brn'; on.ability = 'marvelscale';
  const a = M.dmgRange(atk, off, MC.moves['earthquake'], fresh(), false);
  const b = M.dmgRange(atk, on, MC.moves['earthquake'], fresh(), false);
  return { works: b.max < a.max, detail: 'burned, no ability ' + a.max + '  ->  burned with Marvel Scale ' + b.max };
});

probe('move', 'secondaryStatEffect', 'Moonblast drops the target Special Attack', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'corviknight', 'garchomp');
  M.battleTurn(S, () => 0.01,
    new Map([[me, M.playerAction(me, 'moonblast', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: f1.boosts.sa < 0, detail: 'target spa stage with the roll forced low: ' + f1.boosts.sa };
});

probe('move', 'statusInflict', 'Scald burns as a secondary of a damaging move', () => {
  const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'corviknight', 'garchomp');
  M.battleTurn(S, () => 0.01,
    new Map([[me, M.playerAction(me, 'scald', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: f1.status === 'brn',
           detail: 'target ' + (f1.fainted ? 'FAINTED' : 'survived') + ', status ' + (f1.status || 'none') };
});

probe('move', 'variablePower', 'Acrobatics doubles with no item held', () => {
  const held = bare('staraptor'), empty = bare('staraptor');
  held.item = 'lifeorb'; empty.item = '';
  const def = bare('garchomp');
  const mv = MC.moves['acrobatics'];
  if (!mv) return { works: false, detail: 'acrobatics not in MC.moves' };
  /* Life Orb would raise the held arm by 1.3x, so a working Acrobatics must still beat it. */
  const a = M.dmgRange(held, def, mv, fresh(), false);
  const b = M.dmgRange(empty, def, mv, fresh(), false);
  return { works: b.max > a.max, detail: 'holding an item ' + a.max + '  ->  empty-handed ' + b.max };
});

/* ---- BATCH 5 — the rest of the walk, down to about 800 corpus uses ------------------------------ */

/* ARMED, 2026-08-04. `damage 0` on its own is also what a move dropped to `kind: pass` prints, so
 * the control is the same turn with no click at all -- the STATUS is what must differ. */
probe('move', 'statusCategory', 'Thunder Wave paralyses without dealing damage', () => {
  const run = (click) => {
    const { me, ally, f1, f2, S } = board('raichu', 'incineroar', 'garchomp', 'garchomp');
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, click ? M.playerAction(me, 'thunderwave', f1, S.field) : { kind: 'pass' }],
               [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [before - f1.curHP, f1.status || 'none'];
  };
  const control = run(false), test = run(true);
  return { works: test[0] === 0 && test[1] === 'par' && control[1] === 'none',
           arms: { control, test },
           detail: 'no click: damage ' + control[0] + ' status ' + control[1]
                 + ';  Thunder Wave: damage ' + test[0] + ' (must be 0) status ' + test[1] };
});

probe('move', 'statSwap', 'Psyshock is scored against the target Defense', () => {
  /* Two identical targets but for physical Defense. Psyshock is a SPECIAL move that hits the
   * PHYSICAL side, so raising Defense must lower the damage; if the engine reads Special Defense the
   * two are equal and that equality is the null result. */
  const att = bare('alakazam');
  const soft = bare('milotic'), hard = bare('milotic');
  hard.st = Object.assign({}, hard.st, { df: hard.st.df * 3 });
  const mv = MC.moves['psyshock'];
  if (!mv) return { works: false, detail: 'psyshock not in MC.moves' };
  const a = M.dmgRange(att, soft, mv, fresh(), false);
  const b = M.dmgRange(att, hard, mv, fresh(), false);
  return { works: b.max < a.max, detail: 'def ' + soft.st.df + ' takes ' + a.max + ', def ' + hard.st.df + ' takes ' + b.max };
});

probe('move', 'removesItem', 'a knocked-off Life Orb stops boosting the target damage', () => {
  /* NOT "is the item field blank" -- that is already probed under readsTargetItem, and a blank field
   * nothing reads is worth nothing. This asks the CONSEQUENCE: after the item is gone, does the
   * damage the victim deals actually fall back to the no-item number. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  f1.item = 'lifeorb';
  const withOrb = M.dmgRange(f1, me, MC.moves['earthquake'], S.field, false).max;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const after = M.dmgRange(f1, me, MC.moves['earthquake'], S.field, false).max;
  return { works: !f1.item && after < withOrb,
           detail: 'holding a Life Orb it dealt ' + withOrb + ', after Knock Off ' + after
                 + ' (item field now ' + JSON.stringify(f1.item || '') + ')' };
});

probe('item', 'extendsDuration', 'Light Clay keeps Reflect up past turn five', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    me.item = item;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'reflect', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    for (let t = 0; t < 5; t++) M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    me.curHP = me.st.hp;
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const none = run(''), clay = run('lightclay');
  return { works: clay < none, detail: 'turn 7 damage: no item ' + none + '  ->  Light Clay ' + clay };
});

probe('ability', 'refusesStatusMoves', 'Good as Gold refuses Thunder Wave', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('raichu', 'incineroar', 'gholdengo', 'garchomp');
    f1.ability = ab;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'thunderwave', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  const none = run('none'), gold = run('goodasgold');
  return { works: none === 'par' && gold !== 'par', detail: 'no ability -> ' + none + ', Good as Gold -> ' + gold };
});

probe('move', 'inflictsToxic', 'Toxic damage grows each turn', () => {
  /* BADLY POISONED IS NOT POISONED. The existing inflictsPoison probe only asks whether the status
   * landed; the whole point of Toxic is that the chip ESCALATES, and an engine that treats it as
   * ordinary poison prices a stall matchup completely wrongly.
   *
   * NOT INTO CORVIKNIGHT. The first version did, read `status none`, and was about to be written up
   * as an engine gap -- Corviknight is STEEL and cannot be poisoned at all, so the probe was
   * measuring a correct immunity. Same family of staging error as firing Ice Beam at a Garchomp that
   * then fainted. Garchomp takes it. */
  const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'garchomp', 'garchomp');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'toxic', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const chips = [];
  for (let t = 0; t < 4; t++) {
    const before = f1.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    chips.push(before - f1.curHP);
  }
  return { works: chips[chips.length - 1] > chips[0],
           detail: 'status ' + (f1.status || 'none') + ', chip per turn: ' + chips.join(', ') };
});

probe('move', 'semiInvulnerable', 'a Pokemon in the air cannot be hit', () => {
  /* THE FLIER MUST BE FASTER, and the first version had it exactly backwards. Staraptor (100 base
   * Speed) went up against Garchomp (102), so Garchomp attacked BEFORE the charge was declared, hit
   * a Pokemon still standing on the ground, and the probe reported the engine broken. It is not:
   * `_invuln` is set at line 1420 when the charge begins and honoured at 1521, and that is also what
   * the real game does — going up second does not retroactively dodge anything.
   *
   * Sixteenth-and-seventeenth time a probe here was wrong before the engine was. Archaludon is 60
   * base Speed, so the order is not in doubt, and the SPEEDS ARE PRINTED so a future reader can see
   * the assumption instead of trusting it. */
  const run = (flies) => {
    const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'archaludon', 'garchomp');
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, flies ? M.playerAction(me, 'fly', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'ironhead', me, S.field)], [f2, { kind: 'pass' }]]));
    return { took: before - me.curHP, mine: me.st.sp, theirs: f1.st.sp };
  };
  const grounded = run(false), airborne = run(true);
  return { works: grounded.took > 0 && airborne.took === 0,
           detail: 'flier speed ' + grounded.mine + ' vs attacker ' + grounded.theirs
                 + '; on the ground took ' + grounded.took + ', on the Fly charge turn took ' + airborne.took };
});

/* ---- BATCH 6 — the rest of the walk, plus the authorised fix list ------------------------------- */

probe('ability', 'halvesTypeDamage', 'Thick Fat halves Fire and Ice and nothing else', () => {
  const atk = bare('incineroar');
  const off = bare('milotic'), on = bare('milotic');
  on.ability = 'thickfat';
  const fire = (d) => M.dmgRange(atk, d, MC.moves['flamethrower'], fresh(), false).max;
  const other = (d) => M.dmgRange(atk, d, MC.moves['closecombat'], fresh(), false).max;
  return { works: fire(on) < fire(off) && other(on) === other(off),
           detail: 'Fire ' + fire(off) + '->' + fire(on) + ', Fighting ' + other(off) + '->' + other(on) + ' (must not move)' };
});

probe('ability', 'halvesTypeDamage', 'Dry Skin takes 1.25x from Fire', () => {
  /* FILED UNDER THE TAG THAT SHOULD CARRY IT, WHICH IS WHY THIS ONE IS DIFFERENT FROM THE REST.
   * `halvesTypeDamage` is the artifact's idiom for a type-scaled damage-taken multiplier -- Thick
   * Fat, Heatproof, Purifying Salt and Water Bubble all carry it with `attackerStatMult: 0.5`. Dry
   * Skin's Fire half is the same shape with 1.25 and the artifact has NO ROW FOR IT: `dryskin.tags`
   * is `["typeImmunity"]` and its params describe only the Water absorb. So the engine cannot have
   * this mechanic — there is nothing to read — and the fix is a tag before it is any code.
   *
   * Found by the differential, not by reading a list: `houndoom fireblast -> heliolisk` reads
   * 123-137 on Showdown and 99-117 here, which is 1.24. */
  const atk = bare('incineroar');
  const off = bare('heliolisk'), on = bare('heliolisk');
  on.ability = 'dryskin';
  const a = M.dmgRange(atk, off, MC.moves['flamethrower'], fresh(), false);
  const b = M.dmgRange(atk, on, MC.moves['flamethrower'], fresh(), false);
  return { works: b.max > a.max, detail: 'no ability ' + a.max + '  ->  Dry Skin ' + b.max + ' (must be about 1.25x)' };
});

probe('ability', 'ignoresDefenderAbility', 'Mold Breaker ignores Levitate', () => {
  /* THE SHARPEST AVAILABLE FORM AGAIN: Levitate is a hard zero, so a working Mold Breaker turns a 0
   * into a number and no partial implementation can fake it. */
  const plain = bare('tinkaton'), breaker = bare('tinkaton');
  breaker.ability = 'moldbreaker';
  const def = bare('hydreigon'); def.ability = 'levitate';
  const a = M.dmgRange(plain, def, MC.moves['earthquake'], fresh(), false);
  const b = M.dmgRange(breaker, def, MC.moves['earthquake'], fresh(), false);
  return { works: a.max === 0 && b.max > 0, detail: 'no ability ' + a.max + '  ->  Mold Breaker ' + b.max };
});

probe('ability', 'ignoresTypeImmunity', 'Scrappy lets Normal hit a Ghost', () => {
  const plain = bare('incineroar'), scrappy = bare('incineroar');
  scrappy.ability = 'scrappy';
  const def = bare('gengar');
  const a = M.dmgRange(plain, def, MC.moves['bodyslam'], fresh(), false);
  const b = M.dmgRange(scrappy, def, MC.moves['bodyslam'], fresh(), false);
  return { works: a.max === 0 && b.max > 0, detail: 'no ability ' + a.max + '  ->  Scrappy ' + b.max };
});

probe('ability', 'noRecoil', 'Rock Head takes no recoil', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
    me.ability = ab;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'bravebird', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - me.curHP;
  };
  const none = run('none'), rh = run('rockhead');
  return { works: none > 0 && rh === 0, detail: 'no ability lost ' + none + ' to recoil, Rock Head lost ' + rh };
});

probe('move', 'alwaysCrit', 'Flower Trick always crits', () => {
  /* Same control trick as Rock Blast and Night Slash: a copy with the id changed carries no tag, so
   * the only thing that differs between the two calls is alwaysCrit. */
  const att = bare('meowscarada'), def = bare('garchomp');
  const real = MC.moves['flowertrick'];
  if (!real) return { works: false, detail: 'flowertrick not in MC.moves' };
  const flat = Object.assign({}, real, { id: '__flowertrick_nocrit' });
  const a = M.dmgRange(att, def, flat, fresh(), false);
  const b = M.dmgRange(att, def, real, fresh(), false);
  return { works: b.max > a.max, detail: 'without the tag ' + a.max + '  ->  Flower Trick ' + b.max };
});

probe('move', 'forcesSwitch', 'Dragon Tail drags the target out', () => {
  const me = bare('garchomp'), ally = bare('corviknight');
  const f1 = bare('incineroar'), f2 = bare('milotic'), fbench = bare('whimsicott');
  const S = M.battleInit([me, ally], [f1, f2, fbench], { seeded: true });
  const before = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'dragontail', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  /* THE DAMAGE IS PRINTED so "the drag is not modelled" cannot be confused with "the move never
   * resolved" -- Dragon Tail deals damage AND drags, and only one of those halves is in question. */
  return { works: S.actB.indexOf(f1) < 0,
           detail: 'the move dealt ' + (before - f1.curHP) + '; foe actives after Dragon Tail: '
                 + S.actB.map(x => x && x.name).join(', ') };
});

probe('move', 'crashOnMiss', 'High Jump Kick hurts the user when it misses', () => {
  /* THE ROLL IS PINNED ABOVE THE MOVE'S ACCURACY so the miss is guaranteed. At rng 0.5 it would
   * connect and the probe would report a working crash whatever the engine does. */
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const mv = MC.moves['highjumpkick'];
  if (!mv) return { works: false, detail: 'highjumpkick not in MC.moves' };
  const before = me.curHP, foeBefore = f1.curHP;
  M.battleTurn(S, () => 0.99,
    new Map([[me, M.playerAction(me, 'highjumpkick', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (foeBefore - f1.curHP) === 0 && (before - me.curHP) > 0,
           detail: 'foe took ' + (foeBefore - f1.curHP) + ' (must be 0, it missed), user lost ' + (before - me.curHP) };
});

probe('move', 'userFaints', 'Explosion faints its user', () => {
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
  const mv = MC.moves['explosion'];
  if (!mv) return { works: false, detail: 'explosion not in MC.moves' };
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'explosion', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: !!me.fainted || me.curHP <= 0, detail: 'user after Explosion: ' + (me.fainted ? 'FAINTED' : me.curHP + ' hp') };
});

probe('item', 'boostsSuperEffective', 'Expert Belt raises only super-effective damage', () => {
  const on = bare('incineroar'), off = bare('incineroar');
  on.item = 'expertbelt';
  const se = bare('corviknight');                      // Fire into Steel/Flying is super effective
  const neutral = bare('garchomp');                    // Fire into Dragon/Ground is resisted, not SE
  const hit = (m, d) => M.dmgRange(m, d, MC.moves['flamethrower'], fresh(), false).max;
  return { works: hit(on, se) > hit(off, se) && hit(on, neutral) === hit(off, neutral),
           detail: 'super-effective ' + hit(off, se) + '->' + hit(on, se)
                 + ', not super-effective ' + hit(off, neutral) + '->' + hit(on, neutral) + ' (must not move)' };
});

probe('item', 'curesStatus', 'Lum Berry cures the status it was just given', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    f1.item = item;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'willowisp', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  const none = run(''), lum = run('lumberry');
  return { works: none === 'brn' && lum === 'none', detail: 'no item -> ' + none + ', Lum Berry -> ' + lum };
});

probe('ability', 'typeBecomesMoveType', 'Protean makes the user the type it just used', () => {
  /* THE MOVE'S TYPE MUST BE ONE THE USER DOES NOT ALREADY HAVE. The first version fired Crunch off a
   * Meowscarada, which is already Grass/DARK, so a fully working Protean and a completely absent one
   * both leave a Dark type in the list. Earthquake is Ground and Meowscarada is not. */
  const { me, ally, f1, f2, S } = board('meowscarada', 'incineroar', 'garchomp', 'garchomp');
  me.ability = 'protean';
  const before = (me.types || []).join('/');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: (me.types || []).length === 1 && (me.types || [])[0] === 'Ground',
           detail: 'types ' + before + '  ->  ' + (me.types || []).join('/') + ' after using a Ground move' };
});

probe('ability', 'invertsBoosts', 'Contrary turns a self-drop into a boost', () => {
  const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
  me.ability = 'contrary';
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { works: me.boosts.df > 0, detail: 'own def stage after Close Combat with Contrary: ' + me.boosts.df + ' (must be positive)' };
});

probe('ability', 'blocksExplosion', 'Damp stops Explosion happening at all', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'explosion', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { took: before - f1.curHP, userDead: !!me.fainted };
  };
  const none = run('none'), damp = run('damp');
  return { works: none.took > 0 && damp.took === 0 && !damp.userDead,
           detail: 'no ability: foe took ' + none.took + ' / user ' + (none.userDead ? 'fainted' : 'lived')
                 + '   |   Damp: foe took ' + damp.took + ' / user ' + (damp.userDead ? 'FAINTED' : 'lived') };
});

probe('move', 'hazard', 'Stealth Rock chips what comes in afterwards', () => {
  const me = bare('garchomp'), ally = bare('corviknight');
  const f1 = bare('incineroar'), f2 = bare('milotic'), fbench = bare('staraptor');
  const S = M.battleInit([me, ally], [f1, f2, fbench], { seeded: true });
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'stealthrock', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const before = fbench.curHP;
  M.battleTurn(S, rng5, PASS2(me, ally),
    new Map([[f1, { kind: 'switch', to: fbench }], [f2, { kind: 'pass' }]]));
  /* WHETHER THE SWITCH HAPPENED IS PART OF THE READING. An unchipped body that never came in and an
   * unchipped body that walked through a hazard nothing implements read the same from HP alone. */
  const cameIn = S.actB.indexOf(fbench) >= 0;
  return { works: cameIn && fbench.curHP < before,
           detail: 'the switch ' + (cameIn ? 'happened' : 'DID NOT HAPPEN') + '; the switch-in (Staraptor, '
                 + '4x weak to Rock) came in on ' + before + ' and is on ' + fbench.curHP };
});

probe('move', 'blocksHealing', 'Psychic Noise stops the target healing', () => {
  const run = (noise) => {
    const { me, ally, f1, f2, S } = board('alakazam', 'incineroar', 'milotic', 'garchomp');
    f1.curHP = Math.floor(f1.st.hp / 3);
    M.battleTurn(S, rng5,
      new Map([[me, noise ? M.playerAction(me, 'psychicnoise', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    const before = f1.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'recover', null, S.field)], [f2, { kind: 'pass' }]]));
    return f1.curHP - before;
  };
  const free = run(false), blocked = run(true);
  return { works: free > 0 && blocked <= 0, detail: 'healed ' + free + ' normally, ' + blocked + ' after Psychic Noise' };
});

/* WIRE 109 -- LANDED, and the previous version of this probe was WRONG BEFORE THE ENGINE WAS
 * (Lesson 5, staged against a body that cannot show the effect): it made WEAVILE the attacker, and
 * Weavile at 187 Speed outruns Whimsicott at 177 -- so the hit landed before After You could ever
 * resolve, in the real game as well as here, and the probe read MISSING against a wire that worked.
 * Garchomp (161) sits between the two, which is the window the mechanic needs.
 *
 * THE INSTRUCT ARM IS THE ONE THAT MATTERS: Instruct carries the identical `reordersTurn
 * {sends:'next'}` and means something completely different (the target REPEATS its move). The
 * census's blocking claim was "nothing in the artifact tells the two apart" -- wrong: Instruct also
 * carries `instructsTarget`, a declared fact, and the consumer excludes on it. So Instruct must NOT
 * protect the ally here, or the engine just gave Instruct After You's behaviour. */
probe('move', 'reordersTurn', 'After You lets the partner move next', () => {
  const run = (click) => {
    const me = bare('whimsicott'), ally = bare('archaludon');
    const f1 = bare('garchomp'), f2 = bare('corviknight');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    f1.curHP = 1;
    const before = ally.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, click ? M.playerAction(me, click, ally, S.field) : { kind: 'pass' }],
               [ally, M.playerAction(ally, 'ironhead', f1, S.field)]]),
      new Map([[f1, M.playerAction(f1, 'closecombat', ally, S.field)], [f2, { kind: 'pass' }]]));
    return before - ally.curHP;
  };
  const normal = run(null), moved = run('afteryou'), instructed = run('instruct');
  return { works: normal > 0 && moved === 0 && instructed > 0,
           arms: { control: normal, test: moved },
           detail: 'slow partner took ' + normal + ' with no help, ' + moved + ' after After You '
                 + '(the 1-HP foe died first), and ' + instructed + ' after INSTRUCT -- which shares '
                 + '{sends:next} and must not reorder' };
});

/* WIRE 109, the other member: QUASH sends the target to the BACK of the turn. Same staging inverted:
 * the foe is FASTER than the partner, so only a demotion can put the partner's kill in front. */
probe('move', 'quashSendsLast', 'Quash makes the target act last', () => {
  const run = (quash) => {
    const me = bare('whimsicott'), ally = bare('archaludon');
    const f1 = bare('garchomp'), f2 = bare('corviknight');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    f1.curHP = 1;
    const before = ally.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, quash ? M.playerAction(me, 'quash', f1, S.field) : { kind: 'pass' }],
               [ally, M.playerAction(ally, 'ironhead', f1, S.field)]]),
      new Map([[f1, M.playerAction(f1, 'closecombat', ally, S.field)], [f2, { kind: 'pass' }]]));
    return before - ally.curHP;
  };
  const normal = run(false), quashed = run(true);
  return { works: normal > 0 && quashed === 0,
           arms: { control: normal, test: quashed },
           detail: 'partner took ' + normal + ' without Quash, ' + quashed + ' with the attacker '
                 + 'quashed to the back (it was KOd before its demoted action came up)' };
});

probe('item', 'curesVolatile', 'Mental Herb frees the holder from Taunt', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'whimsicott', 'garchomp');
    f1.item = item;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'taunt', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return !!(f1._vol && f1._vol.taunt);
  };
  const none = run(''), herb = run('mentalherb');
  return { works: none === true && herb === false, detail: 'no item taunted=' + none + ', Mental Herb taunted=' + herb };
});

/* THIS PROBE ASKED FOR THE WRONG MODEL AND WAS REWRITTEN, 2026-08-04, beside the critRatioUp one.
 *
 * It read `moveAccuracy('tripleaxel') < 90` on the reasoning that three 90% rolls compound to 73%.
 * That is wrong in both directions at once: the move still CONNECTS 90% of the time, because only the
 * FIRST roll decides whether anything happens, and when it connects the damage is proportional to how
 * many of the three hits landed. A 73%-accurate three-hit move under-counts the connections and
 * over-counts the damage on every one of them.
 *
 * The mechanic is a discount on the HIT COUNT: 1 + p + p^2 = 2.71 hits rather than 3. So the probe
 * asks the outcome through dmgRange, with a control that separates the two things that could produce
 * a smaller number -- a COPY with the id changed carries no tags at all and is therefore ONE hit, and
 * Rock Blast (multi-hit, 90 accuracy, NO multiAccuracy tag) must show no discount whatever. */
probe('move', 'multiAccuracy', 'Triple Axel is priced below three full hits', () => {
  const att = bare('weavile'), def = bare('garchomp');
  const ta = MC.moves['tripleaxel'], rb = MC.moves['rockblast'];
  if (!ta || !rb) return { works: false, detail: 'tripleaxel/rockblast not in MC.moves' };
  const one = (mv) => M.dmgRange(att, def, Object.assign({}, mv, { id: '__' + mv.id + '_flat' }), fresh(), false).max;
  const all = (mv) => M.dmgRange(att, def, mv, fresh(), false).max;
  const taOne = one(ta), taAll = all(ta);
  const rbOne = one(rb), rbAll = all(rb);
  /* Rock Blast's expectation is 3.1 hits and carries no per-hit accuracy, so its ratio must stay at
   * 3.1; Triple Axel's must fall from 3 to about 2.71. */
  const taR = taAll / taOne, rbR = rbAll / rbOne;
  return { works: taR > 2 && taR < 2.95 && rbR > 3.0,
           detail: 'Triple Axel ' + taOne + ' x' + taR.toFixed(2) + ' = ' + taAll
                 + ' (three full hits would be x3, the discount is x2.71);  Rock Blast ' + rbOne
                 + ' x' + rbR.toFixed(2) + ' = ' + rbAll + ' (no per-hit roll, must stay x3.1)' };
});

/* ---- BATCH 7 — the leaf boundary, and the two dead wires test-tag-wire.js has been red on ------- */

/* THE BOARD SPEAKS SHOWDOWN AND THE ENGINE SPEAKS ITS OWN WORDS, and until 2026-08-04 nothing
 * translated between them at the one boundary where a real board is handed in.
 *
 * `board.weather` holds Showdown's `|-weather|` line, which is a MOVE name -- `sunnyday`, `raindance`,
 * `sandstorm`, `snowscape` (all four and only those four across 41,122 weather events in the store).
 * Every formula in medicham2 compares against `sun`/`rain`/`sand`/`snow`. `rollout_leaf.applyField`
 * assigned the string straight through, so a mid-battle board's weather was truthy enough to suppress
 * the mega-weather guard and meaningless to every formula: 0 of 9,040 playouts ever began in a weather
 * the engine could read.
 *
 * THIS PROBE TESTS THE OUTCOME, NOT THE CLASSIFICATION. It runs a real damage number through the real
 * boundary function and demands it EQUAL the damage under the engine's own word, having first proved
 * that the knob does anything at all -- `sun` must beat no-weather on the same Flamethrower, or the
 * equality below would be satisfied by a boundary that deletes weather entirely. Three arms printed.
 *
 * WHY IT LIVES HERE AND NOT ONLY IN A PARITY RUN: a parity run is a one-off. The census is what stops
 * `S.field.weather = f.weather` being written back by the next person tidying the function. */
probe('move', 'boardWeatherLanguage', "a board's Showdown weather name reaches the damage formula", () => {
  const RL = require(D('engine', 'rollout_leaf.js'));
  const S = { field: {} };
  RL.applyField(S, { weather: 'sunnyday' }, 'p1', true);
  const landed = S.field.weather;
  const att = bare('charizard'), def = bare('garchomp');
  const dmg = (wx) => M.dmgRange(att, def, MC.moves['flamethrower'], Object.assign(fresh(), { weather: wx }), false).max;
  const none = dmg(''), sun = dmg('sun'), got = dmg(landed);
  return { works: sun > none && got === sun,
           detail: `applyField('sunnyday') -> ${JSON.stringify(landed)}; Flamethrower max: clear ${none}, 'sun' ${sun}, as landed ${got}` };
});

/* TERRAIN IS THE SAME TWO-VOCABULARY SPLIT AS THE WEATHER, AND IT IS SPLIT INSIDE THE ENGINE TOO.
 *
 * `board.startField` stores `norm(move.terrain)`, so a board carries `electricterrain`. The artifact's
 * `terrainSetter` carries `electric`. medicham2 then reads BOTH and agrees with NEITHER consistently:
 * Hadron Engine (:576) and Grassy Glide (:97) test the SHORT word, and Psychic Terrain's priority
 * block (:144) tests the LONG one. Measured on the shipped engine before the fix:
 *
 *     Surf under Hadron Engine     clear 99   'electric' 130   'electricterrain' 99
 *     priorityRefusedAbove         'psychic' Infinity          'psychicterrain' 0
 *     movePriority(grassyglide)    'grassy' 1                  'grassyterrain' 0
 *
 * So Psychic Surge — which sets `psychic` from the artifact — never blocked a priority move, and a
 * mid-battle board carrying `electricterrain` never boosted or hastened anything.
 *
 * BOTH SITES AND BOTH VOCABULARIES, because fixing one direction and breaking the other reads
 * identical from a single arm. The engine's own word must beat clear (or the knob is unwired and the
 * agreement is meaningless), and the board's word must equal the engine's word. */
probe('move', 'boardTerrainLanguage', "a board's Showdown terrain name reaches the engine", () => {
  const RL = require(D('engine', 'rollout_leaf.js'));
  const S = { field: {} };
  RL.applyField(S, { terrain: 'electricterrain' }, 'p1', true);
  const landed = S.field.terrain;
  const att = bare('milotic'), def = bare('garchomp');
  att.ability = 'hadronengine';
  const dmg = (t) => M.dmgRange(att, def, MC.moves['surf'], Object.assign(fresh(), { terrain: t }), false).max;
  const none = dmg(''), eng = dmg('electric'), got = dmg(landed);
  /* The OTHER site, in the OTHER direction: this one already spoke the board's word and not the
   * artifact's. Infinity means nothing is refused. */
  const bar = (t) => M.priorityRefusedAbove([bare('garchomp')], { terrain: t });
  const pClear = bar(''), pEng = bar('psychic'), pBoard = bar('psychicterrain');
  return { works: eng > none && got === eng && pClear === Infinity && pEng === 0 && pBoard === 0,
           detail: `applyField('electricterrain') -> ${JSON.stringify(landed)}; Surf under Hadron Engine: `
                 + `clear ${none}, 'electric' ${eng}, as landed ${got}; priorityRefusedAbove: `
                 + `clear ${pClear}, 'psychic' ${pEng}, 'psychicterrain' ${pBoard}` };
});

/* CLICKING A TERRAIN MOVE. `playerAction` had a branch for the four weather moves and none for the
 * four terrain moves, so Psychic Terrain resolved to `kind: pass` — a spent turn that changed nothing.
 * 141 corpus uses, and it is the move half of the same mechanic terrainId was written for: the
 * artifact's `setsTerrain` param carries the LONG spelling (`psychicterrain`) while `terrainSetter`
 * on the ability side carries the SHORT one, so this branch is what makes the translation load-bearing
 * rather than decorative.
 *
 * THE OUTCOME IS A BLOCKED PRIORITY MOVE, not the value of a field variable. Reading
 * `S.field.terrain` back would pass on an engine that stored a string nothing reads — which is the
 * entire defect this pass exists to fix. The control clicks nothing and must TAKE the Ice Shard. */
probe('move', 'setsTerrain', 'clicking Psychic Terrain blocks the foe\'s priority move', () => {
  const run = (click) => {
    const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'weavile', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, click ? M.playerAction(me, 'psychicterrain', null, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'iceshard', me, S.field)], [f2, { kind: 'pass' }]]));
    return { took: before - me.curHP, terrain: S.field.terrain };
  };
  const off = run(false), on = run(true);
  return { works: off.took > 0 && on.took === 0,
           detail: `Ice Shard into the user: no click ${off.took} (terrain ${JSON.stringify(off.terrain)}), `
                 + `after Psychic Terrain ${on.took} (terrain ${JSON.stringify(on.terrain)})`,
           arms: { control: off.took, test: on.took } };
});

/* WIRE 117 -- THE OTHER HALF OF THE SAME MECHANIC, AND THE PROBE ABOVE COULD NOT SEE IT.
 *
 * Will: *"Psych terrain is sorta like queenly majesty"*. He is right, and that is exactly why this
 * was broken: both resolve through `priorityRefusedAbove`, and the terrain branch sat OUTSIDE the
 * defender loop and never inspected a body. Real Psychic Terrain refuses priority only against a
 * GROUNDED target, so MEDICHAM was refusing Fake Out -- 12,872 corpus uses, one of the most-clicked
 * moves in the format -- into every Flying type and every Levitate body on the field.
 *
 * The probe above stages the block against a Garchomp and passes either way. A mechanic with a SCOPE
 * needs a probe per side of the scope, or the passing half covers the failing half; that is the
 * lesson the weather rocks and Purifying Salt both taught this file already.
 *
 * EVERY EXPECTED VALUE BELOW CAME OUT OF THE OFFICIAL ENGINE, played at the pinned commit under
 * gen9championsvgc2026regmb -- Incineroar's Fake Out into a Psychic Terrain set by the opposing
 * Indeedee's Psychic Surge, both arms printed before a line of engine changed:
 *
 *     Garchomp    (grounded)              |-activate|move: Psychic Terrain   BLOCKED, 0 damage
 *     Talonflame  (Fire/Flying)           |-hint| "doesn't affect airborne"  LANDS, 237 -> 216
 *     Hydreigon   (Levitate)              |-hint| "doesn't affect airborne"  LANDS, 251 -> 233
 *     Orthworm    (Earth Eater)           |-activate|move: Psychic Terrain   BLOCKED, 0 damage
 *     Talonflame  (Flying + Iron Ball)    |-activate|move: Psychic Terrain   BLOCKED
 *
 * FIVE ARMS, AND EACH ONE IS THERE TO KILL A DIFFERENT WRONG ENGINE. Grounded-blocked alone passes
 * on the shipped-broken engine. Flying-lands alone would pass on an engine that had deleted the
 * terrain entirely. EARTH EATER is the over-match control and is the reason this is not derived from
 * `typeImmunity {type:'Ground'}`: that tag's membership is levitate, eelevate AND eartheater, and
 * Orthworm is Ground-immune while standing squarely on the floor. IRON BALL is the clause that
 * outranks Flying, and it is legal in this format (isNonstandard null, 113 corpus uses) while Air
 * Balloon is not (isNonstandard 'Past'). */
probe('move', 'setsTerrain', 'Psychic Terrain refuses priority only against a GROUNDED target', () => {
  /* The terrain is written straight onto the field because Fake Out is a TURN-1 move: clicking
   * Psychic Terrain first, as the probe above does, spends the turn Fake Out needs. */
  const took = (sp, terrain, ab, item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'incineroar', sp, 'garchomp');
    if (ab) f1.ability = ab;
    if (item) f1.item = item;
    S.field.terrain = terrain;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'fakeout', f1, S.field)], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    return before - f1.curHP;
  };
  const seen0 = M.seen.terrainSparedAirborne;
  const gC = took('garchomp', ''), gP = took('garchomp', 'psychic');
  const fC = took('talonflame', ''), fP = took('talonflame', 'psychic');
  const lC = took('garchomp', '', 'levitate'), lP = took('garchomp', 'psychic', 'levitate');
  const eC = took('garchomp', '', 'eartheater'), eP = took('garchomp', 'psychic', 'eartheater');
  const bC = took('talonflame', '', null, 'ironball'), bP = took('talonflame', 'psychic', null, 'ironball');
  /* THE COUNTER IS PART OF THE ASSERTION, not a diagnostic beside it. `terrainSparedAirborne` counts
   * the branch that did not exist before this wire, and CLAUDE.md's rule is that a capability which
   * cannot prove it ran is assumed broken. A zero here with the damage arms passing would mean the
   * damage came through some other route. */
  const spared = M.seen.terrainSparedAirborne - seen0;
  const works = gC > 0 && gP === 0        // grounded: refused
             && fC > 0 && fP === fC       // Flying: lands, undiminished
             && lC > 0 && lP === lC       // Levitate: lands
             && eC > 0 && eP === 0        // Earth Eater is GROUNDED: refused
             && bC > 0 && bP === 0        // Iron Ball drags a Flying type down: refused
             && spared > 0;               // and the branch says so
  return { works,
           detail: `Fake Out damage, clear -> Psychic Terrain: Garchomp ${gC}->${gP} (must be 0), `
                 + `Talonflame ${fC}->${fP} (must not move), Levitate ${lC}->${lP} (must not move), `
                 + `Earth Eater ${eC}->${eP} (grounded, must be 0), `
                 + `Flying+Iron Ball ${bC}->${bP} (grounded, must be 0); `
                 + `seen.terrainSparedAirborne +${spared} (must be > 0)`,
           arms: { control: [gP, eP, bP], test: [fP, lP, fC] } };
});

/* WIRE 117, THE SAME PREDICATE ONE FIELD OVER. Grassy Terrain heals only a GROUNDED body, and this
 * engine's copy of the rule applied the TYPE half and healed a Levitate body anyway -- while COUNTING
 * that it was doing so, in `MEDFAILS.terrainHealUngrounded`. A declared gap with a counter on it is
 * still a gap; the counter kept it alive for a whole pass after the derivation it said was
 * unavailable had landed. It is a separate probe from the priority one on purpose: two mechanics that
 * share a predicate drift apart the moment one passing number is asked to cover both.
 *
 * THE CONTROL MUST HEAL. "Levitate is not healed" is satisfied by a terrain that heals nobody, which
 * is exactly what WIRE 72 found the last time this branch was touched. */
probe('move', 'perTurnHP', 'Grassy Terrain heals a grounded body and not an airborne one', () => {
  const seen0 = M.seen.terrainHealSkippedAirborne;
  const healed = (sp, ab) => {
    const { me, ally, f1, f2, S } = board(sp, 'incineroar', 'milotic', 'weavile');
    if (ab) me.ability = ab;
    me.curHP = Math.floor(me.st.hp / 2);
    S.field.terrain = 'grassy'; S.field.terrainT = 5;
    const before = me.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    return me.curHP - before;
  };
  const ground = healed('garchomp', null);
  const lev = healed('garchomp', 'levitate');
  const fly = healed('talonflame', null);
  const skipped = M.seen.terrainHealSkippedAirborne - seen0;
  return { works: ground > 0 && lev === 0 && fly === 0 && skipped === 2,
           detail: `HP gained under Grassy Terrain: grounded Garchomp +${ground} (must be > 0), `
                 + `Levitate +${lev} (must be 0), Flying Talonflame +${fly} (must be 0); `
                 + `seen.terrainHealSkippedAirborne +${skipped} (must be 2)`,
           arms: { control: ground, test: lev } };
});

/* ---- THE TOP OF THE UNPROBED LIST, worked in descending corpus usage --------------------------- */

/* `moveClass` — 76,625 uses, the largest unprobed tag in the artifact. It is a CLASSIFICATION, so it
 * can only be seen through a consumer that reacts to it: `boostsMoveClass` (Iron Fist punch x1.2,
 * Sharpness slicing x1.5, Strong Jaw bite x1.5, Mega Launcher pulse x1.5).
 *
 * FOUR ARMS, because two would not separate "Iron Fist does nothing" from "Iron Fist boosts
 * EVERYTHING", which is the more likely bug in a wire that reads a multiplier and forgets the class.
 * Same body, same target, same two moves; only the ability moves. */
probe('move', 'moveClass', 'Iron Fist boosts a punch and leaves a non-punch alone', () => {
  const def = bare('garchomp');
  const hit = (ab, mv) => { const a = bare('incineroar'); a.ability = ab;
    return M.dmgRange(a, def, MC.moves[mv], fresh(), false).max; };
  const pOff = hit('none', 'machpunch'), pOn = hit('ironfist', 'machpunch');
  const oOff = hit('none', 'flareblitz'), oOn = hit('ironfist', 'flareblitz');
  return { works: pOn > pOff && oOn === oOff,
           detail: `Mach Punch (punch): none ${pOff} -> Iron Fist ${pOn}; `
                 + `Flare Blitz (not punch): none ${oOff} -> Iron Fist ${oOn} (must not move)` };
});

/* `statChange` — 64,869 uses, second largest unprobed. The param carries the exact table
 * (`charm -> {atk: -2}`), so the probe asserts the SIZE and not merely that something happened: a
 * generic "drop one stage" wire is the failure this file already found in the setup branch, where
 * every click gave +1 Atk/SpA/Spe and Swords Dance was one-third right. */
probe('move', 'statChange', 'Charm drops the target Attack by exactly two stages', () => {
  const run = (click) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, click ? M.playerAction(me, 'charm', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    return f1.boosts.at;
  };
  const off = run(false), on = run(true);
  return { works: off === 0 && on === -2, detail: `foe atk stage: no click ${off}, after Charm ${on} (the param says -2)` };
});

/* `sound` — 14,797 uses. A FLAG, read through the `immuneToMoveClass` tag; the only way to see it is
 * an ability that refuses the class. Both moves are aimed at the same body with the same ability
 * varied, and the NON-sound arm must still land, or "Soundproof blocks everything" would pass. */
probe('move', 'sound', 'Soundproof refuses a sound move and takes a normal one', () => {
  const run = (ab, mv) => {
    const { me, ally, f1, f2, S } = board('sylveon', 'incineroar', 'milotic', 'garchomp');
    f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const sOff = run('none', 'hypervoice'), sOn = run('soundproof', 'hypervoice');
  const nOff = run('none', 'moonblast'), nOn = run('soundproof', 'moonblast');
  return { works: sOff > 0 && sOn === 0 && nOff > 0 && nOn > 0,
           detail: `Hyper Voice (sound): none ${sOff}, Soundproof ${sOn}; `
                 + `Moonblast (not sound): none ${nOff}, Soundproof ${nOn} (must still land)` };
});

/* `punishesAttacker` — 8,953 uses. WIRE 5 consumes it and no probe carried its NAME, so the census
 * said nothing about it. Staged on the ability's own trigger: Rough Skin is `trigger: contact`, so the
 * special arm must cost the attacker NOTHING — a wire that punished every hit is the likelier bug and
 * a contact-only probe would pass on it. */
probe('ability', 'punishesAttacker', 'Rough Skin tolls a contact hit and not a special one', () => {
  const run = (ab, mv) => {
    const { me, ally, f1, f2, S } = board('milotic', 'corviknight', 'garchomp', 'garchomp');
    f1.ability = ab;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - me.curHP;
  };
  const cOff = run('none', 'waterfall'), cOn = run('roughskin', 'waterfall');
  const sOff = run('none', 'surf'), sOn = run('roughskin', 'surf');
  return { works: cOff === 0 && cOn > 0 && sOff === 0 && sOn === 0,
           detail: `Waterfall (contact): none ${cOff} -> Rough Skin ${cOn}; `
                 + `Surf (special): none ${sOff} -> Rough Skin ${sOn} (must stay 0)` };
});

/* `reflectsStatusMoves` — 568 uses (Magic Bounce). The status move must come BACK, not merely fail:
 * a refusal reads identical on the target and the difference is entirely on the USER, which is why
 * both bodies' stages are printed. */
probe('ability', 'reflectsStatusMoves', 'Magic Bounce sends Charm back at its user', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'espathra', 'garchomp');
    f1.ability = ab;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'charm', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { target: f1.boosts.at, user: me.boosts.at };
  };
  const off = run('none'), on = run('magicbounce');
  return { works: off.target === -2 && off.user === 0 && on.target === 0 && on.user === -2,
           detail: `atk stages (target/user): ability none ${off.target}/${off.user}, `
                 + `Magic Bounce ${on.target}/${on.user}` };
});

/* THE ABSORBED HIT HEALS THE ABSORBER, and `tests/test-tag-wire.js` has printed "(1 -> 1)" on this
 * wire since before 2026-08-04 -- Volt Absorb took the hit and gained nothing.
 *
 * STAGED SO THE EFFECT CAN SHOW: the absorber is put on half HP first. A full-HP Jolteon cannot heal
 * and would read identical to a broken engine, which is Lesson 5 in the form that has caught nine
 * probes in this file. The control is the SAME body with the ability off, taking the same move on the
 * same HP -- it must LOSE hp, or "gained nothing" would be indistinguishable from "was not hit". */
probe('ability', 'typeImmunityHeals', 'Volt Absorb heals a quarter off the move it absorbs', () => {
  const run = (ab) => {
    const me = bare('jolteon'), ally = bare('incineroar');
    const f1 = bare('archaludon'), f2 = bare('garchomp');
    me.ability = ab;
    me.curHP = Math.floor(me.st.hp / 2);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'thunderbolt', me, S.field)], [f2, { kind: 'pass' }]]));
    return { d: me.curHP - before, quarter: Math.floor(me.st.hp / 4) };
  };
  const off = run('none'), on = run('voltabsorb');
  return { works: off.d < 0 && on.d === on.quarter,
           detail: `hp change: ability none ${off.d}, Volt Absorb ${on.d} (a quarter is ${on.quarter})` };
});

/* ENCORE PINS THE FOE TO ITS LAST MOVE, and `tests/test-tag-wire.js` has printed
 * "(undefined) for undefined turns" on this wire since before 2026-08-04 -- the consumer existed in
 * the `kind==='status'` branch and could never be reached, because playerAction classifies Encore as
 * `affect`.
 *
 * THE FIRST VERSION OF THIS PROBE WAS WRONG, which makes eleven. It handed the foe a FORCED action on
 * the pinned turn, and a forced action bypasses chooseAction entirely -- so it measured the caller's
 * obedience, not the engine's. The foe is now left COMPLETELY FREE on the pinned turn and what it
 * picks is the measurement, which is how the Disable probe below was already staged.
 *
 * BOTH ARMS PRINTED, AND STAGED THE OPPOSITE WAY ROUND FROM THE DISABLE PROBE BELOW, on purpose. Here
 * the committed move is one the foe would NOT choose again (Rock Slide, where the chooser prefers
 * Earthquake), so the control moves ON and only the pin can hold it. There the committed move is the
 * foe's own free pick, so the control REPEATS and only the seal can move it. The pair is only
 * meaningful if each control shows the behaviour its mechanic has to overturn.
 *
 * THE PIN CANNOT SHOW ON THE ENCORE TURN ITSELF: every action in a turn is chosen before any of them
 * resolves, so the foe had already picked when the Encore landed. It is read a turn later. */
probe('move', 'sealsMoves', 'Encore pins the foe to the move it just used', () => {
  const run = (encore) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'rockslide', me, S.field)], [f2, { kind: 'pass' }]]));
    const committed = f1._lastMove;
    M.battleTurn(S, rng5,
      new Map([[me, encore ? M.playerAction(me, 'encore', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    M.battleTurn(S, rng5, PASS2(me, ally), new Map([[f2, { kind: 'pass' }]]));
    const rec = (S.lastActs || []).find(x => x.side === 'B');
    return { committed, then: rec && (rec.move || rec.kind) };
  };
  const free = run(false), pinned = run(true);
  return { works: !!free.committed && free.then !== free.committed && pinned.then === pinned.committed,
           detail: `foe committed ${free.committed}; free choice two turns later was ${free.then}, after Encore ${pinned.then}` };
});

/* ---- BATCH 8 — THE WHOLE WEATHER SURFACE, AUDITED AT ONCE ---------------------------------------
 *
 * Will, 2026-08-04: *"Weather is something that is the deciding factor in like every game so we need
 * to get it bulletproof."*
 *
 * WHY A BATCH AND NOT ANOTHER PROBE. Weather was found broken FOUR separate times in one day, each by
 * a different route: the leaf boundary handed the engine `Sandstorm` while it compared against `sand`;
 * `applyMegaWeather` never fired; the engine had no sandstorm residual at all and the probe passed by
 * matching `magmaarmor` in the FREEZE table; and board.js maps the two weathers this format cannot
 * produce. Four independent discoveries means they were being found one at a time by luck. So every
 * path is probed here at once and each is treated as guilty until measured — setting, DURATION,
 * expiry, the offensive multipliers in both directions, the defensive ones, the residual and its
 * absence in snow, accuracy, the weather-dependent moves and the weather-dependent abilities.
 *
 * ALL ARMED. Every probe in this batch returns `arms: {control, test}`, so none of them can be a
 * one-armed pass — see the comment on probe(). */

/* THE DURATION AND THE EXPIRY, which is the class the single-hit differential structurally cannot
 * see. Five turns, of which the setter's own is one, so a Flamethrower is still boosted on turn 5 and
 * is NOT on turn 6. Read through real damage rather than off the field string, because a field value
 * nothing reads is worth nothing — the exact failure the leaf boundary had. */
probe('move', 'weatherDuration', 'Sunny Day lasts five turns and then stops boosting Fire', () => {
  const run = (idle) => {
    const { me, ally, f1, f2, S } = board('torkoal', 'incineroar', 'garchomp', 'garchomp');
    me.ability = 'none';
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'sunnyday', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    for (let t = 0; t < idle; t++) M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    return { w: S.field.weather || '', t: S.field.weatherT | 0,
             dmg: M.dmgRange(me, f1, MC.moves['flamethrower'], S.field, false).max };
  };
  const t1 = run(0), t4 = run(3), t5 = run(4);
  return { works: t1.w === 'sun' && t4.w === 'sun' && t5.w !== 'sun' && t4.dmg > t5.dmg,
           arms: { control: [t4.w, t4.dmg], test: [t5.w, t5.dmg] },
           detail: `turn 1 weather ${t1.w} (${t1.t} left) Flamethrower ${t1.dmg}; `
                 + `after 3 idle turns ${t4.w} (${t4.t}) ${t4.dmg}; after 4 idle turns `
                 + `${t5.w || 'CLEAR'} (${t5.t}) ${t5.dmg}` };
});

/* HEAT ROCK, and the artifact has carried the number all along: `extendsDuration {extends:["sunnyday"],
 * toTurns:8}`. The SCREEN branch reads that tag (Light Clay); the WEATHER branch wrote a literal 5, so
 * the four rocks were inert on the mechanic they exist for. Same tag, same shape, one consumer short. */
probe('item', 'extendsDuration', 'Heat Rock keeps the sun up past turn five', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('torkoal', 'incineroar', 'garchomp', 'garchomp');
    me.ability = 'none'; me.item = item;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'sunnyday', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    for (let t = 0; t < 5; t++) M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    return S.field.weather || 'CLEAR';
  };
  const control = run(''), test = run('heatrock');
  return { works: control === 'CLEAR' && test === 'sun', arms: { control, test },
           detail: `turn 6 weather: no item ${control}, Heat Rock ${test}` };
});

/* THE OFFENSIVE MULTIPLIERS, BOTH DIRECTIONS AND BOTH WEATHERS. A wire that boosted the matching type
 * and forgot the halve is the likelier bug and reads as working on a two-armed probe. */
probe('move', 'weatherDamageMult', 'sun raises Fire and halves Water, rain does the reverse', () => {
  const att = bare('charizard'), def = bare('garchomp');
  const at = (w, mv) => M.dmgRange(att, def, MC.moves[mv], Object.assign(fresh(), { weather: w }), false).max;
  const fire = [at('', 'flamethrower'), at('sun', 'flamethrower'), at('rain', 'flamethrower')];
  const water = [at('', 'surf'), at('sun', 'surf'), at('rain', 'surf')];
  return { works: fire[1] > fire[0] && fire[2] < fire[0] && water[1] < water[0] && water[2] > water[0],
           arms: { control: fire, test: water },
           detail: `Flamethrower clear/sun/rain ${fire.join('/')};  Surf clear/sun/rain ${water.join('/')}` };
});

/* THE DEFENSIVE ONES, which are passive properties of the weather rather than abilities and which no
 * ability chain could ever have caught. Re-measured rather than assumed to have survived this
 * session's changes. The control is a body of the WRONG type in the same weather. */
probe('move', 'weatherDefenceMult', 'sand raises a Rock SpD and snow raises an Ice Def', () => {
  const spec = bare('alakazam'), phys = bare('garchomp');
  const rock = bare('tyranitar'), notRock = bare('milotic');
  const ice = bare('weavile'), notIce = bare('incineroar');
  const at = (att, def, mv, w) => M.dmgRange(att, def, MC.moves[mv], Object.assign(fresh(), { weather: w }), false).max;
  const sandRock = [at(spec, rock, 'shadowball', ''), at(spec, rock, 'shadowball', 'sand')];
  const sandOther = [at(spec, notRock, 'shadowball', ''), at(spec, notRock, 'shadowball', 'sand')];
  const snowIce = [at(phys, ice, 'earthquake', ''), at(phys, ice, 'earthquake', 'snow')];
  const snowOther = [at(phys, notIce, 'earthquake', ''), at(phys, notIce, 'earthquake', 'snow')];
  return { works: sandRock[1] < sandRock[0] && sandOther[1] === sandOther[0]
                  && snowIce[1] < snowIce[0] && snowOther[1] === snowOther[0],
           arms: { control: [sandOther, snowOther], test: [sandRock, snowIce] },
           detail: `Shadow Ball into Rock clear/sand ${sandRock.join('/')} (into Water ${sandOther.join('/')}, `
                 + `must not move);  Earthquake into Ice clear/snow ${snowIce.join('/')} `
                 + `(into Fire ${snowOther.join('/')}, must not move)` };
});

/* ACCURACY, BOTH DIRECTIONS. Thunder is 70 in clear skies, cannot miss in rain and drops to 50 in sun.
 * A wire that only knew about rain would pass a two-armed probe and be wrong on every sun board. */
probe('move', 'weatherAccuracy', 'Thunder never misses in rain and is worse in sun', () => {
  const at = w => M.moveAccuracy('thunder', Object.assign(fresh(), { weather: w }));
  const clear = at(''), rain = at('rain'), sun = at('sun');
  return { works: rain === 100 && clear < 100 && sun < clear,
           arms: { control: clear, test: [rain, sun] },
           detail: `Thunder accuracy: clear ${clear}, rain ${rain}, sun ${sun}` };
});

/* WEATHER BALL CHANGES ITS TYPE AS WELL AS ITS POWER, and the type is the half that decides whether it
 * hits at all — so it is asked through a HARD ZERO, which no partial implementation can fake.
 *
 * THE FIRST VERSION FIRED IT AT A GARCHOMP AND REPORTED THE ENGINE BROKEN, which makes twenty-two.
 * Garchomp is Dragon/GROUND, so the sand form (Rock) is RESISTED — 100 BP at x0.5 is the same number
 * as 50 BP at x1, and `sand 43 vs clear 44` looked exactly like a dead knob. The engine was right and
 * the type chart was doing its job. Gengar is Ghost/Poison: NORMAL does literally nothing to it and
 * Water, Fire, Rock and Ice all land, so the clear-sky arm is 0 and every weather arm must not be. */
probe('move', 'weatherBall', 'Weather Ball becomes a different move in each sky', () => {
  const att = bare('alakazam'), def = bare('gengar');
  const at = w => M.dmgRange(att, def, MC.moves['weatherball'], Object.assign(fresh(), { weather: w }), false).max;
  const clear = at(''), rain = at('rain'), sun = at('sun'), sand = at('sand'), snow = at('snow');
  return { works: clear === 0 && rain > 0 && sun > 0 && sand > 0 && snow > 0,
           arms: { control: clear, test: [rain, sun, sand, snow] },
           detail: `Weather Ball max into Gengar (Ghost, immune to NORMAL): clear ${clear} (must be 0), `
                 + `rain ${rain} (Water), sun ${sun} (Fire), sand ${sand} (Rock), snow ${snow} (Ice)` };
});

/* SWIFT SWIM ONLY IN ITS OWN WEATHER. `speedCond` is already probed through Chlorophyll, and a wire
 * that doubled Speed in ANY weather would pass that probe — so the third arm is the WRONG sky. */
probe('ability', 'speedCondWrongWeather', 'Swift Swim doubles Speed in rain and does nothing in sun', () => {
  const m = bare('basculegion'); m.item = '';
  const at = (ab, w) => { m.ability = ab; return M.effSpeed(m, Object.assign(fresh(), { weather: w }), 'A'); };
  const off = at('none', 'rain'), on = at('swiftswim', 'rain'), wrong = at('swiftswim', 'sun');
  return { works: on > off * 1.9 && wrong === off, arms: { control: [off, wrong], test: on },
           detail: `speed in rain: ability none ${off}, Swift Swim ${on}; Swift Swim in SUN ${wrong} `
                 + '(must equal the no-ability number)' };
});

/* SOLAR POWER raises Special Attack in sun and must leave a PHYSICAL move alone — the natural
 * mis-statement of the rule is "it boosts damage in sun", and that version is wrong on half the
 * movepool of every body that carries it. */
probe('ability', 'solarPower', 'Solar Power raises a special move in sun and not a physical one', () => {
  const off = bare('charizard'), on = bare('charizard');
  on.ability = 'solarpower';
  const def = bare('garchomp');
  const at = (m, mv, w) => M.dmgRange(m, def, MC.moves[mv], Object.assign(fresh(), { weather: w }), false).max;
  const spec = [at(off, 'flamethrower', 'sun'), at(on, 'flamethrower', 'sun')];
  const phys = [at(off, 'earthquake', 'sun'), at(on, 'earthquake', 'sun')];
  const noSun = [at(off, 'flamethrower', ''), at(on, 'flamethrower', '')];
  return { works: spec[1] > spec[0] && phys[1] === phys[0] && noSun[1] === noSun[0],
           arms: { control: [phys, noSun], test: spec },
           detail: `in sun, Flamethrower ${spec.join(' -> ')}; Earthquake ${phys.join(' -> ')} (must not move); `
                 + `no sun, Flamethrower ${noSun.join(' -> ')} (must not move)` };
});

/* THE MEGA'S WEATHER, and this is the path PRIORITIES #37 and #40b are both about. A mega body must
 * set the weather its MEGA ability names, not its base forme's — Charizard's Blaze sets nothing and
 * Charizard-Mega-Y's Drought sets sun. Driven through a real battleInit rather than by calling
 * applyEntryEffects by hand, because the entry path is where both of those bugs lived. */
probe('ability', 'megaWeatherSetter', 'a mega sets the weather its MEGA ability names', () => {
  /* THE CONTROL HAD A CHARIZARDITE IN IT, which makes twenty-three and is the ORIGINAL Choice Scarf
     mistake verbatim: buildMon hands a Pokemon its USAGE item, and Charizard's is Charizardite Y, so
     the "base forme" arm was already a mega and already set sun. The item is blanked and the ability
     forced to the base forme's, so the two arms differ by exactly the mega. */
  const run = (sp, ab) => {
    const me = M.buildMon(sp, {}); if (!me) return 'NO ROW';
    me.item = ''; if (ab) me.ability = ab;
    const ally = bare('incineroar'), f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], {});
    return S.field.weather || 'CLEAR';
  };
  const control = run('charizard', 'blaze'), test = run('charizard-mega-y', null);
  return { works: control === 'CLEAR' && test === 'sun', arms: { control, test },
           detail: `base Charizard (Blaze) sets ${control}; Charizard-Mega-Y (Drought) sets ${test}` };
});

/* AIR LOCK AND CLOUD NINE — PROBED AND DECLARED ABSENT, WITH THE NUMBER. They suppress every weather
 * effect while they are on the field, and NOTHING in this engine reads either: `cloudnine` carries
 * `untagged` in data/tags.json and `airlock` carries no entry at all, so there is no artifact to wire
 * from and no consumer to wire it into. This probe exists so the gap is a CENSUS ROW rather than a
 * sentence in a document — the census is the only place a claim about the engine cannot be softened.
 * It reads MISSING on purpose and will keep reading MISSING until somebody derives the tag. */
probe('ability', 'weatherSuppression', 'Air Lock stops the sun boosting Fire', () => {
  const att = bare('charizard'), def = bare('garchomp');
  const run = (ab) => { def.ability = ab;
    return M.dmgRange(att, def, MC.moves['flamethrower'], Object.assign(fresh(), { weather: 'sun' }), false).max; };
  const control = run('none'), test = run('airlock');
  return { works: control > test, arms: { control, test },
           detail: `Flamethrower in sun: plain defender ${control}, Air Lock defender ${test} `
                 + '(must be the clear-weather number)' };
});

/* ---- BATCH 9 — WHAT THE GENERATED INTERACTION MATRIX FOUND, 2026-08-04 --------------------------
 *
 * `tests/interaction_matrix.js` enumerates the cross product of every carrier tag against every
 * reactor tag and `tests/test-interaction-matrix.js` plays each case against the official engine. Six
 * of these seven mechanics were found by it and not one of them was reachable from a single-mechanic
 * probe -- which is the argument for the instrument, and the reason each finding gets a CENSUS row
 * here rather than living in a report: the matrix is a residual and the census is a ratchet.
 *
 * TWO OF THEM WERE ONLY VISIBLE AS A PAIR. WIRE 74 (the sandstorm chipping on the turn it expires) is
 * a single tick of 1/16 and is invisible against any sand probe; it shows up because Grassy Terrain
 * heals exactly the 1/16 the sand takes, so the two cancel and the extra tick is the ONLY HP left on
 * the table. Both probes below therefore assert a NET, and that is deliberate. */

/* WIRE 72. Grassy Terrain carries `perTurnHP` for the terrain's own heal, and the `perTurnHP` branch
 * in playerAction sits above the terrain branch -- so the one terrain move in the format that also
 * heals was the one terrain move the engine could not set. Asserted over the WHOLE tag, not over
 * Grassy Terrain alone: a per-member probe is what let three of four members pass while the fourth
 * was dead. The control is a status move that must NOT resolve to a terrain. */
probe('move', 'setsTerrainEveryMember', 'every setsTerrain move actually resolves to a terrain', () => {
  const me = bare('venusaur');
  const kindOf = (id) => { const a = M.playerAction(me, id, null, fresh()); return a ? a.kind : 'none'; };
  const members = ['psychicterrain', 'electricterrain', 'grassyterrain', 'mistyterrain'];
  const got = members.map(id => id + '=' + kindOf(id));
  const control = kindOf('swordsdance');
  const test = members.every(id => kindOf(id) === 'terrain') ? 'terrain' : 'not-all-terrain';
  return { works: test === 'terrain' && control !== 'terrain', arms: { control, test },
           detail: got.join(' ') + '   control swordsdance=' + control };
});

/* WIRE 73 + WIRE 74 together, as a NET. Grassy Terrain heals 1/16 a turn; sandstorm takes 1/16 a
 * turn. With both up the body must be exactly level. Three arms, because two cannot attribute it:
 * sand alone must cost a sixteenth, grassy alone must gain one, and the two together must be zero. */
probe('move', 'terrainPassiveHeal', 'Grassy Terrain heals 1/16 a turn and cancels the sandstorm', () => {
  const run = (wx, ter) => {
    const me = bare('milotic'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    me.curHP = Math.floor(me.st.hp / 2);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    S.field.weather = wx; S.field.weatherT = wx ? 5 : 0;
    S.field.terrain = ter; S.field.terrainT = ter ? 5 : 0;
    const before = me.curHP;
    const pass2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, pass2(me, ally), pass2(f1, f2));
    return me.curHP - before;
  };
  const sixteenth = Math.floor(bare('milotic').st.hp / 16);
  const sandOnly = run('sand', ''), grassOnly = run('', 'grassy'), both = run('sand', 'grassy');
  return { works: sandOnly === -sixteenth && grassOnly === sixteenth && both === 0,
           arms: { control: sandOnly, test: both },
           detail: `a sixteenth is ${sixteenth}; sand only ${sandOnly}, grassy only ${grassOnly}, both ${both} (must be 0)` };
});

/* WIRE 74's own arm, stated as a COUNT rather than as a net, because the net above would also pass on
 * an engine that got the weather right and the terrain wrong. A five-turn sandstorm deals FOUR ticks
 * in the official engine: it clears the weather at the top of its residual, so the last turn does not
 * chip. Nothing about the COUNTER was ever wrong, which is why nothing had caught this. */
probe('move', 'weatherChipStopsOnExpiry', 'a 5-turn sandstorm chips 4 times, not 5', () => {
  const me = bare('milotic'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  S.field.weather = 'sand'; S.field.weatherT = 5;
  const sixteenth = Math.floor(me.st.hp / 16);
  const pass2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);
  let ticks = 0;
  for (let t = 0; t < 8; t++) {
    const before = me.curHP;
    M.battleTurn(S, rng5, pass2(me, ally), pass2(f1, f2));
    if (before - me.curHP === sixteenth) ticks++;
  }
  /* The control is the number the engine used to produce — a tick on every turn the clock was
   * non-zero — so an engine that ticks on expiry fails this and cannot be confused with one that
   * never ticked at all (which would read 0). */
  return { works: ticks === 4, arms: { control: 5, test: ticks },
           detail: `ticks over 8 idle turns of a 5-turn sandstorm: ${ticks} (the official engine deals 4)` };
});

/* WIRE 75. `convertsMoveType.converts` names either a capitalised TYPE ("Normal moves") or a
 * lowercase FLAG ("sound moves"), and the engine read only the type half — so Liquid Voice (346 uses)
 * left Psychic Noise Psychic. Staged on a body where the conversion CHANGES the number in a direction
 * the type chart cannot produce by accident: Primarina is Water/Fairy, so the converted move gains
 * STAB while losing effectiveness into a Grass/Poison target. */
probe('ability', 'convertsMoveTypeByFlag', 'Liquid Voice makes a sound move Water', () => {
  const att = bare('primarina'), def = bare('venusaur');
  const run = (ab) => { att.ability = ab;
    return M.dmgRange(att, def, MC.moves['psychicnoise'], fresh(), false).max; };
  const control = run('none'), test = run('liquidvoice');
  /* The -ate arm, so "reads the type half" cannot pass this on its own. */
  const attN = bare('pikachu');
  const ateOff = (attN.ability = 'none', M.dmgRange(attN, def, MC.moves['bodyslam'], fresh(), false).max);
  const ateOn = (attN.ability = 'galvanize', M.dmgRange(attN, def, MC.moves['bodyslam'], fresh(), false).max);
  return { works: control !== test && ateOff !== ateOn, arms: { control, test },
           detail: `Psychic Noise: no ability ${control}, Liquid Voice ${test}; `
                 + `Body Slam: no ability ${ateOff}, Galvanize ${ateOn} (the TYPE half must still work)` };
});

/* WIRE 76. docs/TAGS.md: "an immune target takes nothing — not the damage, and not the secondary."
 * `immuneToMoveClass` had one consumer per stage-3 mechanism instead of one per STAGE, so Psychic
 * Noise into Soundproof dealt zero and still applied two turns of Heal Block. The witness is the
 * volatile, not the damage: the damage half has been right since WIRE 22, which is exactly why a
 * damage-shaped probe passes on the broken engine. */
probe('ability', 'immunityBlocksSecondary', 'a Soundproof body takes no Heal Block from Psychic Noise', () => {
  const run = (ab) => {
    const me = bare('primarina'), ally = bare('incineroar');
    const tg = bare('milotic'), f2 = bare('garchomp');
    tg.ability = ab;
    const S = M.battleInit([me, ally], [tg, f2], { seeded: true });
    const act = M.playerAction(me, 'psychicnoise', tg, S.field);
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
      new Map([[tg, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return tg._healBlock > 0;
  };
  const control = run('none'), test = run('soundproof');
  return { works: control === true && test === false, arms: { control, test },
           detail: `heal-blocked after Psychic Noise: plain ${control} (must be true), Soundproof ${test} (must be false)` };
});

/* WIRE 77. The Throat Chop silence was checked inside the ATTACK branch and in chooseAction — one
 * class of action out of a dozen. Roar is a sound move that resolves down the `phaze` branch, so a
 * silenced body phazed anyway. The witness is whether the drag happened. */
probe('move', 'soundSealBlocksEveryKind', 'a silenced body cannot phaze with Roar', () => {
  const run = (seal) => {
    const me = bare('venusaur'), ally = bare('incineroar');
    const tg = bare('milotic'), b1 = bare('corviknight'), b2 = bare('weavile');
    const f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [tg, f2], { seeded: true });
    S.benchB.push(b1, b2);
    if (seal) me._noSound = 3;
    const act = M.playerAction(me, 'roar', tg, S.field);
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
      new Map([[tg, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return S.actB[0] ? S.actB[0].name : 'none';
  };
  const control = run(false), test = run(true);
  return { works: control !== test && test.toLowerCase().indexOf('milotic') === 0,
           arms: { control, test },
           detail: `slot after Roar: not silenced "${control}" (dragged), silenced "${test}" (must still be Milotic)` };
});

/* WIRE 79. `statChangeInCode` with `on:'target'` had a READER (inside the pivot branch, written for
 * Parting Shot) and no CLASSIFIER, so Strength Sap — 637 corpus uses — resolved to `kind:'pass'` and
 * was a wasted turn. Two arms on the same body, because the failure is an unwired knob rather than a
 * wrong number and both look identical in a diff. The move's HEAL is deliberately NOT asserted: it
 * scales off the target's Attack and no artifact this engine reads carries it. */
probe('move', 'statChangeInCodeOnTarget', 'Strength Sap drops the target\'s Attack', () => {
  const me = bare('venusaur'), ally = bare('incineroar');
  const tg = bare('garchomp'), f2 = bare('milotic');
  const S = M.battleInit([me, ally], [tg, f2], { seeded: true });
  const act = M.playerAction(me, 'strengthsap', tg, S.field);
  const control = tg.boosts.at;
  M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
    new Map([[tg, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const test = tg.boosts.at;
  return { works: act.kind !== 'pass' && test === -1, arms: { control, test },
           detail: `strengthsap resolves to kind "${act.kind}" (was "pass"); target atk stage ${control} -> ${test}` };
});

/* WIRE 80. Mummy overwrites the attacker's ability; Wandering Spirit swaps the two. Filed as
 * unfixable by the previous pass on two grounds that were both retired: the dex states the whole rule
 * in one call (`setAbility("mummy", target)` / `skillSwap(source, target)`) and `tag_dex` now derives
 * it, and the "0 corpus sheets" claim no longer holds — mummy 41, wanderingspirit 58.
 * THREE ARMS, because two cannot tell the two modes apart: the INFECT arm must leave the holder's
 * ability alone while rewriting the attacker's, and the SWAP arm must move BOTH. A non-contact move
 * is the fourth arm, since the handler's own gate is contact. */
probe('ability', 'rewritesAbilityOnContact', 'Mummy overwrites and Wandering Spirit swaps, on contact only', () => {
  const run = (holderAb, moveId) => {
    const me = bare('blastoise'), ally = bare('incineroar');
    const tg = bare('milotic'), f2 = bare('garchomp');
    me.ability = 'torrent'; tg.ability = holderAb;
    const S = M.battleInit([me, ally], [tg, f2], { seeded: true });
    const act = M.playerAction(me, moveId, tg, S.field);
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
      new Map([[tg, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return me.ability + '/' + tg.ability;
  };
  const control = run('none', 'wavecrash');            // no rewriter: nothing moves
  const infect = run('mummy', 'wavecrash');            // contact: the attacker becomes Mummy
  const swap = run('wanderingspirit', 'wavecrash');    // contact: the two trade
  const noContact = run('mummy', 'surf');              // no contact: nothing moves
  return { works: control === 'torrent/none' && infect === 'mummy/mummy'
                  && swap === 'wanderingspirit/torrent' && noContact === 'torrent/mummy',
           arms: { control, test: infect },
           detail: `attacker/holder after the hit — no ability ${control}; Mummy ${infect}; `
                 + `Wandering Spirit ${swap}; Mummy hit by SURF (no contact) ${noContact}` };
});

/* WIRE 81. The secondary block read `status`, `targetBoosts` and the flinch, and never `selfBoosts` —
 * so 12 moves and 1,199 corpus uses landed their damage and left the USER's stages alone. Three arms:
 * a 100% self-boost must fire, a same-shaped move with NO self-boost must not (or "boosts everything"
 * passes), and a TARGET-side secondary must still work (or a fix that redirected the wrong way
 * passes). Found by the generated matrix on 23 cases at once. */
probe('move', 'selfBoostSecondary', 'Flame Charge raises the USER\'s Speed on a connecting hit', () => {
  const run = (moveId) => {
    const me = bare('arcanine'), ally = bare('incineroar');
    const tg = bare('milotic'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [tg, f2], { seeded: true });
    const act = M.playerAction(me, moveId, tg, S.field);
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
      new Map([[tg, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { user: me.boosts.sp, target: tg.boosts.sp };
  };
  const control = run('firefang').user;            // contact, same attacker, NO self-boost
  const test = run('flamecharge').user;
  const tgt = run('icywind').target;                // the target-side reader must still work
  return { works: control === 0 && test === 1 && tgt === -1, arms: { control, test },
           detail: `user spe stage — Fire Fang (no self-boost) ${control}, Flame Charge ${test}; `
                 + `and Icy Wind still drops the TARGET to ${tgt}` };
});

/* ---- BATCH 10 — THE PRE-TURN MOVE CLASS (WIRE 82) -----------------------------------------------
 *
 * Will, 2026-08-04: "BEAK BLAST IS LIKE SPICY SPRAY FOCUS PUNCH OR SOMETHING." He is naming a class
 * that nothing in the artifact named. Focus Punch, Beak Blast and Shell Trap commit at the START of
 * the turn and then react to what happened while they waited; `chargeTurn` is a different mechanic
 * and could not carry them.
 *
 * SHELL TRAP IS NOT PROBED AND THAT IS THE FORMAT'S DECISION, NOT A GAP. The derivation reaches it —
 * it matched in the full dex with `{trigger:'physical', foesOnly:true, mode:'failsUnlessHit',
 * thenMovesNext:true}` — and `tag_dex` then drops it because Champions marks it
 * `isNonstandard:'Past'`. That is the answer to "why is Shell Trap untagged", and it generalises:
 * NO TAGS can mean NOT IN THE FORMAT, which is CLAUDE.md's own "ask the format, not a list" rule
 * seen from the other side. `thenMovesNext` therefore has no carrier here and no consumer, stated
 * rather than silently defaulted.
 *
 * BOTH PROBES ARE ARMED AND BOTH WERE WATCHED FAILING on the pre-wire engine:
 *   beakblast  control (bulletseed) none   test (beakblast) none
 *   focuspunch control (foe passes) 183    test (foe attacks) 183 */

/* THE PARAM, NOT ONLY THE TAG. `preTurnShield.trigger` is `contact` for Beak Blast, and a consumer
 * that burned every attacker would read LIVE while modelling the wrong mechanic. So the third arm is
 * a SPECIAL, non-contact hit from the same attacker, which must NOT be burned. */
probe('move', 'preTurnShield', 'Beak Blast burns a contact attacker, and only a contact one', () => {
  const run = (userMove, foeMove) => {
    const { me, ally, f1, f2, S } = board('toucannon', 'incineroar', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, userMove, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, foeMove, me, S.field)], [f2, { kind: 'pass' }]]));
    return f1.status || 'none';
  };
  const control = run('bulletseed', 'aquatail');      // no shield up at all
  const test    = run('beakblast',  'aquatail');      // contact -> burned
  const noTouch = run('beakblast',  'dragonpulse');   // special, no contact -> NOT burned
  return { works: control === 'none' && test === 'brn' && noTouch === 'none',
           arms: { control, test },
           detail: `attacker status — no shield ${control}, Beak Blast + contact ${test}, `
                 + `Beak Blast + a non-contact special ${noTouch}` };
});

/* FOCUS PUNCH, the opposite sign of the same reading. Measured through the DAMAGE it deals rather
 * than a flag, because a flag nothing spends is worth nothing. Third arm: a STATUS move aimed at the
 * user must not break the focus, which is the tag's `trigger: 'damaging'` doing its job. */
probe('move', 'preTurnShieldFails', 'Focus Punch fails if the user was hit first, and not if merely charmed', () => {
  const run = (foeMove) => {
    const { me, ally, f1, f2, S } = board('conkeldurr', 'incineroar', 'garchomp', 'garchomp');
    const hp0 = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'focuspunch', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, foeMove ? M.playerAction(f1, foeMove, me, S.field) : { kind: 'pass' }],
               [f2, { kind: 'pass' }]]));
    return hp0 - f1.curHP;
  };
  const control = run(null), test = run('dragonclaw'), statused = run('swordsdance');
  return { works: control > 0 && test === 0 && statused > 0, arms: { control, test },
           detail: `Focus Punch damage — foe idle ${control}, foe attacks first ${test}, `
                 + `foe sets up (no damage taken) ${statused}` };
});

/* ---- BATCH 11 — THE VARIABLE-POWER FAMILY (WIRE 83) AND PER-HIT REACTORS (WIRE 84) --------------
 *
 * 35 of the interaction matrix's 68 divergences were moves whose dex base power is 0 because the
 * power IS the calculation. `hasPower()` rejected them, so Gyro Ball, Hard Press, Reversal, Electro
 * Ball and Beat Up dealt LITERALLY NOTHING in every rollout ever run. The census reported the same
 * hole from the other side as `needsUntrackedState` and `conditionalPower` MISSING, whose params
 * were prose (`"speed ratio -- computable, not wired"`) and a boolean (`{conditional:true}`). */

probe('move', 'variablePowerAbsolute', 'a move whose base power IS the calculation deals damage at all', () => {
  /* THE HEADLINE ARM: every member of the absolute family used to read 0. Asserted over the WHOLE
   * family rather than one member, which is WIRE 71's lesson — a per-member probe is what let three
   * of four weather routes pass while the fourth was dead. */
  const { me, ally, f1, f2, S } = board('torkoal', 'incineroar', 'weavile', 'garchomp');
  const fam = ['gyroball', 'electroball', 'hardpress', 'reversal', 'beatup'];
  const dmgs = fam.map(id => M.dmgRange(me, f1, MC.moves[id], S.field, false).max);
  /* the control is the SHAPE, not another move: a move id the engine has no power rule for at all
     must still read 0, or "everything deals damage" would pass this. */
  const control = M.dmgRange(me, f1, MC.moves['splash'] || { id: 'splash', t: 'Normal', c: 'S', bp: 0 }, S.field, false).max;
  const test = dmgs.every(d => d > 0) ? 'all>0' : 'some zero';
  return { works: test === 'all>0' && control === 0, arms: { control, test },
           detail: fam.map((id, i) => id + ' ' + dmgs[i]).join(' ') + '   control splash ' + control };
});

probe('move', 'speedRatioPower', 'Gyro Ball is stronger the slower you are, Electro Ball the faster', () => {
  const slow = bare('torkoal'), fast = bare('weavile');
  const S = M.battleInit([slow, bare('incineroar')], [fast, bare('garchomp')], { seeded: true });
  /* SAME ATTACKER BOTH ARMS. Swapping the attacker changes the offensive stat and the STAB, which
     would move the number for reasons that have nothing to do with the ratio — so the varied knob
     is the TARGET's Speed on one fixed attacker, set explicitly on both sides. */
  const at = (targetSpe) => { const d = bare('milotic'); d.st.sp = targetSpe; return d; };
  const control = M.dmgRange(slow, at(60), MC.moves['gyroball'], S.field, false).max;
  const test    = M.dmgRange(slow, at(240), MC.moves['gyroball'], S.field, false).max;
  const eb = { slowT: M.dmgRange(fast, at(60), MC.moves['electroball'], S.field, false).max,
               fastT: M.dmgRange(fast, at(240), MC.moves['electroball'], S.field, false).max };
  return { works: test > control && eb.slowT > eb.fastT, arms: { control, test },
           detail: `Gyro Ball into a 60-Speed target ${control}, into a 240-Speed target ${test}; `
                 + `Electro Ball into 60 ${eb.slowT}, into 240 ${eb.fastT} (the other direction)` };
});

probe('move', 'hpScaledPower', 'Hard Press weakens as the target heals, Reversal strengthens as the user is hurt', () => {
  const { me, ally, f1, f2, S } = board('archaludon', 'incineroar', 'milotic', 'garchomp');
  const hp = (mon, frac) => { mon.curHP = Math.max(1, Math.floor(mon.st.hp * frac)); };
  hp(f1, 1); const control = M.dmgRange(me, f1, MC.moves['hardpress'], S.field, false).max;
  hp(f1, 0.2); const test = M.dmgRange(me, f1, MC.moves['hardpress'], S.field, false).max;
  hp(me, 1); const rvFull = M.dmgRange(me, f1, MC.moves['reversal'], S.field, false).max;
  hp(me, 0.01); const rvLow = M.dmgRange(me, f1, MC.moves['reversal'], S.field, false).max;
  return { works: control > test && rvLow > rvFull, arms: { control, test },
           detail: `Hard Press into a full-HP target ${control}, into a 20% one ${test}; `
                 + `Reversal from full ${rvFull}, from 1% ${rvLow}` };
});

probe('move', 'boostScaledPower', 'Stored Power grows with the user\'s positive stages only', () => {
  const { me, ally, f1, f2, S } = board('gardevoir', 'incineroar', 'milotic', 'garchomp');
  const at = (b) => { me.boosts.sa = 0; me.boosts.at = 0; me.boosts.df = 0; Object.assign(me.boosts, b);
                      return M.dmgRange(me, f1, MC.moves['storedpower'], S.field, false).max; };
  const control = at({}), test = at({ sa: 3 });
  const negative = at({ df: -2 });     // a NEGATIVE stage must not add power
  return { works: test > control && negative === control, arms: { control, test },
           detail: `no stages ${control}, +3 SpA ${test}, -2 Def ${negative} (a drop must add nothing)` };
});

/* WIRE 84. The count of REACTION EVENTS was silently 1 for every multi-hit move. The damage is
 * still one packet (WIRE 20's declared divergence, unchanged); this is a different quantity. */
probe('ability', 'reactorPerHit', 'Weak Armor triggers once per hit of a multi-hit move', () => {
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('garchomp', 'incineroar', 'milotic', 'garchomp');
    f1.ability = 'weakarmor';
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [f1.boosts.df, f1.boosts.sp];
  };
  const control = run('dragonclaw');          // one hit
  const test = run('bulletseed');             // 2-5, seeded to 3
  const twice = run('dragondarts');           // fixed 2
  return { works: control[0] === -1 && control[1] === 2 && test[0] === -3 && test[1] === 6
                  && twice[0] === -2 && twice[1] === 4,
           arms: { control, test },
           detail: `def/spe after Dragon Claw ${control.join('/')}, after Bullet Seed (3 hits) `
                 + `${test.join('/')}, after Dragon Darts (2 hits) ${twice.join('/')}` };
});

/* ---- BATCH 12 — WHAT THE SECOND FULL MATRIX RUN FOUND (WIRES 85-89) ----------------------------- */

/* WIRE 85. The priority refusal was checked inside the ATTACK branch only, so Armor Tail and Queenly
 * Majesty refused a Sucker Punch and took a Baby-Doll Eyes. WIRE 77's lesson exactly one field over:
 * a rule that belongs to every action kind goes ABOVE the kind dispatch. */
probe('ability', 'priorityBlockEveryKind', 'Queenly Majesty refuses a priority STATUS move too', () => {
  const run = (ab, mv) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'garchomp', 'milotic', 'garchomp');
    f1.ability = ab;
    const hp0 = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, mv === 'protect' ? { kind: 'protect', mv: 'protect' } : M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, mv === 'protect' ? M.playerAction(f1, 'surf', me, S.field) : { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return mv === 'protect' ? hp0 - me.curHP : f1.boosts.at;
  };
  const control = run('none', 'babydolleyes'), test = run('queenlymajesty', 'babydolleyes');
  /* THE CONTROL THAT MATTERS: Protect is +4 and targets the USER, so Queenly Majesty must NOT
     refuse it. A blanket "block everything above 0 priority" passes the headline and breaks this. */
  const prot = run('queenlymajesty', 'protect');
  return { works: control === -1 && test === 0 && prot === 0, arms: { control, test },
           detail: `target atk after Baby-Doll Eyes — no ability ${control}, Queenly Majesty ${test}; `
                 + `and the user's own Protect still blocks a Surf (${prot} damage taken)` };
});

/* WIRE 86. `userFaints` was wired where DAMAGING moves resolve, so Memento — a status move — dropped
 * the foe -2/-2 and the user walked away. */
probe('move', 'userFaintsStatusMove', 'Memento faints its user, and Charm does not', () => {
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'garchomp', 'milotic', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [me.fainted, f1.boosts.at];
  };
  const control = run('charm'), test = run('memento');
  return { works: control[0] === false && test[0] === true && test[1] < 0,
           arms: { control: control.join('/'), test: test.join('/') },
           detail: `user fainted / target atk — Charm ${control.join(' / ')}, Memento ${test.join(' / ')}` };
});

/* WIRE 87. Order, not magnitude: Showdown drains INSIDE the move and pays the contact toll after, so
 * a full-HP drain move into Rough Skin gains nothing and still pays. medicham2 tolled first and then
 * healed the toll straight back. Only visible from FULL HP, which is why a matrix found it. */
probe('move', 'drainThenPunishOrder', 'a full-HP drain move into Rough Skin still pays the toll', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('sylveon', 'garchomp', 'milotic', 'garchomp');
    f1.ability = ab;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'drainingkiss', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return me.st.hp - me.curHP;
  };
  const control = run('none'), test = run('roughskin');
  return { works: control === 0 && test > 0, arms: { control, test },
           detail: `HP the full-HP user lost — no ability ${control}, Rough Skin ${test} (must be the eighth, not 0)` };
});

/* WIRE 88. Steel Roller fails with no terrain and REMOVES the terrain when it lands. Neither half
 * existed; the engine played it as an unconditional 130 BP Steel move. */
probe('move', 'failsWithoutTerrain', 'Steel Roller fails on a clear field and clears the terrain when it lands', () => {
  const run = (setTerrain) => {
    const { me, ally, f1, f2, S } = board('sandaconda', 'garchomp', 'milotic', 'garchomp');
    if (setTerrain) M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'grassyterrain', null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    const hp0 = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'steelroller', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { dmg: hp0 - f1.curHP, terrain: S.field.terrain || 'clear' };
  };
  const a = run(false), b = run(true);
  return { works: a.dmg === 0 && b.dmg > 0 && b.terrain === 'clear',
           arms: { control: a.dmg, test: b.dmg },
           detail: `clear field: ${a.dmg} damage (must be 0); after Grassy Terrain: ${b.dmg} damage `
                 + `and the terrain is now "${b.terrain}" (must be clear)` };
});

/* WIRE 89. TWO RULEBOOKS state the secondary chance and the engine read the one that is not a
 * FORMAT. `CHOMP/data/move-effects.json` comes from the generic gen-9 move data; `data/tags.json` is
 * derived through Dex.forFormat(Champions). tests/test-rulebook-collision.js measured the whole
 * surface: 149 of 151 comparable facts agree and exactly two do not, Iron Head's flinch (20 here,
 * 30 generic, 7,095 uses) and Toxic Thread's Speed drop. */
probe('move', 'formatSecondaryChance', "Iron Head flinches at this FORMAT's 20%, not the generic 30%", () => {
  const rate = (mv, n) => {
    const b0 = M.seen.flinch;
    for (let i = 0; i < n; i++) {
      const me = bare('archaludon'), ally = bare('incineroar'), f1 = bare('corviknight'), f2 = bare('garchomp');
      f1.st.sp = 1;                       // the target must still be waiting, or a flinch cannot land
      const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
      M.battleTurn(S, Math.random,
        new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    }
    return 100 * (M.seen.flinch - b0) / n;
  };
  const N = 6000;
  /* THE CONTROL IS A MOVE THE TWO RULEBOOKS AGREE ON. Rock Slide is 30% in both, at 90% accuracy, so
     it must land near 27 — an engine that had simply stopped reading any chance would fail it. */
  const control = rate('rockslide', N), test = rate('ironhead', N);
  return { works: Math.abs(test - 20) < 2.5 && Math.abs(control - 27) < 2.5,
           arms: { control: control.toFixed(1), test: test.toFixed(1) },
           detail: `over ${N} turns each — Iron Head ${test.toFixed(1)}% (format 20, generic 30), `
                 + `control Rock Slide ${control.toFixed(1)}% (30% x 90% accuracy = 27)` };
});

/* ---- BATCH 13 — LAYER 0 OF THE COVERAGE JOB (WIRES 90-111), 2026-08-05 --------------------------
 * The 13 residual interaction-matrix disagreements and the orphan ability/item tags. Every probe here
 * was demonstrated RED before its green was believed, by stripping the tag it consumes out of the
 * in-memory artifact through TAGS.__setDB and watching the probe fail -- the mutation-tier
 * demonstration, run by tests/probe_red_demo.js so it is reproducible rather than asserted. */

/* WIRE 90 -- toxic spikes resolve on entry. The old MEDFAILS.hazardUnresolved declared this gap on
 * the claim that grounded-ness "is not tracked"; it is derivable from the body (types, Levitate, an
 * Air Balloon) and the interaction matrix caught the gap live: `uturn -> toxicdebris` read
 * `.A.active[0].status medi="" sd="psn"`. */
probe('move', 'toxicSpikesEntry', 'a grounded switch-in is poisoned by Toxic Spikes; a Flying one is not; a Poison one absorbs them', () => {
  const run = (layers, entrant) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('milotic');
    const nx = bare(entrant);
    const S = M.battleInit([me, ally, nx], [f1, f2], { seeded: true });
    /* lay the layers with the real click, then pivot the lead out so the entrant walks onto them */
    for (let i = 0; i < layers; i++)
      M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
        new Map([[f1, M.playerAction(f1, 'toxicspikes', null, S.field)], [f2, { kind: 'pass' }]]));
    M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: nx }], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { status: nx.status || 'none', layersLeft: (me._sf && me._sf.hz && me._sf.hz.toxicspikes) | 0 };
  };
  const one = run(1, 'milotic'), two = run(2, 'milotic'), fly = run(1, 'corviknight'), abs = run(1, 'gengar');
  return { works: one.status === 'psn' && two.status === 'tox' && fly.status === 'none'
                  && abs.status === 'none' && abs.layersLeft === 0,
           arms: { control: fly.status, test: one.status },
           detail: `entrant status -- 1 layer/Milotic ${one.status}, 2 layers ${two.status}, `
                 + `Flying ${fly.status}, grounded Poison ${abs.status} with ${abs.layersLeft} layers left (absorbed)` };
});

probe('move', 'stickyWebEntry', 'Sticky Web drops a grounded switch-in\'s Speed, through the same reactions as Intimidate', () => {
  const run = (entrant, ab) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('milotic');   /* the click is the mechanic; set legality is not what this probe asks */
    const nx = bare(entrant); if (ab) nx.ability = ab;
    const S = M.battleInit([me, ally, nx], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'stickyweb', null, S.field)], [f2, { kind: 'pass' }]]));
    M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: nx }], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { sp: nx.boosts.sp, at: nx.boosts.at };
  };
  const plain = run('milotic'), fly = run('corviknight'), def = run('kingambit', 'defiant');
  return { works: plain.sp === -1 && fly.sp === 0 && def.sp === -1 && def.at === 2,
           arms: { control: fly.sp, test: plain.sp },
           detail: `spe stage on entry -- grounded ${plain.sp}, Flying ${fly.sp}, `
                 + `Defiant ${def.sp} spe with +${def.at} atk (the web fires the retaliation)` };
});

/* WIRE 100 -- THE RETALIATION ARITHMETIC, verified against the official engine's own handlers before
 * this probe was trusted: the drop LANDS and then the +2 fires. The engine used to give Defiant a
 * clean +2 (net) and Competitive +2 SpA with NO Attack drop -- both wrong in the flattering
 * direction. */
probe('ability', 'intimidateRetaliationNet', 'Intimidate into Defiant is net +1 Atk; into Competitive it is Atk -1 AND SpA +2', () => {
  const run = (ab) => { const m = bare('milotic'); m.ability = ab; M.applyIntimidate(m); return { at: m.boosts.at, sa: m.boosts.sa }; };
  const d = run('defiant'), c = run('competitive'), plain = run('none');
  return { works: d.at === 1 && c.at === -1 && c.sa === 2 && plain.at === -1,
           arms: { control: plain, test: d },
           detail: `after Intimidate -- ability none atk ${plain.at}; Defiant atk ${d.at} (drop lands, then +2); `
                 + `Competitive atk ${c.at} / spa ${c.sa}` };
});

/* WIRE 107 -- the matrix rows `trick/switcheroo -> quickclaw`: Showdown swapped the items and this
 * engine did not. */
probe('move', 'trickSwapsItems', 'Trick swaps the two items; Corrosive Gas only deletes; a mega stone does not move', () => {
  const stage = (myItem, foeItem, click) => {
    const me = bare('sableye'), ally = bare('corviknight');
    const f1 = bare('milotic'), f2 = bare('garchomp');
    me.item = myItem; f1.item = foeItem;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, click, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { mine: me.item || '(none)', theirs: f1.item || '(none)' };
  };
  const swap = stage('quickclaw', '', 'trick');
  const gas = stage('', 'leftovers', 'corrosivegas');
  const stone = stage('quickclaw', 'gengarite', 'trick');
  return { works: swap.mine === '(none)' && swap.theirs === 'quickclaw'
                  && gas.theirs === '(none)' && stone.theirs === 'gengarite' && stone.mine === 'quickclaw',
           arms: { control: 'quickclaw/(none)', test: swap.mine + '/' + swap.theirs },
           detail: `Trick: user quickclaw -> ${swap.mine}, target (none) -> ${swap.theirs}; `
                 + `Corrosive Gas leaves the target ${gas.theirs}; Trick at a Gengarite holder moves nothing `
                 + `(${stone.mine} / ${stone.theirs})` };
});

/* WIRE 108 -- `trickortreat -> suckerpunch/upperhand`: `.B.active[0].types medi=["Poison"]
 * sd=["Ghost","Poison"]`. The written type is the MOVE'S OWN, true of all four members. */
probe('move', 'changesTargetType', 'Trick-or-Treat adds Ghost; Soak rewrites to pure Water', () => {
  const run = (click, targetSp) => {
    const me = bare('gengar'), ally = bare('corviknight');
    const f1 = bare(targetSp), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const before = f1.types.slice();
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, click, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { before, after: f1.types.slice() };
  };
  const tot = run('trickortreat', 'milotic'), soak = run('soak', 'garchomp');
  return { works: tot.after.includes('Ghost') && tot.after.includes('Water')
                  && soak.after.length === 1 && soak.after[0] === 'Water',
           arms: { control: tot.before, test: tot.after },
           detail: `Trick-or-Treat: ${tot.before.join('/')} -> ${tot.after.join('/')}; `
                 + `Soak: ${soak.before.join('/')} -> ${soak.after.join('/')}` };
});

/* WIRE 106 -- `decorate -> goodasgold/suckerpunch/upperhand`: the caller's target was dropped at
 * classification, so a foe-aimed Decorate boosted the ALLY. Showdown boosts the FOE, and Good as
 * Gold refuses it. */
probe('move', 'boostsTargetHonoursTarget', 'Decorate aimed at a foe boosts the FOE, and Good as Gold refuses it', () => {
  const run = (aimAtFoe, foeAb) => {
    const me = bare('alcremie') || bare('milotic'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('weavile');
    if (foeAb) f1.ability = foeAb;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'decorate', aimAtFoe ? f1 : ally, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { allyAtk: ally.boosts.at, foeAtk: f1.boosts.at };
  };
  const atAlly = run(false), atFoe = run(true), refused = run(true, 'goodasgold');
  return { works: atAlly.allyAtk === 2 && atAlly.foeAtk === 0
                  && atFoe.foeAtk === 2 && atFoe.allyAtk === 0 && refused.foeAtk === 0,
           arms: { control: atAlly.foeAtk, test: atFoe.foeAtk },
           detail: `atk stages (ally/foe) -- aimed at ally ${atAlly.allyAtk}/${atAlly.foeAtk}, `
                 + `aimed at foe ${atFoe.allyAtk}/${atFoe.foeAtk}, at a Good as Gold foe ${refused.foeAtk} (refused)` };
});

/* WIRE 105 -- `infestation -> beakblast`: Beak Blast KO'd the trapper in both engines and only this
 * one kept chipping. The trap dies with its trapper. */
probe('move', 'trapEndsWithTrapper', 'the partial trap ends when the trapper leaves the field', () => {
  const run = (koTheTrapper) => {
    const me = bare('ariados') || bare('garchomp'), ally = bare('corviknight');
    const f1 = bare('milotic'), f2 = bare('weavile');
    const S = M.battleInit([me, ally, bare('incineroar')], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'infestation', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    const trappedAfterTurn1 = !!f1._trap;
    if (koTheTrapper) { me.curHP = 0; me.fainted = true; }
    const before = f1.curHP;
    M.battleTurn(S, rng5, new Map([[ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { trappedAfterTurn1, chip: before - f1.curHP, still: !!f1._trap };
  };
  const alive = run(false), dead = run(true);
  return { works: alive.trappedAfterTurn1 && alive.chip > 0 && dead.chip === 0 && !dead.still,
           arms: { control: alive.chip, test: dead.chip },
           detail: `next-turn chip on the trapped body -- trapper alive ${alive.chip}, trapper KOd ${dead.chip} `
                 + `(trap cleared: ${!dead.still})` };
});

/* WIRE 102 -- `whirlwind -> suckerpunch/upperhand`: the two engines dragged DIFFERENT bodies because
 * this one always took bench[0] while Showdown SAMPLES. The drag target is a die; the probe varies
 * the die and demands the outcome move with it. */
probe('move', 'phazeDragIsADie', 'Whirlwind drags in a RANDOM bench body, driven by the battle rng', () => {
  const run = (roll) => {
    const me = bare('corviknight'), ally = bare('milotic');
    const f1 = bare('garchomp'), f2 = bare('weavile');
    const b1 = bare('incineroar'), b2 = bare('archaludon');
    const S = M.battleInit([me, ally], [f1, f2, b1, b2], { seeded: true });
    const rng = () => roll;
    M.battleTurn(S, rng, new Map([[me, M.playerAction(me, 'whirlwind', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return S.actB[0] && S.actB[0].name;
  };
  const low = run(0.01), high = run(0.99);
  return { works: !!low && !!high && low !== high,
           arms: { control: low, test: high },
           detail: `dragged in at rng 0.01: ${low}; at 0.99: ${high} -- the official engine's dragIn is `
                 + `this.sample(possibleSwitches), so WHICH body arrives is luck, and a fixed bench[0] read `
                 + `as a rule divergence under the matrix's pinned dice` };
});

/* WIRE 101 -- Quick Claw. The claw holder is far slower and still moves first on the claw's 20%. */
probe('item', 'fractionalPriority', 'Quick Claw lets a slow holder move first within its bracket', () => {
  const run = (item, roll) => {
    const me = bare('torkoal'); me.item = item;                  /* base 20 Speed */
    const ally = bare('corviknight');
    const f1 = bare('weavile'), f2 = bare('garchomp');
    f1.curHP = 60;                                               /* one Lava Plume ends it */
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    /* first rng call this turn is the claw roll (only rolled for a holder); afterwards mid-roll */
    let first = true;
    const rng = () => { if (first && item) { first = false; return roll; } return 0.5; };
    const before = me.curHP;
    M.battleTurn(S, rng, new Map([[me, M.playerAction(me, 'lavaplume', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'brickbreak', me, S.field)], [f2, { kind: 'pass' }]]));
    return { hurt: before - me.curHP, foeDead: f1.fainted };
  };
  const claw = run('quickclaw', 0.05), miss = run('quickclaw', 0.9), none = run('', 0.05);
  return { works: claw.foeDead && claw.hurt === 0 && miss.hurt > 0 && none.hurt > 0,
           arms: { control: none.hurt, test: claw.hurt },
           detail: `damage the slow holder took before acting -- claw wins the roll ${claw.hurt} (it KOd first: ${claw.foeDead}), `
                 + `claw loses the roll ${miss.hurt}, no item ${none.hurt}` };
});

/* WIRE 103 -- King's Rock. */
probe('item', 'addsFlinch', "King's Rock flinches on its 10%, and Sheer Force deletes it", () => {
  /* the receipt is whether Recover happened: a flinched Milotic stays hurt. The flinch roll is
   * rng()<0.1; a constant under it fires the rock, a constant over it never does, and every other
   * consumer of the stream tolerates either constant. */
  const hit = (item, roll, ab) => {
    const me = bare('weavile'); me.item = item; if (ab) me.ability = ab;
    const ally = bare('corviknight');
    const f1 = bare('milotic'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const rng = () => roll;
    /* the receipt is the target's SETUP: a flinched body never clicks its Swords Dance. The first
     * cut used Recover-back-to-full, and a crit (Night Slash at a constant 0.05 crits in BOTH arms)
     * out-damaged the heal, so the control read as flinched too -- the receipt was wrong, not the
     * rock. */
    M.battleTurn(S, rng, new Map([[me, M.playerAction(me, 'nightslash', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'swordsdance', null, S.field)], [f2, { kind: 'pass' }]]));
    return f1.boosts.at === 2;                                   /* true = it set up = no flinch */
  };
  const flinched = hit('kingsrock', 0.05), noRock = hit('', 0.05), badRoll = hit('kingsrock', 0.5),
        sheer = hit('kingsrock', 0.05, 'sheerforce');
  return { works: flinched === false && noRock === true && badRoll === true && sheer === true,
           arms: { control: noRock, test: flinched },
           detail: `did the target get its Swords Dance off -- rock+low roll ${flinched} (flinched), no rock ${noRock}, `
                 + `rock+high roll ${badRoll}, rock+Sheer Force ${sheer} (the boost deletes the rock's flinch)` };
});

/* WIRE 97 -- Sheer Force, both halves plus the Life Orb interaction. */
probe('ability', 'removesOwnSecondaries', 'Sheer Force boosts a secondary-carrying move x1.3 and strips its secondary', () => {
  const off = bare('incineroar'), on = bare('incineroar'); on.ability = 'sheerforce';
  const def = bare('milotic');
  const mv = MC.moves['rockslide'], plain = MC.moves['facade'] || MC.moves['doubleedge'];
  const a = M.dmgRange(off, def, mv, fresh(), false), b = M.dmgRange(on, def, mv, fresh(), false);
  const pa = M.dmgRange(off, def, plain, fresh(), false), pb = M.dmgRange(on, def, plain, fresh(), false);
  return { works: b.max > a.max * 1.2 && pb.max === pa.max,
           arms: { control: a.max, test: b.max },
           detail: `Rock Slide (has a secondary): none ${a.max} -> Sheer Force ${b.max}; `
                 + `a no-secondary move must NOT move: ${pa.max} -> ${pb.max}` };
});

/* WIRE 96 -- Sniper. */
probe('ability', 'critDamageUp', "Sniper multiplies a crit's damage half again", () => {
  const off = bare('sneasler') || bare('weavile'), on = bare('sneasler') || bare('weavile');
  on.ability = 'sniper';
  const def = bare('milotic');
  const mv = MC.moves['flowertrick'];                             /* always crits: the certain path */
  const a = M.dmgRange(off, def, mv, fresh(), false), b = M.dmgRange(on, def, mv, fresh(), false);
  const ctrl = MC.moves['closecombat'];
  const ca = M.dmgRange(off, def, ctrl, fresh(), false), cb = M.dmgRange(on, def, ctrl, fresh(), false);
  return { works: b.max > a.max * 1.4 && cb.max === ca.max,
           arms: { control: a.max, test: b.max },
           detail: `Flower Trick (always crits): none ${a.max} -> Sniper ${b.max} (x1.5 on the crit); `
                 + `a non-crit move must not move: ${ca.max} -> ${cb.max}` };
});

/* WIRE 98 -- Parental Bond. */
probe('ability', 'hitsTwice', 'Parental Bond adds a quarter-strength second hit, and not on a spread move', () => {
  const off = bare('kangaskhan') || bare('incineroar'), on = bare('kangaskhan') || bare('incineroar');
  on.ability = 'parentalbond'; off.ability = 'none';
  const def = bare('milotic');
  const mv = MC.moves['doubleedge'] || MC.moves['bodyslam'];
  const a = M.dmgRange(off, def, mv, fresh(), false), b = M.dmgRange(on, def, mv, fresh(), false);
  const sp = MC.moves['earthquake'];
  const sa = M.dmgRange(off, def, sp, fresh(), true), sb = M.dmgRange(on, def, sp, fresh(), true);
  return { works: b.max > a.max * 1.15 && sb.max === sa.max,
           arms: { control: a.max, test: b.max },
           detail: `single-target: none ${a.max} -> Parental Bond ${b.max} (x1.25); `
                 + `spread Earthquake must not move: ${sa.max} -> ${sb.max}` };
});

/* WIRE 94 -- Unaware, the ability half of ignoresStatStages. The MOVE half (Sacred Sword) has been
 * live under `ignoresBoosts` all along, which makes the move-side tag a redundant second spelling --
 * staged for tag_dex cleanup. */
probe('ability', 'ignoresStatStages', "Unaware ignores the attacker's +6 when defending and the defender's +6 when attacking", () => {
  const atk = bare('garchomp'), wallOff = bare('milotic'), wallOn = bare('milotic');
  wallOn.ability = 'unaware';
  const mv = MC.moves['earthquake'];
  atk.boosts.at = 6;
  const plain = M.dmgRange(atk, wallOff, mv, fresh(), false).max;
  const seen = M.dmgRange(atk, wallOn, mv, fresh(), false).max;
  atk.boosts.at = 0;
  const base = M.dmgRange(atk, wallOn, mv, fresh(), false).max;
  /* other direction: an Unaware attacker into a +6 Def target */
  const ua = bare('garchomp'); ua.ability = 'unaware';
  const wall = bare('milotic'); wall.boosts.df = 6;
  const boosted = M.dmgRange(bare('garchomp'), wall, mv, fresh(), false).max;
  const ignored = M.dmgRange(ua, wall, mv, fresh(), false).max;
  return { works: plain > seen && seen === base && ignored > boosted,
           arms: { control: plain, test: seen },
           detail: `+6 attacker into: plain wall ${plain}, Unaware wall ${seen} (equals unboosted ${base}); `
                 + `into a +6 Def wall: plain attacker ${boosted}, Unaware attacker ${ignored}` };
});

/* WIRE 93 -- Gale Wings, the second priorityMod carrier (Prankster's arm is the probe above this
 * batch). The receipt is who moves first: a slow full-HP Talonflame's Brave Bird beats a faster
 * attacker only with the ability, and NOT once it is chipped. */
probe('ability', 'priorityModFlying', 'Gale Wings puts a full-HP Flying move in front, and not a chipped one', () => {
  /* The first cut of this probe was wrong twice before the engine was (Lesson 5): Talonflame (188)
   * already outsped the Weavile (187) it was staged against, so every arm went first anyway -- and
   * the receipt counted Brave Bird's own RECOIL as "damage taken before acting". Dragapult (205) is
   * genuinely faster, and Drill Peck has no recoil. */
  const run = (ab, hp) => {
    const me = bare('talonflame'); me.ability = ab;
    if (hp) me.curHP = Math.floor(me.st.hp * hp);
    const ally = bare('milotic');
    const f1 = bare('dragapult'), f2 = bare('garchomp');
    f1.curHP = 40;                                               /* Drill Peck ends it if it goes first */
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const before = me.curHP;
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'drillpeck', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'shadowball', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;                                    /* >0 means the faster foe hit first */
  };
  const none = run('none'), wings = run('galewings'), chipped = run('galewings', 0.6);
  return { works: none > 0 && wings === 0 && chipped > 0,
           arms: { control: none, test: wings },
           detail: `damage taken before acting -- no ability ${none}, Gale Wings at full HP ${wings} `
                 + `(its Flying move went first), Gale Wings at 60% ${chipped} (the condition is the artifact's)` };
});

/* WIRE 92 -- Shadow Tag through `preventsSwitch`. */
probe('ability', 'preventsSwitch', 'Shadow Tag holds a voluntary switch; a Ghost type walks out anyway', () => {
  const run = (foeAb, mySp) => {
    const me = bare(mySp), ally = bare('corviknight');
    const sub = bare('incineroar');
    const f1 = bare('gengar'), f2 = bare('garchomp');
    f1.ability = foeAb;
    const S = M.battleInit([me, ally, sub], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: sub }], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return S.actA[0] && S.actA[0].name;                          /* who stands there afterwards */
  };
  const free = run('none', 'milotic'), held = run('shadowtag', 'milotic'), ghost = run('shadowtag', 'mimikyu');
  return { works: free === 'incineroar' && held === 'milotic' && ghost === 'incineroar',
           arms: { control: free, test: held },
           detail: `slot after the switch click -- foe ability none: ${free} (switched), Shadow Tag: ${held} `
                 + `(held), Ghost-type under Shadow Tag: ${ghost} (exempt)` };
});

/* WIRE 104 -- boostsOnKO (Eelevate; the sheet count reads 0 because sheets list the pre-mega
 * ability, Lesson 3). */
probe('ability', 'boostsOnKO', 'a KO raises the killer\'s highest stat by one', () => {
  const run = (ab) => {
    const me = bare('garchomp'); me.ability = ab;
    const ally = bare('corviknight');
    const f1 = bare('weavile'), f2 = bare('milotic');
    f1.curHP = 5;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return Object.values(me.boosts).reduce((s, v) => s + v, 0);
  };
  const off = run('none'), on = run('eelevate');
  return { works: off === 0 && on === 1,
           arms: { control: off, test: on },
           detail: `total stages after the KO -- ability none ${off}, Eelevate ${on} (+1 to its highest stat)` };
});

/* WIRE 99 -- Mega Sol's private sun (Meganium's Champions mega; sheets read 0 by Lesson 3). */
probe('ability', 'privateWeather', "Mega Sol's own Fire move fires under a sun only it can see", () => {
  const off = bare('meganium') || bare('incineroar'), on = bare('meganium') || bare('incineroar');
  on.ability = 'megasol';
  const def = bare('corviknight');
  const fire = MC.moves['flamethrower'] || MC.moves['fireblast'];
  const a = fire ? M.dmgRange(off, def, fire, fresh(), false) : null;
  const b = fire ? M.dmgRange(on, def, fire, fresh(), false) : null;
  if (!a) return { works: false, detail: 'no fire move in MC.moves to stage with' };
  return { works: b.max > a.max * 1.3, arms: { control: a.max, test: b.max },
           detail: `Flamethrower on a clear field: ability none ${a.max}, Mega Sol ${b.max} (the private sun's x1.5); `
                 + `the FIELD still reports no weather -- only this body's reads see it` };
});

/* ================================================================================================
 * THE CENSUS ASKS WHETHER A MECHANIC FIRES. IT NEVER ASKED WHETHER IT FIRES *ONLY WHERE IT SHOULD*.
 *
 * The six probes below are the first that do. Every one of them was shown RED against the engine as
 * it stood, and each names the OFFICIAL result it was checked against — every expected outcome here
 * came out of `Dex.forFormat('gen9championsvgc2026regmb')` playing the same case at the pinned
 * commit, printed and read, rather than out of anybody's memory. Three of them would have passed a
 * "does the mechanic fire" probe on the day they were broken:
 *   - Shield Dust FIRED. It fired on Will-O-Wisp, on Thunder Wave, on Spore, on Toxic and on Static
 *     as well, none of which it touches.
 *   - the partial trap FIRED. It chipped every turn, expired correctly, and died with its trapper —
 *     and stopped nothing, which is the whole move.
 *   - Purifying Salt's DAMAGE half fired all along; only the status half was absent, so "is
 *     Purifying Salt live" had a true answer and a false one at the same time.
 * ============================================================================================== */

/* WIRE 114. Garganacl is legal and played in Reg M-B (51 declared sheets) and STATUS_IMMUNE_ABIL had
 * no entry for it at all, so every Will-O-Wisp, Thunder Wave, Spore and Toxic landed.
 * Official engine, both arms played: into Purifying Salt all four leave it clean; into Sturdy the
 * same four bodies burn / paralyse / sleep / badly-poison. */
probe('ability', 'statusImmune', 'Purifying Salt refuses every major status, and Sturdy takes them all', () => {
  const one = (ab, moveId) => {
    const me = bare('milotic'), ally = bare('corviknight');
    const f1 = bare('garganacl'), f2 = bare('garchomp');
    f1.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  /* Spore is a powder and Toxic is Poison-typed: Garganacl is a pure Rock type, so neither the powder
   * gate nor a type immunity can be what refuses them. That is why the body is Garganacl and not the
   * Grass or Steel body a lazier staging would have reached for. */
  const MOVES = ['willowisp', 'thunderwave', 'spore', 'toxic'];
  const control = MOVES.map(mv => one('sturdy', mv)).join(',');
  const test = MOVES.map(mv => one('purifyingsalt', mv)).join(',');
  /* The SECONDARY route as well, because an immunity wired only into the status-move branch would
   * still let Nuzzle paralyse it. */
  const secPlain = one('sturdy', 'nuzzle'), secSalt = one('purifyingsalt', 'nuzzle');
  return { works: control === 'brn,par,slp,tox' && test === 'none,none,none,none'
                  && secPlain === 'par' && secSalt === 'none',
           arms: { control, test },
           detail: `Wisp/T-Wave/Spore/Toxic into Garganacl -- Sturdy ${control} (the control arm `
                 + `genuinely landed all four), Purifying Salt ${test}; Nuzzle's SECONDARY par: `
                 + `Sturdy ${secPlain}, Purifying Salt ${secSalt}` };
});

/* The OTHER half of the same ability, probed because a mechanic with two halves needs a probe per
 * half — the weather rocks cost this project four routes and one passing probe. This half was
 * already LIVE off `halvesTypeDamage`; it is pinned here so the pair can never drift apart. */
probe('ability', 'halvesTypeDamage', 'Purifying Salt halves a GHOST move and leaves the others alone', () => {
  const off = bare('garganacl'), on = bare('garganacl');
  on.ability = 'purifyingsalt';
  const att = bare('gengar');
  const ghost = M.dmgRange(att, off, MC.moves['shadowball'], fresh(), false).max;
  const ghostS = M.dmgRange(att, on, MC.moves['shadowball'], fresh(), false).max;
  const other = M.dmgRange(att, off, MC.moves['sludgebomb'], fresh(), false).max;
  const otherS = M.dmgRange(att, on, MC.moves['sludgebomb'], fresh(), false).max;
  return { works: ghostS < ghost * 0.6 && ghostS > 0 && otherS === other,
           arms: { control: ghost, test: ghostS },
           detail: `Shadow Ball into Garganacl: no ability ${ghost} -> Purifying Salt ${ghostS}; `
                 + `Sludge Bomb must NOT move: ${other} -> ${otherS}` };
});

/* WIRE 115. `canTakeStatus` carried a blanket `if(ab==='shielddust') return false`, and it is the
 * gate every status in this engine passes through — so a Shield Dust body could not be burned,
 * paralysed, slept or poisoned by a DIRECT status move. Official engine: Will-O-Wisp into Shield
 * Dust burns exactly as it does into Compound Eyes. The two arms below are the SCOPE knob — same
 * body, same ability, one secondary status and one direct status move — so equal arms would mean
 * the engine cannot tell the two apart, which is precisely the bug. */
probe('ability', 'untagged', 'Shield Dust blocks a move SECONDARY and does not block a status MOVE', () => {
  const one = (moveId, ab) => {
    const me = bare('milotic'), ally = bare('corviknight');
    const f1 = bare('vivillon'), f2 = bare('garchomp');
    f1.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    /* A low roll so the 100%-chance secondary is never the thing under test and the 30% ones fire. */
    M.battleTurn(S, () => 0.01,
      new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  const control = one('nuzzle', 'shielddust');          /* secondary  -> blocked */
  const test = one('willowisp', 'shielddust');          /* status MOVE -> must land */
  const secPlain = one('nuzzle', 'none');               /* the secondary really does land otherwise */
  const rest = ['thunderwave', 'spore', 'toxic'].map(mv => one(mv, 'shielddust')).join(',');
  return { works: control === 'none' && secPlain === 'par' && test === 'brn' && rest === 'par,slp,tox',
           arms: { control, test },
           detail: `into a Shield Dust Vivillon -- Nuzzle's secondary par: ${control} (blocked; with `
                 + `no ability it is ${secPlain}, so the arm ran), Will-O-Wisp: ${test}, `
                 + `T-Wave/Spore/Toxic: ${rest}` };
});

/* The same wrong scope on the two ABILITY routes, which are opposite in the real game and were
 * identical here. Official engine: a Shield Dust body that attacks a Static body IS paralysed
 * (30% roll, both arms play it); a Poison Touch attacker into a Shield Dust body poisons it
 * 0 times in 40 seeds against 12 in 40 into Compound Eyes — Showdown special-cases that one onto
 * Shield Dust in its own source comment. So the arms must DIFFER, and before this pass they agreed
 * at "nothing happens". */
probe('ability', 'untagged', 'Shield Dust does not stop Static, and does stop Poison Touch', () => {
  const staticOn = (attAb) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('milotic'), f2 = bare('garchomp');
    me.ability = attAb; f1.ability = 'static';
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, () => 0.01,
      new Map([[me, M.playerAction(me, 'drainpunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return me.status || 'none';                          /* the ATTACKER is what Static punishes */
  };
  const ptouch = (tgtAb) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garganacl'), f2 = bare('garchomp');
    me.ability = 'poisontouch'; f1.ability = tgtAb;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, () => 0.01,
      new Map([[me, M.playerAction(me, 'drainpunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  /* Drain Punch: contact, and it carries NO secondary of its own — the first cut of this used Flare
   * Blitz and read its own 10% burn as the Poison Touch proc, which is arm 25. */
  const staticPlain = staticOn('none'), staticDust = staticOn('shielddust');
  const ptPlain = ptouch('none'), ptDust = ptouch('shielddust');
  return { works: staticPlain === 'par' && staticDust === 'par' && ptPlain === 'psn' && ptDust === 'none',
           arms: { control: staticDust, test: ptDust },
           detail: `Static onto the attacker -- no ability ${staticPlain}, Shield Dust ${staticDust} `
                 + `(not blocked); Poison Touch onto the target -- no ability ${ptPlain}, `
                 + `Shield Dust ${ptDust} (blocked, and Showdown says so in its own handler)` };
});

/* Shield Dust's handler is `secondaries.filter(effect => !!effect.self)` — it KEEPS the secondaries
 * that boost the USER and drops the rest. This engine merged it with Sheer Force (which really does
 * delete everything) into one boolean, so a Trailblaze into a Shield Dust body left the attacker at
 * Speed 0. Official engine: spe+1, identical to the Compound Eyes control. The arms are two KINDS of
 * secondary against one ability, which is the distinction that was missing. */
probe('ability', 'untagged', "Shield Dust drops the target's stat drop and keeps the attacker's own boost", () => {
  const drop = (ab) => {                                  /* Icy Wind: 100% target spe -1 */
    const me = bare('milotic'), ally = bare('corviknight');
    const f1 = bare('vivillon'), f2 = bare('garchomp');
    f1.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, () => 0.01,
      new Map([[me, M.playerAction(me, 'icywind', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.boosts.sp;
  };
  const boost = (ab) => {                                 /* Trailblaze: 100% SELF spe +1 */
    const me = bare('milotic'), ally = bare('corviknight');
    const f1 = bare('vivillon'), f2 = bare('garchomp');
    f1.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, () => 0.01,
      new Map([[me, M.playerAction(me, 'trailblaze', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return me.boosts.sp;
  };
  const control = drop('shielddust'), test = boost('shielddust');
  const dropPlain = drop('none'), boostPlain = boost('none');
  return { works: control === 0 && dropPlain === -1 && test === 1 && boostPlain === 1,
           arms: { control, test },
           detail: `against a Shield Dust body -- Icy Wind's target spe ${control} (dropped; with no `
                 + `ability ${dropPlain}), Trailblaze's own spe ${test} (kept; with no ability `
                 + `${boostPlain})` };
});

/* WIRE 116. `_trap` was set, chipped, expired and taught to die with its trapper, and appeared in NO
 * switch decision — so every partial-trapping move let its victim walk out. Official engine: the bare
 * switch is REJECTED outright ("Can't switch: The active Pokémon is trapped"); a Ghost type leaves
 * and keeps taking the chip; a Shed Shell holder leaves; a pivot MOVE goes through. */
probe('move', 'partialTrap', 'a partial trap holds a voluntary switch, and Ghost / Shed Shell / a pivot get out', () => {
  const run = (foeMove, mySp, item, pivot) => {
    const me = bare(mySp), ally = bare('corviknight'), sub = bare('incineroar');
    if (item) me.item = item;
    const f1 = bare('vivillon'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally, sub], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, foeMove, me, S.field)], [f2, { kind: 'pass' }]]));
    /* THE MUTATION ARM MUST BE SHOWN TO HAVE RUN. Without this the "trapped" arms and the control
       arm are the same experiment: a Fire Spin that missed and a trap that does not hold read
       identically at the end. */
    const trapped = !!me._trap;
    M.battleTurn(S, rng5,
      new Map([[me, pivot ? M.playerAction(me, 'partingshot', f1, S.field) : { kind: 'switch', to: sub }],
               [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return (trapped ? 'trapped:' : 'untrapped:') + (S.actA[0] && S.actA[0].name);
  };
  const control = run('infestation', 'milotic', '', false);
  const free = run('protect', 'milotic', '', false);       /* nothing was ever set */
  const ghost = run('infestation', 'mimikyu', '', false);
  const shed = run('infestation', 'milotic', 'shedshell', false);
  const piv = run('infestation', 'milotic', '', true);
  return { works: control === 'trapped:milotic' && free === 'untrapped:incineroar'
                  && ghost === 'trapped:incineroar' && shed === 'trapped:incineroar'
                  && piv === 'trapped:incineroar',
           arms: { control, test: free },
           detail: `who stands after the switch click -- Infestation then a bare switch: ${control}; `
                 + `no trap: ${free}; Ghost: ${ghost}; Shed Shell: ${shed}; Parting Shot (a pivot `
                 + `MOVE): ${piv}` };
});

const works = results.filter(r => r.works);
const missing = results.filter(r => !r.works);
console.log('MECHANIC CENSUS — does the engine actually DO the thing?\n');
for (const r of results) {
  console.log('  ' + (r.works ? 'LIVE   ' : 'MISSING') + '  ' + r.tag.padEnd(20) + r.label.padEnd(38) + r.detail);
}
console.log(`\n  ${works.length} live, ${missing.length} missing, ${results.length} probed.`);
/* Printed even at zero: "no probe threw" is a claim worth being able to read, and a line that only
 * appears when it is non-zero cannot be told apart from a line nobody wrote. */
console.log(`  ${threw} probe(s) THREW rather than reporting — a throw usually means the PROBE is broken.`);
if (missing.length) {
  console.log('\n  MISSING:');
  for (const r of missing) console.log('    - ' + r.label + '   (' + r.kind + ' tag `' + r.tag + '`)');
}

/* ---- THE HOLLOW CHECK, run over the WHOLE census in one pass ------------------------------------ */

const hollow = results.filter(r => r.hollow);
console.log(`\n  hollow probes (read the engine SOURCE, or return two arms that AGREE): ${hollow.length}`);
for (const r of hollow) console.log('    !! ' + r.kind + ' `' + r.tag + '` — ' + r.label);

/* ---- THE ARMS RATCHET --------------------------------------------------------------------------
 *
 * `unarmed` is the number of probes that do NOT return `arms: {control, test}` and therefore cannot
 * be checked structurally. It may fall and it may never rise, which is the whole thing that stops an
 * opt-in protocol from being an opt-out: a probe written without arms fails the file rather than
 * quietly exempting itself, which is the hole the previous pass costed and declined to close.
 * The baseline is read out of the census ARTIFACT rather than typed here, so it is a fact and not a
 * literal somebody edits down. */
const armed = results.filter(r => r.armed).length;
const unarmed = results.length - armed;
let armBase = null, failureReadingBaseline = '';
/* A MISSING BASELINE IS A LEGITIMATE STATE — the first run under the protocol has nothing to hold —
 * but "there is no census yet" and "the census is corrupt" are not the same event and a bare catch
 * makes them one. The reason is kept and PRINTED beside the count, so a ratchet that silently stopped
 * ratcheting is readable rather than inferred. */
try { armBase = JSON.parse(fs.readFileSync(D('data', 'mechanics-census.json'), 'utf8')).unarmed; }
catch (e) { failureReadingBaseline = String(e.message).slice(0, 100); }
if (failureReadingBaseline) console.log('  NOTE: the unarmed RATCHET has no baseline this run — ' + failureReadingBaseline);
console.log('  probes returning arms {control, test}: ' + armed + ' of ' + results.length
  + '   (' + unarmed + ' unarmed — RATCHETED: it may fall and may never rise)');
if (armBase != null && unarmed > armBase) {
  console.log('\n  FAILED: unarmed probes ' + armBase + ' -> ' + unarmed + '. A new probe must return '
    + 'its arms, or the opt-in protocol is an opt-out. See the comment on probe().');
  process.exitCode = 1;
}

/* THE SECOND DETECTOR IS MEASURED, NOT ASSERTED, AND THE MEASUREMENT IS THE REASON.
 *
 * The property worth asserting is "a probe whose two arms produce the SAME number is not testing
 * anything" — it is the failure that made the Disable probe a false LIVE for as long as it existed.
 * It cannot be asserted from here, and the cheap heuristic is printed so the cost of the real fix is
 * a number rather than an opinion: `detail` is free-form prose. It carries arm values, thresholds
 * ("a quarter is 43"), stage counts and stat names all as bare digits, so no parser can tell an ARM
 * from an ANNOTATION. The count below is what a digit-scraping version would flag; read it as an
 * upper bound on noise, not as a list of bugs.
 *
 * Doing it properly means a PROTOCOL change: probes return `arms: {control, test}` and this file
 * asserts `control !== test`. That is a real assertion with no heuristic in it — and it has to be
 * applied by hand to all 147 probes, because a probe that keeps returning only `detail` would opt
 * itself out silently, which is the same hole in a new place. Costed here so the next pass can decide
 * with the number in front of it rather than re-deriving it. */
const nums = (s) => (String(s).match(/-?\d+(?:\.\d+)?/g) || []);
/* LIVE ONLY. A MISSING probe printing the same number twice is the mechanic being absent — that is
 * the probe working, and including those made the list 23 long and unreadable. The suspicious case is
 * a probe that reports LIVE while its arms agree. */
const flat = results.filter(r => {
  if (!r.works) return false;
  const n = nums(r.detail);
  return n.length >= 2 && new Set(n).size === 1;
});
console.log(`  LIVE probes whose detail carries >=2 numbers and they are ALL equal: ${flat.length}`
  + '   (a heuristic upper bound on "both arms agree", NOT an assertion — see the comment)');
for (const r of flat) console.log('    ?  ' + r.kind + ' `' + r.tag + '` — ' + r.detail);

fs.writeFileSync(D('data', 'mechanics-census.json'), JSON.stringify({
  generated: new Date().toISOString(), by: 'tests/test-mechanics.js',
  design: 'Behavioural probes. Each clears its own control explicitly, because the first version '
        + 'compared a Choice Scarf against a Basculegion that buildMon had already given a Choice '
        + 'Scarf and reported the engine broken.',
  probed: results.length, live: works.length, missing: missing.length,
  /* THE ARMS PROTOCOL. An `armed` probe returns {control, test} and is checked structurally for
   * agreement; `unarmed` is the ratcheted number that may never rise. */
  armed, unarmed,
  /* Counted apart from `missing`: a probe that threw has not shown the mechanic ABSENT, only that it
   * could not ask. Both are non-live; only one is evidence about the engine. */
  threw,
  /* Written to the artifact so a ratchet can hold it at zero without re-running the reasoning. */
  hollow: hollow.length,
  results: results.map(r => ({ kind: r.kind, tag: r.tag, label: r.label, live: r.works, detail: r.detail,
                               hollow: !!r.hollow, armed: !!r.armed })),
}, null, 2) + '\n');
console.log('\n  wrote data/mechanics-census.json');
/* Exits 0 for a MISSING mechanic — that is the honest current state of several of these, and a census
 * that went red and got ignored would be useless. It exits 1 for a HOLLOW one, which is a different
 * kind of claim: a probe that reads the source is not evidence about the engine at all, and leaving
 * one in place is how `weatherChipImmune` reported a mechanic live for months while the engine had no
 * sandstorm residual whatsoever. */
if (hollow.length) {
  console.log(`\n  FAILED: ${hollow.length} hollow probe(s). A probe that greps the engine source is `
    + 'not a probe. Make it behavioural, with a control arm.');
  process.exitCode = 1;
}
