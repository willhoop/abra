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
/* A LOSING ROLL, and it is the only lever an accuracy probe has. The battle loop's to-hit test is
 * `moveAccuracy(id,field)<100 && rng()*100>acc`, so 0.99 loses every printed accuracy in this format
 * (the lowest above 99 is nothing; the highest below is 95) and wins nothing. A move that still lands
 * on this roll is one the engine believes cannot miss -- which is the ONLY way to tell a real
 * never-miss from `ACC[id]||100` handing back 100 because nobody listed the move.
 *
 * It triggers no other chance effect: every secondary, crit and status roll in the loop is `rng()<p`
 * with p well under 0.99, and full-paralysis is 0.125. So the only thing 0.99 changes is the miss. */
const rngLose = () => 0.99;

/* One standard doubles board, so the staging is identical across probes and a difference between two
 * arms is the varied knob and not the setup. seeded:true skips entry effects -- a probe that wants
 * Intimidate or Drizzle must ask for them, exactly like every other input here.
 *
 * HOISTED TO THE TOP, 2026-08-06. probe() runs its function IMMEDIATELY, so a probe defined above
 * this line could not reach it -- which is why the first eighty probes in this file were all
 * direct-call and the ones after it were not. That was an accident of declaration order, not a
 * judgement about what those mechanics needed. */
const board = (meSp, allySp, f1Sp, f2Sp) => {
  const me = bare(meSp), ally = bare(allySp), f1 = bare(f1Sp), f2 = bare(f2Sp);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  return { me, ally, f1, f2, S };
};
const PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);

/* SPEND A REAL TURN AND READ WHAT THE TARGET ACTUALLY LOST.
 *
 * A direct `dmgRange(att, def, mv, field)` tests the FORMULA. This tests the PATH: the type and
 * ability immunity gates, the priority refusal, Protect, redirection, the to-hit roll and the
 * post-hit reactions all sit between a click and the damage, and every expensive bug this engine has
 * had lived in that gap rather than in the formula (WIRE 123 is the current example -- every
 * entry-drop handler was correct and the ORDER they ran in was not).
 *
 * `stage` gets the whole board before the click, so a probe sets the one thing it varies and nothing
 * else. The number is the AIMED foe's HP loss; a probe that needs the other foe reads it itself. */
/* A TARGET THAT CANNOT FAINT, and it is not a convenience — it is the difference between a probe and
 * a hollow one. A KO clamps the HP loss at the body's own maximum, so "strong" and "much stronger"
 * print the SAME number, the two arms agree, and this file marks that HOLLOW at the bottom. Only max
 * HP moves; every input to the damage formula is left exactly as `bare` built it. */
const unfaintable = (m) => { m.st = Object.assign({}, m.st, { hp: m.st.hp * 8 }); m.curHP = m.st.hp; };

const turnDamage = (sps, stage, moveId, rngIn) => {
  const B = board(sps[0], sps[1], sps[2], sps[3]);
  if (stage) stage(B);
  const before = B.f1.curHP;
  M.battleTurn(B.S, rngIn || rng5,
    new Map([[B.me, M.playerAction(B.me, moveId, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
    PASS2(B.f1, B.f2));
  return before - B.f1.curHP;
};

/* turnDamage WITH THE AIMED FOE MADE UNFAINTABLE FIRST, which is the shape every damage-multiplier
 * probe wants and the shape a hand-written one keeps forgetting. A KO clamps both arms to the same
 * number, the arms then agree, and this file marks that HOLLOW at the bottom — so the convenience is
 * really a correctness guard. Added 2026-08-06 when the #42/#45 conversions turned ~20 direct
 * `dmgRange` comparisons into real turns and each of them needed exactly this staging. */
const turnDamageBig = (sps, stage, moveId, rngIn) =>
  turnDamage(sps, (B) => { unfaintable(B.f1); if (stage) stage(B); }, moveId, rngIn);

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
/* THE DIRECT-CALL DETECTOR — the third one, and it is the only one that can see a WIRING bug.
 *
 * `armed` says a probe declared two arms. `hollow` says it read the source. Neither can see the
 * shape that let WIRE 123 live: a probe that calls the mechanic's FUNCTION directly, never through a
 * turn. `applyIntimidate` was correct and the ORDER entry effects ran in was not, so side B's lead
 * owned the weather and every damage roll after it carried the wrong multiplier — and the Intimidate
 * probe was green throughout, because it called `M.applyIntimidate(foe)` itself.
 *
 * STRUCTURAL, over the probe's OWN SOURCE: does the body reach `battleTurn`, `battleInit`, or one of
 * the two helpers built on them (`board(`, `turnDamage(`)? That is not a judgement and nobody can
 * soften it by rewording a comment — the string either contains the call or it does not.
 *
 * RATCHETED DOWNWARD in the census as `directCall`, which is what `unarmed` could never be: `unarmed`
 * falls as paperwork (declare arms a probe already computes) and says nothing about coverage, while
 * `directCall` only falls when a probe starts spending a real turn. Filed as #42/#45. */
/* THE HELPERS ARE NAMED EXPLICITLY RATHER THAN MATCHED LOOSELY. `turnDamage\(` does not match
 * `turnDamageBig(`, which is correct behaviour for a strict pattern and cost two probes their credit
 * the first time the helper was used — so a new helper must be added HERE, deliberately, and cannot
 * sneak a direct-call probe past the ratchet by being named something plausible. */
/* `hitOnRoll(` added 2026-08-06 with the accuracy family. It is declared HERE, deliberately, exactly
 * as the paragraph above requires: it stages a real board, spends a real setup turn and a real attack
 * turn through battleTurn, and reads the aimed foe's HP loss. */
/* `valuedAcc(` added 2026-08-06 with WIRE 131, declared HERE and with its reason, because it is the
 * one helper in this file that deliberately does NOT spend a turn. It stages the bodies through
 * `board()` -> `battleInit` — a real entry, which is what the ratchet's own name allows — and then
 * reads what the VALUATION path prices the click at. Spending a turn would be the wrong instrument:
 * the whole finding of WIRE 131 is that the resolution path was already right and the valuation path
 * was blind, so a probe that reads damage on the board cannot see it. */
/* `moveLines(` added 2026-08-07 with ROADMAP #81 WIRE 6, declared HERE and with its reason, exactly
 * as the paragraph above requires -- the ratchet caught both new probes as direct calls on their
 * first run, which is the guard working. It stages a real doubles board through `battleInit`, spends
 * a real turn through `battleTurn` and returns the `|move|` lines the acting body EMITTED. It reads
 * the protocol stream rather than HP, and that is the point of the wire it belongs to: the mechanic
 * underneath (Trick Room inverting the turn) was already green on a state-reading probe while the
 * engine announced nothing at all, so a probe that reads state structurally cannot see this. */
/* `entryLines(` added 2026-08-07 with ROADMAP #81 WIRE 7, declared HERE and with its reason. It
 * stages a real doubles board through `battleInit`, spends a real turn through `battleTurn` driving a
 * real SWITCH, and returns the entry-effect lines the incoming pair EMITTED. It reads the stream
 * rather than HP because the defect it watches has no HP in it: a heal onto a full-HP partner is a
 * no-op on state in BOTH engines, and the roadmap's instruction was to measure that on HP first and
 * say so. The probe asserts the HP did not move as well as the line count, so "no line" cannot mean
 * "no heal happened at all". */
/* `spreadTargetless(` and `tantrumAfter(` added 2026-08-07 with ROADMAP #81 WIRE 9 / ROADMAP #84,
 * declared HERE and with their reasons. `spreadTargetless(` stages a real doubles board through
 * `battleInit` and spends a real turn through `battleTurn`, reading BOTH foes' HP and the emitted
 * stream — the defect it watches lives in what `playerAction` BUILDS and what the turn loop then does
 * with it, so a direct call to `dmgRange` is structurally blind to both halves. `tantrumAfter(` spends
 * TWO OR THREE real turns, because the mechanic is a fact carried ACROSS a turn boundary: what a base
 * power reads this turn depends on how the previous turn ended, and no single-turn probe can see it. */
/* `spreadKOLeak(`, `stepShape(` and `spreadFaintOrder(` added 2026-08-07 with ROADMAP #81 WIRE 10,
 * declared HERE and with their reasons. All three stage a real doubles board through `battleInit` and
 * spend a real turn through `battleTurn`, because the thing they watch is the SHAPE of the hit loop
 * and nothing below the turn loop has a shape at all: `dmgRange` is handed one attacker and one
 * defender, so a direct call cannot see an order across targets even in principle. `spreadKOLeak(`
 * reads HP, `stepShape(` and `spreadFaintOrder(` read the emitted stream — and each of the two stream
 * probes asserts HP beside the order, so "the right order" cannot come to mean "the move stopped
 * hitting somebody". */
/* `gleamAt(`, `herbIntim(`, `herbMixed(`, `herbUnburden(`, `aftermathHit(`, `punishOrder(`,
 * `critIntim(`, `critDef(`, `critScreen(` and `critBurn(` added 2026-08-07 with ROADMAP #81 WIRE 11,
 * declared HERE and with their reasons, exactly as the paragraph above requires — the ratchet caught
 * all ten as direct calls on their first run, which is the guard working. Every one of them stages a
 * real doubles board through `battleInit` and spends a real turn through `battleTurn`; `herbIntim(`
 * is the one that stops at `battleInit`, deliberately, because the mechanic it watches fires ON THE
 * SWITCH-IN and a turn spent afterwards would let the residual — which already restores stats — do
 * the work and hide the defect. Seven read HP, two read a stat stage and the item slot, and
 * `punishOrder(` reads the stream with both bodies' HP asserted beside it. */
/* `auraHit(`, `passMove(`, `curseTurn(` and `perishRun(` added 2026-08-07 with ROADMAP #81 WIRE 12,
 * declared HERE and with their reasons, exactly as the paragraph above requires. Every one of them
 * stages a real doubles board through `battleInit` and spends at least one real turn through
 * `battleTurn`, and each is a helper rather than an inline body because the mechanic it watches needs
 * a board a pure call cannot express: `auraHit(` needs a FOURTH body on the field (the aura is a
 * property of the field, so a two-body `dmgRange` is structurally blind to a carrier standing on the
 * partner slot); `passMove(` needs a BENCH, since the whole defect is that nothing ever left the
 * field; `curseTurn(` spends TWO turns because the Ghost half's chip is a residual and a one-turn
 * probe cannot tell it from a one-off hit; `perishRun(` spends up to FIVE, because the claim being
 * tested is WHICH turn the KO lands on and no single turn contains that. */
/* `orbToll(` added 2026-08-07 with ROADMAP #81 WIRE 12's fifth item, declared HERE and with its
 * reason: it stages a real doubles board through `battleInit` and spends a real turn through
 * `battleTurn` on the LOSING accuracy roll, because the whole defect is a branch that only exists
 * when a move MISSES — and nothing below the turn loop can miss. */
const REALTURN = /battleTurn|battleInit|\bboard\(|\bturnDamage\(|\bturnDamageBig\(|\bhitOnRoll\(|\btwoTurn\(|\bvaluedAcc\(|\bmoveLines\(|\bentryLines\(|\bspreadTargetless\(|\btantrumAfter\(|\bspreadKOLeak\(|\bstepShape\(|\bspreadFaintOrder\(|\bgleamAt\(|\bherbIntim\(|\bherbMixed\(|\bherbUnburden\(|\baftermathHit\(|\bpunishOrder\(|\bcritIntim\(|\bcritDef\(|\bcritScreen\(|\bcritBurn\(|\bauraHit\(|\bpassMove\(|\bcurseTurn\(|\bperishRun\(|\borbToll\(/;
const probe = (kind, tag, label, fn) => {
  let works = false, detail = '', arms = null;
  const src = String(fn);
  let hollow = /readFileSync/.test(src);
  const directCall = !REALTURN.test(src);
  try { const r = fn(); works = !!r.works; detail = r.detail; arms = r.arms || null; }
  catch (e) { works = false; threw++; detail = 'THREW: ' + e.message.slice(0, 60); }
  if (works && armsAgree(arms)) hollow = true;
  results.push({ kind, tag, label, works, detail, hollow, armed: !!arms, directCall });
};

/* ---- ITEMS -------------------------------------------------------------------------------------- */

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). This is the probe CLAUDE.md and the header
 * above both hold up as the example of a real control, and the control was never the problem — what
 * it could not ask is whether the number it computes is the one that ORDERS THE TURN. `effSpeed` is
 * a function; the turn order is a comparator over it, and this engine has had the comparator wrong
 * (WIRE 118, WIRE 123) while every speed number was right.
 *
 * THE OUTCOME IS WHO GOT THERE FIRST, and the only way to see that in a battle state is to make
 * going first MATTER: the foe is left on 1 HP, so if the Scarf holder really moved first the foe
 * never acts and takes nothing back. Both Basculegion, both handed an explicit Speed, and the item is
 * the one varied thing. */
probe('item', 'speedMult', 'Choice Scarf raises Speed', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('basculegion', 'incineroar', 'basculegion', 'garchomp');
    me.st = Object.assign({}, me.st, { sp: 100 });
    f1.st = Object.assign({}, f1.st, { sp: 130 });
    me.item = item; f1.curHP = 1;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      /* MY CLICK IS RECOIL-FREE AND THE FOE'S IS NOT, and that asymmetry is the point (WIRE 4).
       * Both sides used to click Wave Crash, whose recoil is 33/100 — and Showdown's
       * `applyRecoilDamage` CLAMPS recoil to a minimum of 1 (battle-actions.ts:1384), so killing a
       * 1 HP foe with it costs the killer exactly 1. This probe reads "damage taken must be 0" as
       * its proof that the foe never acted, and until WIRE 4 corrected the rounding this engine
       * floored 1/3 of 1 to zero — so the probe was green because of a bug that made a real cost
       * disappear. Liquidation is the same type, same category, 100% accurate and carries no `rc`,
       * so the only thing that can move my HP is the foe getting a turn. */
      new Map([[me, M.playerAction(me, 'liquidation', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'wavecrash', me, S.field)], [f2, { kind: 'pass' }]]));
    return [M.effSpeed(me, S.field, 'A'), before - me.curHP];
  };
  const control = run(''), test = run('choicescarf');
  return { works: control[0] === 100 && test[0] > 140 && control[1] > 0 && test[1] === 0,
           arms: { control, test },
           detail: `[own Speed, damage taken from a 130-Speed foe on 1 HP] — no item ${control} `
                 + `(slower, so it got hit), Choice Scarf ${test} (faster, so the foe never acted)` };
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
  return { works: left > none && none === 0, arms: { control: none, test: left },
           detail: `no item ${none} hp  ->  leftovers ${left} hp (the control must be exactly 0 — an `
                 + `engine that healed everybody every turn passes "leftovers > none")` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). It read `buildMon('charizard-mega-y')` and
 * matched /mega/ on the NAME — which is a test of the string it was handed, not of the stone. It
 * would have passed on an engine where the item did nothing at all, because the mega name was typed
 * into the probe.
 *
 * THE STONE IS THE ONLY VARIED THING NOW, and the chain is followed all the way onto the field: the
 * item picks the FORME, the forme picks the ABILITY over the sheet's declared Blaze (a team sheet
 * lists the PRE-mega ability, which is the gap tests/test-effective-identity.js exists for), and the
 * ability fires as a real entry effect through battleInit. The receipt is the WEATHER standing on the
 * board and the Special Attack the body carries — two independent halves, because a forme swap that
 * forgot the ability and an ability swap that forgot the stats would each pass on one of them.
 *
 * `mega` does not fire from an ITEM under node — megaForme() reads window.MEGA_FORMES and returns
 * null server-side, which tests/test-mega-timing.js asserts deliberately. buildMonFromSet is the path
 * that does the swap off the artifact's `megaStone` tag, and it is the path a pasted team takes. */
probe('item', 'megaStone', 'a mega stone builds the mega body', () => {
  const set = (item) => ({ species: 'Charizard', item, ability: 'Blaze', nature: 'Modest',
                           sp: { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
                           moves: ['Heat Wave', 'Protect'] });
  const run = (item) => {
    const me = M.buildMonFromSet(set(item));
    if (!me) return ['NO BODY', '', 0];
    const ally = bare('corviknight'), f1 = bare('garchomp'), f2 = bare('milotic');
    const S = M.battleInit([me, ally], [f1, f2], {});          // NOT seeded: entry abilities fire
    return [me.name, me.ability, me.st.sa, S.field.weather || 'none'];
  };
  const control = run(''), test = run('Charizardite Y');
  return { works: String(control) === 'charizard,blaze,141,none'
                  && test[0] === 'charizard-mega-y' && test[1] === 'drought'
                  && test[2] > control[2] && test[3] === 'sun',
           arms: { control, test },
           detail: `[name, ability, SpA, weather after the leads arrive] — no item ${control}; `
                 + `Charizardite Y ${test} (the sheet declared Blaze in BOTH arms)` };
});

/* WIRE 132 — THE FORME THE STONE MAKES COMES FROM THE ARTIFACT, AND A MEGA THAT THREATENS NOTHING.
 *
 * The probe above varies the STONE and reads the forme. It cannot see which KEY the builder asked
 * for, and for Floette-Eternal — ~10.5% of ladder sides — the concatenated `key + '-mega'` guess
 * reached `floette-eternal-mega`, the one row in the table with BOTH `ab: null` and `mv: []`, while
 * `data/abra-tags.js` had `Floettite: {into:{'Floette-Eternal':'Floette-Mega'}}` all along and
 * `floette-mega` carries Fairy Aura and the right base stats.
 *
 * THREE THINGS ARE READ, because each one fails differently: the NAME (which row was reached), the
 * ABILITY (a mega's whole point), and WHAT THE BODY THREATENS through a real turn (the `mv: []` half
 * — a Pokemon with no moves is invisible to every scorer in this project and looks exactly like a
 * harmless one). The last is the reason this is not a cosmetic fix. */
probe('item', 'megaStone', 'the stone names the forme, and the mega body still threatens something', () => {
  const set = (item) => ({ species: 'Floette-Eternal', item, ability: 'Flower Veil', nature: 'Modest',
                           sp: { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
                           moves: ['Moonblast', 'Dazzling Gleam', 'Light of Ruin', 'Protect'] });
  /* THE BODY IS BUILT BY NAME, not from a set, on this arm — that is the path position_features.js
   * and the sets loader take, and it is the ONLY path that reads the row's own `mv`. */
  const threat = (name) => {
    const me = M.buildMon(name, {}); if (!me) return { mv: 'NO BODY', dealt: -1 };
    const B = board('incineroar', 'corviknight', 'garchomp', 'milotic');
    B.S.actA[0] = me; unfaintable(B.f1);
    /* THE FIRST DAMAGING MOVE THE BODY HOLDS, not `moves[0]` — this row's move list starts with
     * Protect, and the first cut of this probe clicked it and read 0 against a fixed engine. The
     * question is whether the body threatens ANYTHING, so the click is the first move that can. */
    const hit = me.moves.find(id => MC.moves[id] && MC.moves[id].bp > 0);
    const before = B.f1.curHP;
    if (hit) M.battleTurn(B.S, rng5,
      new Map([[me, M.playerAction(me, hit, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    return { mv: me.moves.length, hit: hit || 'NONE', dealt: before - B.f1.curHP };
  };
  const built = (item) => {
    const me = M.buildMonFromSet(set(item)); if (!me) return ['NO BODY', '', 0];
    const ally = bare('corviknight'), f1 = bare('garchomp'), f2 = bare('milotic');
    M.battleInit([me, ally], [f1, f2], {});                     // NOT seeded: entry effects fire
    return [me.name, me.ability, me.st.sa];
  };
  const control = built(''), test = built('Floettite');
  const byName = threat('floette-mega');
  return { works: String(control) === 'floette-eternal,flowerveil,159'
                  && test[0] === 'floette-mega' && test[1] === 'fairyaura' && test[2] > control[2]
                  && byName.mv === 4 && byName.dealt > 0,
           arms: { control, test },
           detail: `[forme, ability, SpA] — no stone ${control}; Floettite ${test} (the artifact's `
                 + `into-map says Floette-Mega; the concatenated guess is floette-eternal-mega, which `
                 + `carries ab:null and mv:[]). buildMon('floette-mega') by NAME now holds `
                 + `${byName.mv} moves and its ${byName.hit} dealt ${byName.dealt}` };
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). The body is now put on a real field and its
 * Bullet Punch is CLICKED, which is what a rollout does with it -- an ability that reached the damage
 * calc and not the battle loop is exactly the failure WIRE 128 has just been fixed for. */
probe('ability', 'megaRowAbilityCase', 'a mega built from its own row still gets its ability', () => {
  const hit = (ab) => {
    const B = board('incineroar', 'corviknight', 'garchomp', 'milotic');
    const a = M.buildMon('scizor-mega', {}); a.item = '';
    if (ab !== undefined) a.ability = ab;
    B.S.actA[0] = a; B.me = a;
    unfaintable(B.f1);
    const before = B.f1.curHP;
    M.battleTurn(B.S, rng5,
      new Map([[a, M.playerAction(a, 'bulletpunch', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    return { ab: a.ability, dealt: before - B.f1.curHP };
  };
  const asBuilt = hit(undefined), off = hit('none'), on = hit('technician');
  /* The 85-row figure is NOT recomputed here on purpose: sweeping Object.keys(MC.mons) is a
   * hand-rolled index into that table and tests/test-mc-key.js bans it, correctly. */
  return { works: on.dealt > off.dealt && off.dealt > 0 && asBuilt.dealt === on.dealt,
           arms: { control: off.dealt, test: asBuilt.dealt },
           detail: `Bullet Punch through a real turn: ability none ${off.dealt}, 'technician' `
                 + `${on.dealt}, as built (ability=${JSON.stringify(asBuilt.ab)}) ${asBuilt.dealt}` };
});

/* A SHEET LISTS THE PRE-MEGA ABILITY, so a paste of "Scizor @ Scizorite / Ability: Swarm" describes a
 * body that will be on the field with TECHNICIAN. buildMonFromSet wrote `declaredAb || megaAbility(...)`
 * and let the sheet win, so every imported mega ran its base forme's ability -- the mega ability gap
 * that tests/test-effective-identity.js exists to stop, living in the engine instead of in board.js.
 *
 * The control is the same paste with the ability line REMOVED. If the two arms disagree the sheet is
 * still steering; if they agree at the un-boosted number the ability is not firing at all, so the
 * absolute damage is asserted too, not just the equality. */
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Every arm now sends the pasted body into a real
 * battle and clicks its move, so the chain that is asserted runs paste -> forme -> ability -> the
 * damage the loop actually deals, rather than stopping at the calc. */
probe('ability', 'megaSheetAbility', "a sheet's pre-mega ability does not override the mega's", () => {
  const run = (declared, blank) => {
    const paste = 'Scizor @ Scizorite\n' + (declared ? 'Ability: ' + declared + '\n' : '')
                + 'Adamant Nature\n- Bullet Punch';
    const a = M.buildMonFromSet(M.parsePaste(paste)[0]);
    if (!a) return { name: null, ab: null, dealt: -1 };
    if (blank) a.ability = 'none';
    const B = board('incineroar', 'corviknight', 'garchomp', 'milotic');
    B.S.actA[0] = a;
    unfaintable(B.f1);
    const before = B.f1.curHP;
    M.battleTurn(B.S, rng5,
      new Map([[a, M.playerAction(a, 'bulletpunch', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    return { name: a.name, ab: a.ability, dealt: before - B.f1.curHP };
  };
  const sheet = run('Swarm', false), silent = run(null, false);
  /* The un-boosted reading, taken from the same body with the ability explicitly blanked, so the
   * "is it firing" half of the assertion is measured rather than remembered. */
  const off = run(null, true).dealt;
  return { works: sheet.ab === 'technician' && sheet.dealt === silent.dealt && sheet.dealt > off && off > 0,
           arms: { control: off, test: sheet.dealt },
           detail: `sheet says Swarm -> ${sheet.name} ability=${JSON.stringify(sheet.ab)} ${sheet.dealt}; `
                 + `sheet silent -> ability=${JSON.stringify(silent.ab)} ${silent.dealt}; `
                 + `same body with no ability ${off}` };
});

/* ================= ROADMAP #31 — MEGA EVOLUTION IS A CHOICE, MADE MID-TURN ========================
 *
 * The four probes above all describe a mega that was ALREADY EVOLVED before the battle started, which
 * is what this engine did: buildMonFromSet resolved "Gengar @ Gengarite" straight to the mega row, and
 * buildMon handed a base-forme Gengar the MEGA's ability while leaving it the BASE's stats. Showdown
 * evolves on a CHOICE, at order 104 inside the turn. That difference parted the two protocol streams
 * on line one of every game carrying a stone, and engine/game_differential.js had to strip 460 sets to
 * run at all.
 *
 * WHAT EACH OF THE SIX BELOW WOULD MISS IF IT WERE THE ONLY ONE, which is why there are six:
 *   - built-base-then-evolves: the timing. Passes on an engine that megas at build if you only look
 *     at the end state, so BOTH ends are read.
 *   - the OVERWRITE: an engine that never touches the ability after a Skill Swap looks identical to a
 *     correct one on the 8 megas whose ability does not change. Asserted as EQUALITY to the mega
 *     forme's ability, never as "it changed".
 *   - either slot: mega has already passed an at-least-one check in this project at 56% of sides,
 *     because the base class could only evolve from the LEFT slot.
 *   - the new SPEED: an engine that evolves after the turn order is frozen is right about everything
 *     except who moved, which surfaces later as unattributable noise.
 *   - the entry ability: WIRE 123 was entry abilities resolving in the wrong order, so this path has
 *     history.
 *   - one per side: the format's strictest rule, and the one an auto-mega policy would break silently.
 */

/* A NOTE ON WHY THIS USES SKILL SWAP AND NOT WORRY SEED. The acceptance case Will named is "Worry Seed
 * a Tyranitar to Insomnia, then mega it". MEASURED FIRST: `worryseed` carries only `moveClass` and
 * `statusCategory` in data/tags.json — no ability-writing tag — so this engine does not implement it
 * and the move is inert. Writing the probe around it would have produced a green result proving
 * nothing, because the control and the test would both start from Sand Stream. Skill Swap is the same
 * mechanism (it WRITES the body's ability from outside) and is wired, so it is the honest instrument.
 * That Worry Seed is unimplemented is reported as a finding, not hidden inside a passing probe. */
probe('ability', 'megaAbilityOverwrite', 'a mega OVERWRITES whatever ability the body has, and the new one fires', () => {
  const run = (mega) => {
    const me = M.buildMon('tyranitar', {}); me.item = 'tyranitarite';
    const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
    f1.ability = 'roughskin';
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true, autoMega: false });
    /* TURN 1 — the foe writes a DIFFERENT ability onto the body. Skill Swap exchanges, so the
     * Tyranitar ends the turn holding Rough Skin and no longer sets any weather at all. */
    M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'skillswap', me, S.field)], [f2, { kind: 'pass' }]]));
    const swapped = me.ability;
    /* A DIFFERENT WEATHER IS PUT UP IN BETWEEN, so "the sandstorm returned" cannot be satisfied by a
     * sandstorm that was simply never cleared. Showdown's setWeather refuses to re-set the weather
     * already standing, so starting from sand would make the strongest half of this probe untestable. */
    S.field.weather = M.weatherId('rain'); S.field.weatherT = 5;
    const act = M.playerAction(me, 'rockslide', f1, S.field); if (mega) act.mega = true;
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [swapped, me.name, me.ability, S.field.weather];
  };
  const control = run(false), test = run(true);
  /* EQUALITY AGAINST THE MEGA ROW'S OWN ABILITY, never "it is different from what it was". 8 of the
   * 74 megas in this format keep their base slot-0 ability (Tyranitar-Mega is one of them), so an
   * inequality assertion would fail on a correct engine. */
  const want = String((MC.mons['tyranitar-mega'] || {}).ab || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return { works: control[0] === 'roughskin' && control[2] === 'roughskin' && control[3] === 'rain'
                  && test[0] === 'roughskin' && test[1] === 'tyranitar-mega'
                  && test[2] === want && test[3] === 'sand',
           arms: { control, test },
           detail: `[ability after Skill Swap, forme, ability, weather] — no mega ${control} (it keeps `
                 + `the swapped ability and the rain stands); mega ${test} (the ability EQUALS the mega `
                 + `row's ${JSON.stringify(want)} and the Sand Stream re-set the sky over the rain)` };
});

probe('item', 'megaStone', 'a stone-holder is built as its BASE forme and evolves on a CHOICE, mid-turn', () => {
  const run = (mega) => {
    /* THE STONE IS THE ONLY VARIED THING IN THE BUILD and it is the row's own item, so the control
     * arm is the SAME body that simply is never told to evolve — not a different Pokemon. */
    const me = M.buildMon('gengar', {}); me.item = 'gengarite';
    const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true, autoMega: false });
    const built = [me.name, me.ability, me.st.sa];
    unfaintable(f1);
    const act = M.playerAction(me, 'shadowball', f1, S.field); if (mega) act.mega = true;
    const before = f1.curHP;
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { built, after: [me.name, me.ability, me.st.sa], dealt: before - f1.curHP };
  };
  const control = run(false), test = run(true);
  /* THE BUILD IS ASSERTED AS WELL AS THE END STATE. An engine that megas at BUILD time reaches the
   * same `after` on the test arm and fails here, which is the whole point of the change. */
  return { works: String(control.built) === 'gengar,cursedbody,200'
                  && String(control.after) === 'gengar,cursedbody,200'
                  && test.after[0] === 'gengar-mega' && test.after[1] === 'shadowtag'
                  && test.after[2] > control.after[2] && test.dealt > control.dealt,
           arms: { control: [control.built, control.after, control.dealt],
                   test: [test.built, test.after, test.dealt] },
           detail: `[forme, ability, SpA] as BUILT ${control.built} (base forme, base ability, holding `
                 + `the stone); never told to mega ${control.after} dealing ${control.dealt}; told to `
                 + `mega ${test.after} dealing ${test.dealt}` };
});

probe('item', 'megaStone', 'mega evolution fires from EITHER active slot', () => {
  const run = (slot) => {
    const me = M.buildMon('gengar', {}); me.item = 'gengarite';
    const ally = bare('clefable');
    const A = slot === 0 ? [me, ally] : [ally, me];
    const f1 = bare('garchomp'), f2 = bare('milotic');
    const S = M.battleInit(A, [f1, f2], { seeded: true, autoMega: false });
    unfaintable(f1);
    const act = M.playerAction(me, 'shadowball', f1, S.field); act.mega = true;
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [slot, me.name, me.ability];
  };
  const control = run(0), test = run(1);
  return { works: control[1] === 'gengar-mega' && test[1] === 'gengar-mega'
                  && control[2] === 'shadowtag' && test[2] === 'shadowtag',
           arms: { control, test },
           detail: `[slot, forme, ability] — LEFT slot ${control}; RIGHT slot ${test}. The last mega `
                 + `defect in this project passed an at-least-one check while firing on 56% of sides, `
                 + `because the base class could only evolve from the left slot` };
});

probe('item', 'megaStone', "the mega's NEW Speed governs that turn's move order", () => {
  /* THE OUTCOME IS WHO GOT THERE FIRST, read the way tests/test-mechanics.js's Choice Scarf probe
   * reads it: the foe is left on 1 HP, so if the mega really out-sped it the foe never acts and deals
   * nothing back. Gengar 110 base Speed becomes 130, and the explicit stat block puts the foe exactly
   * between the two — 100 before, 120 after, against a foe on 110. */
  const run = (mega) => {
    const me = M.buildMon('gengar', {}); me.item = 'gengarite';
    const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
    me.st = Object.assign({}, me.st, { sp: 100 });
    f1.st = Object.assign({}, f1.st, { sp: 110 });
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true, autoMega: false });
    f1.curHP = 1;
    const before = me.curHP;
    const act = M.playerAction(me, 'shadowball', f1, S.field); if (mega) act.mega = true;
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return [M.effSpeed(me, S.field, 'A'), before - me.curHP];
  };
  const control = run(false), test = run(true);
  return { works: control[0] === 100 && test[0] === 120 && control[1] > 0 && test[1] === 0,
           arms: { control, test },
           detail: `[own Speed, damage taken from a 110-Speed foe on 1 HP] — no mega ${control} `
                 + `(slower, so it got hit); mega ${test} (the evolution resolved BEFORE the moves and `
                 + `the turn re-sorted around the new Speed, so the foe never acted)` };
});

probe('ability', 'megaEntryAbility', 'an entry ability on the MEGA forme fires on evolution', () => {
  /* Manectric is Lightning Rod and Manectric-Mega is Intimidate, so the drop cannot leak in from the
   * base forme. Read as an OUTCOME as well as a stage: the foe's Attack stage AND what its physical
   * move then deals. */
  const run = (mega) => {
    const me = M.buildMon('manectric', {}); me.item = 'manectite';
    const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true, autoMega: false });
    unfaintable(me);
    const act = M.playerAction(me, 'thunder', f1, S.field); if (mega) act.mega = true;
    const before = me.curHP;
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return [me.ability, f1.boosts.at, f2.boosts.at, before - me.curHP];
  };
  const control = run(false), test = run(true);
  return { works: control[0] === 'lightningrod' && control[1] === 0 && control[2] === 0
                  && test[0] === 'intimidate' && test[1] === -1 && test[2] === -1
                  && test[3] < control[3] && control[3] > 0,
           arms: { control, test },
           detail: `[ability, foe A atk stage, foe B atk stage, Earthquake taken] — no mega ${control}; `
                 + `mega ${test} (Intimidate arrived WITH the evolution and both foes are at -1, so the `
                 + `Earthquake that follows in the same turn hits softer)` };
});

probe('item', 'megaStone', 'ONE mega per side per battle — a second stone-holder on the same side cannot', () => {
  const stoned = (key, item) => { const b = M.buildMon(key, {}); b.item = item; return b; };
  const run = (secondOnTheSameSide) => {
    const a0 = stoned('gengar', 'gengarite'), a1 = stoned('mawile', 'mawilite');
    const b0 = stoned('scizor', 'scizorite'), b1 = bare('milotic');
    /* The SECOND evolution is attempted by a1 (same side) or by b0 (the other side). Everything else
     * about the two arms is identical, so the only varied thing is WHOSE mega it would be. */
    const second = secondOnTheSameSide ? a1 : b0;
    const S = M.battleInit([a0, a1], [b0, b1], { seeded: true, autoMega: false });
    const t1 = M.playerAction(a0, 'shadowball', b0, S.field); t1.mega = true;
    M.battleTurn(S, rng5, new Map([[a0, t1], [a1, { kind: 'pass' }]]), PASS2(b0, b1));
    const mv = secondOnTheSameSide ? 'ironhead' : 'bulletpunch';
    const t2 = M.playerAction(second, mv, secondOnTheSameSide ? b0 : a0, S.field); t2.mega = true;
    const sideA = new Map([[a0, { kind: 'pass' }], [a1, secondOnTheSameSide ? t2 : { kind: 'pass' }]]);
    const sideB = new Map([[b0, secondOnTheSameSide ? { kind: 'pass' } : t2], [b1, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, sideA, sideB);
    return [a0.name, second.name];
  };
  const control = run(false), test = run(true);
  return { works: String(control) === 'gengar-mega,scizor-mega' && String(test) === 'gengar-mega,mawile',
           arms: { control, test },
           detail: `[first evolver, second evolver] — the second on the OTHER side ${control} (both `
                 + `evolve); the second on the SAME side ${test} (the Mawile is refused, so the side's `
                 + `one mega is genuinely spent)` };
});

/* ---- MOVES -------------------------------------------------------------------------------------- */

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). It read `moveAccuracy('aerialace') >= 100` and
 * asserted the answer, which passes on an engine whose accuracy lookup is `ACC[id] || 100` -- i.e. on
 * an engine where EVERYTHING is 100 and nothing can ever miss. The tag's carriers are the 124 status
 * moves (`pHit: 1, note: "default for status"`), so the mechanic is "a never-missing move RESOLVES on
 * a roll that a missable move loses", and the only way to see it is to spend the turn.
 *
 * THREE ARMS, because two cannot separate "Tailwind never misses" from "the control move never
 * works": the same Sleep Powder is run on a WINNING roll first and must land, or the control arm is
 * evidence about nothing. */
probe('move', 'neverMisses', 'Tailwind resolves on a roll that Sleep Powder loses', () => {
  const run = (moveId, rng) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
    M.battleTurn(S, rng,
      new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return moveId === 'tailwind' ? S.field.twA > 0 : f1.status === 'slp';
  };
  const canLand = run('sleeppowder', rng5);        // 0.50 beats 75 — the control arm is capable
  const control = run('sleeppowder', rngLose);     // 0.99 loses 75 — a missable move misses
  const test = run('tailwind', rngLose);           // the same losing roll, a never-miss move
  return { works: canLand === true && control === false && test === true,
           arms: { control, test },
           detail: `Sleep Powder (75%) on a winning roll: ${canLand}; on a LOSING roll: ${control}; `
                 + `Tailwind on that same losing roll: ${test}` };
});

/* THE OTHER HALF OF neverMisses, AND IT WAS RED WHEN IT WAS WRITTEN. A never-miss set only means
 * anything if the moves OUTSIDE it can miss. `moveAccuracy` resolved every id through a hand-typed
 * 35-entry `ACC` literal and fell back to 100, so 78 of the 500 moves in this engine's own table --
 * Heat Wave at 7,405 corpus clicks, Matcha Gotcha at 5,352, Draco Meteor, Icy Wind, Hyper Beam --
 * were NEVER-MISSING while carrying no such tag. The gap was already filed on ENGINE's hand list
 * ("the TABLE is the same class of hand list this file has spent the session deleting and it should
 * be derived") and nothing failed on it, because the only probe pointed at it asserted `>= 100`.
 *
 * The expected numbers are the FORMAT's, read out of gen9championsvgc2026regmb at the pinned commit
 * 20ad99ff: heatwave 90, matchagotcha 90. Both must miss on a roll Aerial Ace survives. */
probe('move', 'neverMisses', 'a move the artifact does NOT tag neverMisses can still miss', () => {
  const hit = (mv) => turnDamage(['incineroar', 'corviknight', 'garchomp', 'garchomp'], null, mv, rngLose);
  const land = (mv) => turnDamage(['incineroar', 'corviknight', 'garchomp', 'garchomp'], null, mv, rng5);
  const control = [hit('heatwave'), hit('matchagotcha')];      // the format says 90% — both must be 0
  const test = hit('aerialace');                               // tagged neverMissesAttack — must land
  const capable = [land('heatwave'), land('matchagotcha')];    // and both must work on a winning roll
  return { works: control[0] === 0 && control[1] === 0 && test > 0 && capable[0] > 0 && capable[1] > 0,
           arms: { control, test },
           detail: `on a LOSING roll — Heat Wave (90%) ${control[0]}, Matcha Gotcha (90%) ${control[1]} `
                 + `(both must be 0), Aerial Ace ${test} (must land); on a winning roll the two 90% `
                 + `moves deal ${capable.join(' and ')}` };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3), AND THESE TEN WERE PICKED BY A NUMBER RATHER THAN BY
 * EYE. tests/test-medicham-coverage.js weights every tag by the corpus usage of the entities in
 * the 99% set that carry it, and these are the top of that list -- `statusInflict` 585,893,
 * `contact` 444,874, `priority` 359,331. Move coverage read 9.3% of USAGE armed against 260 of 277
 * moves LIVE, and the gap is entirely that the handful of tags the biggest moves carry were the
 * ones nobody had declared arms on. Every control below was already being computed. */
/* ROADMAP #81 WIRE 2 -- THIS PROBE USED TO ENCODE THE BUG. Its previous form spent three turns and
 * asserted only `dealt[0] === 0 && dealt[last] > 0`: "the counter decays". It does, and that half was
 * never wrong. What it could not see is that in the real game THE COUNTER IS DELETED THE INSTANT THE
 * ROLL FAILS -- Showdown's `stall` condition (data/conditions.ts) is
 *     onStallMove(pokemon) { const success = this.randomChance(1, counter);
 *                            if (!success) delete pokemon.volatiles['stall']; return success; }
 * so the Protect AFTER a failed one is back to a guaranteed shield. medicham2 incremented forever, so
 * a shield that lost once kept decaying 1/27, 1/81 and never recovered. A three-turn probe stops one
 * turn before the only turn that can tell the two engines apart, which is why it passed on a wrong
 * engine for as long as it existed. Four turns at a FIXED roll of 0.2 walk the whole rule:
 *     turn 1  counter absent   guaranteed                       blocked
 *     turn 2  counter 3        0.2 < 1/3   -> succeeds, ctr 9   blocked
 *     turn 3  counter 9        0.2 < 1/9?  -> FAILS, ctr GONE   HIT   <- the decay half
 *     turn 4  counter absent   guaranteed                       blocked   <- the reset half
 * The old engine reads turn 4 as 1/27 at the same roll and takes the hit again. */
probe('move', 'stalling', 'consecutive Protect decays, and a FAILED Protect resets the counter to fresh', () => {
  /* RE-DERIVING THE RULE IS NOT TESTING IT. The first version computed (1/3)^n here and asserted its
   * own arithmetic -- it would have passed with the engine deleted. This spends real turns and asks
   * whether the shield actually stops blocking, and then whether it starts again. */
  const me = bare('incineroar'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  /* Four turns of Earthquake would faint the body, and a faint clamps the HP loss so turns 3 and 4
   * would print the same number whatever the engine did. Both Garchomp are Ground and take none. */
  unfaintable(me); unfaintable(ally);
  const rng2 = () => 0.2;
  const dealt = [];
  for (let t = 0; t < 4; t++) {
    const fa = new Map([[me, M.playerAction(me, 'protect', null, S.field)], [ally, { kind: 'pass' }]]);
    const fb = new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]);
    const before = me.curHP;
    M.battleTurn(S, rng2, fa, fb);
    dealt.push(before - me.curHP);
  }
  return { works: dealt[0] === 0 && dealt[1] === 0 && dealt[2] > 0 && dealt[3] === 0,
           arms: { control: dealt[2], test: dealt[3] },
           detail: `damage taken per consecutive Protect at a fixed roll of 0.2: ${dealt.join(', ')} `
                 + `— turn 3 must be the FAILURE and turn 4 must be blocked again` };
});

/* ROADMAP #81 WIRE 2, THE SECOND HALF. Every shield in data/moves.ts opens with
 *     onPrepareHit(pokemon) { return !!this.queue.willAct() && this.runEvent('StallMove', pokemon); }
 * `BattleQueue.willAct()` (sim/battle-queue.ts:310) returns the first remaining `move`/`switch`/
 * `instaswitch`/`shift` action IN THE QUEUE BEHIND THIS ONE. So a Protect whose user holds the LAST
 * action of the turn fails outright, draws no die, and never adds `stall`. medicham2 did not model it
 * at all. It is short-circuited before the roll, which is why the reset half above cannot see it.
 *
 * THE KNOB IS THE FOE'S SPEED AND NOTHING ELSE. Every body clicks a shield on turn 1, so no damage is
 * dealt in either arm and the only thing the Speed changes is WHERE `me` lands in the +4 bracket.
 * ASSERTED ON THE NEXT TURN, because a Protect that fails when nothing is left to act blocks nothing
 * either way -- the observable is that the failed shield never armed the counter, so the shield on
 * turn 2 is a fresh 100% instead of a 1/3 that a losing roll takes down. */
probe('move', 'stalling', 'Protect FAILS outright when its user holds the LAST action of the turn', () => {
  const SH = { kind: 'protect', mv: 'protect' };
  const run = (foeSpe) => {
    const me = bare('incineroar'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    unfaintable(me); unfaintable(ally);
    me.st = Object.assign({}, me.st, { sp: 100 });
    ally.st = Object.assign({}, ally.st, { sp: 150 });
    f2.st = Object.assign({}, f2.st, { sp: 150 });
    f1.st = Object.assign({}, f1.st, { sp: foeSpe });
    /* turn 1 — four shields, all at +4, so the order inside the bracket is pure Speed. */
    M.battleTurn(S, rng5, new Map([[me, SH], [ally, SH]]), new Map([[f1, SH], [f2, SH]]));
    /* turn 2 — the same shield at a LOSING roll, with a real attack behind it so this one is not
     * last either. Earthquake is 100% accurate, so 0.99 costs it nothing but the stall roll. */
    const before = me.curHP;
    M.battleTurn(S, rngLose,
      new Map([[me, SH], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const control = run(50);    // a SLOWER foe acts after `me`, so turn 1's shield goes up and arms 1/3
  const test = run(150);      // a FASTER foe leaves `me` holding the last action: turn 1's shield FAILS
  return { works: control > 0 && test === 0,
           arms: { control, test },
           detail: `damage taken on turn 2 behind a shield at roll 0.99 — foe Speed 50 (me acts before `
                 + `it, turn-1 shield succeeded, counter armed) ${control}; foe Speed 150 (me acts LAST, `
                 + `turn-1 shield failed, counter never armed) ${test}` };
});

/* ROADMAP #81 WIRE 1 -- A SHIELD PREEMPTS THE TO-HIT ROLL. Showdown runs TryHit as step 1 and
 * accuracy as step 4 (sim/battle-actions.ts:553-576), so a move aimed into a Protect is BLOCKED and
 * never rolls at all. medicham2 rolled first, and printed `|-miss|` where the authority prints
 * `|-activate|X|move: Protect` -- five games of the 2026-08-07 whole-game differential.
 *
 * ASSERTED ON HP, NOT ON THE LINE, because a protocol string proves nothing about what happened: the
 * measurement below is a Spiky Shield's 1/8 toll, which an engine that MISSED could never pay.
 * Showdown, 90%-accuracy High Jump Kick at a missing die:
 *     shield up    |-activate|p2a|move: Protect   |-damage|p1a|110/125|[from] Spiky Shield   (15 = 1/8)
 *     shield down  |-miss|p1a|p2a                 and no toll
 * THE ROLL IS THE LOSING ONE IN BOTH ARMS -- that is the whole probe. At a winning roll the block
 * happens either way and an engine with the order wrong passes. */
probe('move', 'stalling', 'a shield answers before the accuracy roll, so a MISSING die is still blocked', () => {
  const run = (shield) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    unfaintable(f1);
    const meBefore = me.curHP, foeBefore = f1.curHP;
    M.battleTurn(S, rngLose,                     // 0.99 -- High Jump Kick is 90, so the die MISSES
      new Map([[me, M.playerAction(me, 'highjumpkick', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, shield ? { kind: 'protect', mv: shield } : { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    /* the CRASH is paid in both arms (it is an onMoveFail, and a miss is a fail too), so what is
     * compared is the DIFFERENCE, which can only be the shield's toll. */
    return { lost: meBefore - me.curHP, dealt: foeBefore - f1.curHP, eighth: Math.floor(me.st.hp / 8),
             line: (trace.find(l => /^\|-(activate|immune|miss)\|/.test(l)) || '(none)') };
  };
  const control = run(null), test = run('spikyshield');
  return { works: control.dealt === 0 && test.dealt === 0 && /-miss/.test(control.line)
                  && /move: Protect/.test(test.line) && test.lost - control.lost === test.eighth,
           arms: { control: control.lost, test: test.lost },
           detail: 'a 90% move at roll 0.99 — no shield: line ' + control.line + ', user lost '
                 + control.lost + '; Spiky Shield up: line ' + test.line + ', user lost ' + test.lost
                 + ' (the difference must be the shield\'s 1/8 = ' + test.eighth + ')' };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3), AND THESE TEN WERE PICKED BY A NUMBER RATHER THAN BY
 * EYE. tests/test-medicham-coverage.js weights every tag by the corpus usage of the entities in
 * the 99% set that carry it, and these are the top of that list -- `statusInflict` 585,893,
 * `contact` 444,874, `priority` 359,331. Move coverage read 9.3% of USAGE armed against 260 of 277
 * moves LIVE, and the gap is entirely that the handful of tags the biggest moves carry were the
 * ones nobody had declared arms on. Every control below was already being computed. */
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
  const control = run(false), test = run(true);
  return { works: test < control && control > 0, arms: { control, test },
           detail: `foe dealt ${control} without  ->  ${test} after Fake Out` };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3), AND THESE TEN WERE PICKED BY A NUMBER RATHER THAN BY
 * EYE. tests/test-medicham-coverage.js weights every tag by the corpus usage of the entities in
 * the 99% set that carry it, and these are the top of that list -- `statusInflict` 585,893,
 * `contact` 444,874, `priority` 359,331. Move coverage read 9.3% of USAGE armed against 260 of 277
 * moves LIVE, and the gap is entirely that the handful of tags the biggest moves carry were the
 * ones nobody had declared arms on. Every control below was already being computed. */
probe('move', 'recoil', 'Brave Bird hurts its user and Drill Peck does not', () => {
  /* THE CONTROL IS A SECOND FLYING PHYSICAL MOVE OFF THE SAME BODY. "The user lost HP" is also what
   * an engine that charged every attacker prints, and Drill Peck carries no recoil at all. */
  const run = (mv) => {
    const me = bare('staraptor'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return before - me.curHP;
  };
  const control = run('drillpeck'), test = run('bravebird');
  return { works: test > 0 && control === 0, arms: { control, test },
           detail: `user lost ${test} hp to Brave Bird's recoil, ${control} to Drill Peck (no recoil)` };
});

/* ROADMAP #81 WIRE 4 -- RECOIL IS `Math.round(dealt * rc[0] / rc[1])`, AND IT WAS A FLOOR OF A
 * PRE-DIVIDED FLOAT. The probe above proves the user pays SOMETHING. It cannot see the amount, and
 * the amount was one point low on roughly half of all hits -- recoil was three of the four largest
 * `-damage field 3` causes in the whole-game differential.
 *
 * MEASURED IN THE AUTHORITY, by calling `battle.actions.applyRecoilDamage` directly rather than by
 * reading `sim/battle-actions.ts:1379-1384`:
 *
 *     dealt   1     2     3     4     5    100   101   102   103
 *     SD      1     1     1     1     2     33    33    34    34      <- Math.round, floor 1
 *     naive   0     0     0     1     1     33    33    33    33      <- Math.floor(dealt * 0.33)
 *
 * THE EXPECTED VALUE IS COMPUTED FROM AN OBSERVED QUANTITY, NOT PINNED. The probe reads how much the
 * FOE lost and asserts the user paid `round` of it -- so it is a statement of the rule rather than a
 * magic constant that a future staging change would quietly invalidate.
 *
 * AND IT ASSERTS THAT THE TWO RULES DISAGREE HERE. Wave Crash's 82 lands on a value where round and
 * floor give the same 27, which is the right kind of third arm: it shows the probe is not simply
 * "any number moved". The two that DO discriminate carry an explicit `round !== floor` assertion, so
 * if the staging ever drifts onto a value where they agree this probe goes RED rather than hollow. */
probe('move', 'recoil', 'the recoil charged is Showdown\'s ROUND of the damage dealt, not a floor', () => {
  const run = (mv) => {
    const me = bare('staraptor'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    me.item = ''; me.ability = 'none'; f1.item = ''; f1.ability = 'none';
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    f1.st = Object.assign({}, f1.st, { hp: f1.st.hp * 8 }); f1.curHP = f1.st.hp;
    const beforeMe = me.curHP, beforeFoe = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    const rc = MC.moves[mv].rc;
    return { lost: beforeMe - me.curHP, dealt: beforeFoe - f1.curHP,
             round: rc ? Math.round((beforeFoe - f1.curHP) * rc[0] / rc[1]) : 0,
             floor: rc ? Math.floor((beforeFoe - f1.curHP) * (rc[0] / rc[1])) : 0 };
  };
  const control = run('drillpeck');
  const bb = run('bravebird'), fb = run('flareblitz'), wc = run('wavecrash');
  const test = [bb, fb, wc];
  return { works: control.lost === 0
                  && bb.lost === bb.round && bb.round !== bb.floor
                  && fb.lost === fb.round && fb.round !== fb.floor
                  && wc.lost === wc.round && wc.round === wc.floor,
           arms: { control: control.lost, test: test.map(t => t.lost) },
           detail: `Drill Peck (no rc) ${control.lost}; ` + test.map((t, i) =>
             `${['Brave Bird', 'Flare Blitz', 'Wave Crash'][i]} dealt ${t.dealt} -> user paid ${t.lost} `
             + `(round ${t.round}, a truncating engine ${t.floor})`).join('; ')
             + ' — the first two MUST separate the two rules, the third must not' };
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

/* ARMED, 2026-08-06. The control is the SAME body spending the SAME turn on a click that must not
 * touch Attack — Recover, not "no turn at all", so the number of turns and every end-of-turn effect
 * is identical across the arms. An engine that boosted on any status click would pass the one-armed
 * version, and the third arm (the target's stages) rules out an engine that boosts EVERYBODY. */
probe('move', 'boostsUser', 'Swords Dance raises Attack', () => {
  const run = (mv) => {
    const me = bare('incineroar'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    me.curHP = Math.floor(me.st.hp / 2);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [me.boosts.at, f1.boosts.at, ally.boosts.at];
  };
  const control = run('recover'), test = run('swordsdance');
  return { works: String(control) === '0,0,0' && test[0] === 2 && test[1] === 0 && test[2] === 0,
           arms: { control, test },
           detail: `[user atk, foe atk, partner atk] — after Recover ${control}; after Swords Dance `
                 + `${test} (the user must move by 2 and nobody else at all)` };
});

/* ARMED, 2026-08-06. Same shape in the other direction, and the partner's stage is the arm that
 * separates "Charm drops the target" from "a stat move drops everything on the field". */
probe('move', 'lowersTarget', 'Charm drops the target Attack', () => {
  const run = (mv) => {
    const me = bare('whimsicott'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [f1.boosts.at, f2.boosts.at, me.boosts.at];
  };
  const control = run('tailwind'), test = run('charm');
  return { works: String(control) === '0,0,0' && test[0] < 0 && test[1] === 0 && test[2] === 0,
           arms: { control, test },
           detail: `[aimed foe atk, other foe atk, own atk] — after Tailwind ${control}; after Charm `
                 + `${test} (only the aimed body may move)` };
});

/* THE PROBE MUST NOT APPLY THE EFFECT ITSELF. The first version called applyStatus(foe,'brn') and
 * then asserted foe.status === 'brn' -- it tested applyStatus, not Will-O-Wisp, and would pass even
 * if the move did nothing. Same defect as the Encore probe: checking the classification instead of
 * the outcome. These run the turn and let the engine do it. */
/* ARMED, 2026-08-06. THREE ARMS, AND THE THIRD IS THE ONE THAT MATTERS. `inflictsBurn` is the
 * biggest unarmed tag in the corpus at 24,070 uses, and the one-armed version — "the target ends the
 * turn burned" — is true of an engine that burns on ANY status click, and true of one that burns on
 * any turn at all. Both are worse than doing nothing, and neither could be seen.
 *
 *   idle   the same board with NO click        -> the target must end clean
 *   test   the move                            -> the target must carry exactly `want`
 *   other  a DIFFERENT status move             -> the target must carry that move's OWN status
 *
 * The third arm is what separates "this move inflicts this status" from "a status move stamps one
 * status", and a one- or two-armed probe cannot. Garchomp is the target throughout so nothing in the
 * type chart varies between arms. */
const statusProbe = (tag, label, user, mv, want, other, otherWant) => probe('move', tag, label, () => {
  const run = (which) => {
    const me = bare(user), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, which ? M.playerAction(me, which, f1, S.field) : { kind: 'pass' }],
                        [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return f1.status || 'none';
  };
  const idle = run(null), test = run(mv), alt = run(other);
  return { works: idle === 'none' && test === want && alt === otherWant,
           arms: { control: [idle, alt], test: [test, alt] },
           detail: `target status — no click ${idle} (must be none); ${mv} ${test} (wanted ${want}); `
                 + `${other} ${alt} (wanted ${otherWant}, so the engine is not stamping ONE status on every status click)` };
});
statusProbe('inflictsBurn', 'Will-O-Wisp burns', 'incineroar', 'willowisp', 'brn', 'spore', 'slp');

statusProbe('inflictsParalysis', 'Thunder Wave paralyses', 'raichu', 'thunderwave', 'par', 'willowisp', 'brn');

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
  /* ARMED, 2026-08-06, AND THE FIFTH VERSION. v4 above still ran ONE arm — "the foe repeated the move
   * it committed" — which is exactly the shape that made the Disable probe a false LIVE for as long
   * as it existed: an engine reading `_vol.encore` NOWHERE also prints a repeat whenever the free
   * chooser happens to want the same move. The control is the identical three turns with the Encore
   * click replaced by a pass, and it must NOT repeat, or the test arm says nothing.
   *
   * ROCK SLIDE IS THE COMMITTED MOVE ON PURPOSE. It is the move this body does NOT pick when left
   * alone (the Disable probe records the same fact from the other side, where Earthquake IS the free
   * pick), so the two arms separate. Read from S.lastActs and not `_lastMove`, for the reason the
   * Disable probe records: `_lastMove` is not written by every action kind. */
  const run = (enc) => {
    const me = bare('whimsicott'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    /* Turn 1 -- the foe uses Rock Slide, so it HAS a last move. */
    M.battleTurn(S, rng5,
      new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'rockslide', me, S.field)], [f2, { kind: 'pass' }]]));
    const committed = f1._lastMove;
    /* Turn 2 -- Encore it, or spend the same turn doing nothing. */
    M.battleTurn(S, rng5,
      new Map([[me, enc ? M.playerAction(me, 'encore', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    const locked = !!(f1._vol && f1._vol.encore > 0);
    /* Turn 3 -- nothing forced on either side. What it picks is the measurement. */
    M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]), null);
    const rec = (S.lastActs || []).find(x => x.side === 'B');
    return { committed, locked, then: (rec && (rec.move || rec.kind)) || 'nothing' };
  };
  const free = run(false), enc = run(true);
  return { works: free.committed === 'rockslide' && !free.locked && free.then !== 'rockslide'
                  && enc.locked && enc.then === 'rockslide',
           arms: { control: free.then, test: enc.then },
           detail: `committed rockslide; left alone the foe then clicked ${free.then} (must differ, or `
                 + `the lock proves nothing); after Encore (volatile=${enc.locked}) it clicked ${enc.then}` };
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Every arm now spends a real turn; the three
 * comparisons and their reasons are unchanged, because the confounding above was the interesting
 * part and it was already fixed. What the turn adds is that a paralysed body has to actually GET ITS
 * MOVE OFF — full paralysis is a 25% roll in the loop and rng5 clears it — so this arm would go red
 * on an engine that priced Facade correctly and then never let a statused body attack. */
probe('move', 'conditionalPower', 'Facade doubles when statused, and ignores its own burn penalty', () => {
  const hit = (status, moveId) => turnDamageBig(['incineroar', 'corviknight', 'garchomp', 'milotic'],
    (B) => { B.me.status = status; }, moveId);
  const control = hit('', 'facade'), test = hit('par', 'facade');
  /* the control's control: a normal physical move must still LOSE damage to the same paralysis-free
     burn, or "Facade ignores burn" would pass on an engine that had simply dropped the burn rule. */
  const slamClean = hit('', 'bodyslam'), slamBurnt = hit('brn', 'bodyslam');
  const facadeBurnt = hit('brn', 'facade');
  return { works: test > control * 1.8 && slamBurnt < slamClean && facadeBurnt > control * 1.8,
           arms: { control, test },
           detail: `Facade clean ${control}, paralysed ${test}, burned ${facadeBurnt} (must NOT be halved); `
                 + `control Body Slam clean ${slamClean} -> burned ${slamBurnt} (must be halved)` };
});

/* ---- ABILITIES ---------------------------------------------------------------------------------- */

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THIS IS THE PROBE THE WHOLE PASS IS ABOUT.
 *
 * It used to be `M.applyIntimidate(foe)` — the handler called by hand, never through a switch-in. It
 * was LIVE, it is the most-used ability in the format (10,754 sheets), and on 2026-08-06 WIRE 123
 * found that every entry-drop handler in this engine was CORRECT and the ORDER they were called in
 * was not, so side B's lead owned the weather for every battle ever rolled out. This probe could not
 * have seen that, because it never went near the code that calls the handler.
 *
 * BOTH ROUTES, because they are different code. `battleInit` walks the leads (that is where WIRE 123
 * lived) and `bringIn` runs from inside a switch action; a fix to one has twice not been a fix to the
 * other in this file's history.
 *
 * THREE ARMS. The control is the SAME board with the ability off — Intimidate landing is only
 * evidence if a Garchomp that met no Intimidate is still at 0, which is also what an engine that
 * never fired any entry effect prints. */
probe('ability', 'onSwitchInDrop', 'Intimidate drops Attack', () => {
  const onEntry = (ab) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('milotic');
    me.ability = ab;
    M.battleInit([me, ally], [f1, f2], {});          // NOT seeded: the leads really arrive
    return [f1.boosts.at, f2.boosts.at];
  };
  const midBattle = (ab) => {
    const me = bare('corviknight'), ally = bare('milotic');
    const inc = bare('incineroar');                  // on the bench, switched in on the turn
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    inc.ability = ab;
    const S = M.battleInit([me, ally, inc], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: inc }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    return [f1.boosts.at, f2.boosts.at];
  };
  const control = onEntry('none'), test = onEntry('intimidate');
  const swControl = midBattle('none'), swTest = midBattle('intimidate');
  return { works: String(control) === '0,0' && String(test) === '-1,-1'
                  && String(swControl) === '0,0' && String(swTest) === '-1,-1',
           arms: { control, test },
           detail: `both foes' atk stage — LEADS: ability none ${control}, Intimidate ${test}; `
                 + `MID-BATTLE SWITCH: none ${swControl}, Intimidate ${swTest}` };
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
           arms: { control: off, test: on },
           detail: `Icicle Crash into the Reflect user: ability none ${off}, Prankster ${on} `
                 + `(the doubles screen is x0.667, so ${off} -> ${Math.floor(off * 2732 / 4096)} is the screen landing first)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Also tightened: `b.max !== a.max` passes on an
 * engine that made the move WEAKER, which a conversion-plus-boost never should. Real turn, and the
 * direction is asserted. */
probe('ability', 'damageBoost', 'Aerilate converts and boosts', () => {
  const hit = (ab) => turnDamage(['staraptor', 'incineroar', 'garchomp', 'garchomp'],
    (B) => { B.me.ability = ab; unfaintable(B.f1); }, 'bodyslam');
  const control = hit('none'), test = hit('aerilate');
  return { works: test > control && control > 0,
           arms: { control, test },
           detail: `Body Slam into Garchomp — ability none ${control}  ->  Aerilate ${test} `
                 + `(Normal becomes Flying, STAB, and x1.2)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). A SECOND MOVE IS THE CONTROL, not a second
 * body: Filter only cuts SUPER-EFFECTIVE damage, so Rock Slide into a Charizard (x4) must fall and
 * Earthquake into the same Charizard (x0 — it is Flying) is useless as a control. Aerial Ace, which
 * is neutral, is the one that has to NOT move. Without it "damage went down" is also what an engine
 * that gave every Charizard a blanket damage cut would print. */
probe('ability', 'damageReduce', 'Filter cuts super-effective damage and leaves neutral damage alone', () => {
  const hit = (ab, mvId) => turnDamageBig(['garchomp', 'incineroar', 'charizard', 'milotic'],
    (B) => { B.f1.ability = ab; }, mvId);
  const control = [hit('none', 'rockslide'), hit('none', 'aerialace')];
  const test = [hit('filter', 'rockslide'), hit('filter', 'aerialace')];
  return { works: test[0] < control[0] && control[0] > 0 && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `[Rock Slide (x4, super-effective), Aerial Ace (neutral)] — no ability ${control}, `
                 + `Filter ${test} (only the first may move)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). The PHYSICAL arm is the control and it is not
 * decoration: Ice Scales halves SPECIAL damage only, and an engine that halved everything the body
 * takes would pass a one-armed version of this exactly as well. */
probe('ability', 'damageReduce', 'Ice Scales halves special damage and not physical', () => {
  const hit = (ab, mvId) => turnDamageBig(['garchomp', 'incineroar', 'milotic', 'corviknight'],
    (B) => { B.f1.ability = ab; }, mvId);
  const control = [hit('none', 'earthpower'), hit('none', 'earthquake')];
  const test = [hit('icescales', 'earthpower'), hit('icescales', 'earthquake')];
  return { works: test[0] < control[0] && control[0] > 0 && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `[Earth Power (special), Earthquake (physical)] — no ability ${control}, `
                 + `Ice Scales ${test} (only the special one may move)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). ON THE CARVE-OUT LIST — a status immunity turns
 * a certainty into a failure whatever its usage — so it is armed regardless of where Insomnia ranks.
 *
 * The old body called `M.applyStatus(m,'slp')` and asked what stuck. That is the function, and the
 * function was never in doubt; what a click has to survive is the whole status path — bounceOff, the
 * refusal gates, the accuracy roll and the applier — and this engine has had a bug in that path
 * (WIRE 122: the Yawn branch was the tenth site and had no refusal check at all). Spore is used
 * because it cannot miss, so a miss cannot be mistaken for an immunity.
 *
 * THE SECOND ARM IS A SECOND STATUS, not a second body. Insomnia refuses sleep and NOTHING else, so a
 * Will-O-Wisp must still burn it — otherwise "the status did not stick" is also what a body that
 * refuses everything prints, which is a different and worse engine. */
probe('ability', 'statusImmune', 'Insomnia refuses sleep and takes a burn', () => {
  const run = (ab, moveId) => {
    const B = board('venusaur', 'corviknight', 'gholdengo', 'garchomp');
    B.f1.ability = ab;
    M.battleTurn(B.S, rng5,
      new Map([[B.me, M.playerAction(B.me, moveId, B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    return B.f1.status || 'none';
  };
  const control = [run('none', 'spore'), run('none', 'willowisp')];
  const test = [run('insomnia', 'spore'), run('insomnia', 'willowisp')];
  return { works: control[0] === 'slp' && test[0] === 'none'
                  && control[1] === 'brn' && test[1] === 'brn',
           arms: { control, test },
           detail: `[Spore, Will-O-Wisp] onto a Gholdengo — no ability ${control}, Insomnia ${test} `
                 + `(the burn must still land: Insomnia refuses SLEEP, not everything)` };
});

/* ONE-ARMED UNTIL 2026-08-04, AND FOUND BY THE IDENTICAL-ARMS SCAN AT THE BOTTOM OF THIS FILE. It read
 * `atk 0 -> 0` and called that a refusal — which is also what an engine with no Intimidate at all
 * prints. Exactly the shape that made the Disable probe a false LIVE. */
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). `applyIntimidate(m)` by hand proves the
 * REFUSAL lives in the handler; it cannot prove the handler is the one a switch-in reaches. The foe
 * really walks in with Intimidate now, and the ONE varied thing is the defender's ability. */
probe('ability', 'preventsStatDrop', 'Clear Body refuses Intimidate', () => {
  const run = (ab) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('milotic');
    me.ability = 'intimidate'; f1.ability = ab;
    M.battleInit([me, ally], [f1, f2], {});
    return [f1.boosts.at, f2.boosts.at];             // f2 has no ability and must ALWAYS drop
  };
  const control = run('none'), test = run('clearbody');
  return { works: control[0] === -1 && test[0] === 0 && control[1] === -1 && test[1] === -1,
           arms: { control, test },
           detail: `atk stage after a real Intimidate switch-in — holder: none ${control[0]}, `
                 + `Clear Body ${test[0]} (must be 0); its PARTNER, no ability either way: `
                 + `${control[1]} / ${test[1]} (must both be -1, or the Intimidate never fired)` };
});

/* ROADMAP #81 WIRE 3 — THE SCOPE OF THE REFUSAL, WHICH THE PROBE ABOVE CANNOT SEE.
 *
 * `Clear Body refuses Intimidate` is green on an engine that refuses EVERY drop from EVERY ability
 * carrying the tag, which is what this engine did: `TAGS.has(...,'preventsStatDrop')` was read as a
 * boolean at both move-inflicted sites, so Inner Focus, Oblivious, Own Tempo and Scrappy — whose
 * handlers in data/abilities.ts open `if (effect.name === 'Intimidate' && boost.atk)` — refused a
 * Charm as well. Confirmed in the official engine before this was written: Charm into a Gallade with
 * Inner Focus is `|-unboost|p2b: Gallade|atk|2` there and was atk stage 0 here.
 *
 * THE TWO ARMS ARE THE SAME ABILITY AND A DIFFERENT SOURCE OF THE DROP, which is the only pair that
 * separates a scoped refusal from a blanket one. An engine reading the tag as a boolean returns
 * `[0, 0]`; an engine with no refusal at all returns `[-1, -2]`. Only the real rule reads `[0, -2]`. */
probe('ability', 'preventsStatDrop', 'Inner Focus refuses INTIMIDATE and nothing else — a Charm still lands', () => {
  const intimidated = () => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('gallade'), f2 = bare('milotic');
    me.ability = 'intimidate'; f1.ability = 'innerfocus';
    M.battleInit([me, ally], [f1, f2], {});
    return [f1.boosts.at, f2.boosts.at];
  };
  const charmed = () => {
    const B = board('milotic', 'corviknight', 'gallade', 'milotic');
    B.f1.ability = 'innerfocus';
    M.battleTurn(B.S, rng5,
      new Map([[B.me, M.playerAction(B.me, 'charm', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    return B.f1.boosts.at;
  };
  const control = charmed(), test = intimidated()[0];
  return { works: control === -2 && test === 0 && intimidated()[1] === -1,
           arms: { control, test },
           detail: `one Gallade, one Inner Focus, two sources of an Attack drop — Charm ${control} `
                 + `(must be -2, the official engine lands it) vs Intimidate ${test} (must be 0); `
                 + `the no-ability partner takes ${intimidated()[1]} from the same Intimidate` };
});

/* ROADMAP #81 WIRE 3, THE OTHER HALF — THE REFUSAL IS AN ANNOUNCEMENT AND THE ENGINE MADE NONE.
 *
 * This is a claim about the PROTOCOL, not about the state, and it is why the two halves needed
 * measuring apart: the state above was already right for Clear Body and the whole-game differential
 * still parted on 81 first divergences mentioning `-fail`, because Showdown writes
 *   |-fail|p2a: Metagross|unboost|[from] ability: Clear Body|[of] p2a: Metagross
 * for a blanket refuser and names the stat for a scoped one, and medicham2 emitted nothing at all.
 * Both shapes are read off a live Champions battle, not off SIM-PROTOCOL.md.
 *
 * THE ARMS ARE THE EMITTED LINES, so an engine that blocks silently fails this and an engine that
 * announces a drop it did not refuse fails it too. */
probe('ability', 'preventsStatDrop', 'a refused stat drop is ANNOUNCED, naming the ability and (when scoped) the stat', () => {
  const lines = (ab1, ab2) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('metagross'), f2 = bare('gallade');
    me.ability = 'intimidate'; f1.ability = ab1; f2.ability = ab2;
    const trace = [];
    M.battleInit([me, ally], [f1, f2], { trace });
    return trace.filter(l => /^\|-(fail|unboost)\|/.test(l)).map(M.traceCanon);
  };
  const control = lines('none', 'none'), test = lines('clearbody', 'innerfocus');
  return { works: control.length === 2 && control.every(l => /^\|-unboost\|/.test(l))
                  && test.length === 2
                  && test[0] === '|-fail|p2a:metagross|unboost|[from]ability:clearbody|[of]p2a:metagross'
                  && test[1] === '|-fail|p2b:gallade|unboost|attack|[from]ability:innerfocus|[of]p2b:gallade',
           arms: { control, test },
           detail: `one Intimidate switch-in, canonised — no abilities: ${JSON.stringify(control)}; `
                 + `Clear Body + Inner Focus: ${JSON.stringify(test)} (the blanket refuser names no `
                 + `stat, the scoped one names Attack — Showdown's own two shapes)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). One arm, no control, and `atk stage 1` is also
 * what an engine that applied no drop and then a flat +1 would print. Now: a real Intimidate switch-
 * in, and the answer asked for is the NET stage, which is the number that decides the damage. */
probe('ability', 'boostsWhenLowered', 'Defiant raises Attack when dropped', () => {
  const run = (ab) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('kingambit'), f2 = bare('milotic');
    me.ability = 'intimidate'; f1.ability = ab;
    M.battleInit([me, ally], [f1, f2], {});
    return [f1.boosts.at, f2.boosts.at];
  };
  const control = run('none'), test = run('defiant');
  return { works: control[0] === -1 && test[0] === 1 && control[1] === -1 && test[1] === -1,
           arms: { control, test },
           detail: `Kingambit's atk stage after a real Intimidate switch-in: none ${control[0]}, `
                 + `Defiant ${test[0]} (-1 then +2 is net +1); its partner ${control[1]} / ${test[1]}` };
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
  /* ARMED, 2026-08-06, and the control is asserted at EXACTLY 0 rather than merely "less": an engine
   * that tolled every attacker would also satisfy `rough > none`. */
  return { works: rough > none && none === 0, arms: { control: none, test: rough },
           detail: `attacker lost ${none} vs none, ${rough} vs Rough Skin` };
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
  /* ARMS DECLARED, 2026-08-06. The control is not a second board — it is the SAME body's first
   * entry, which must NOT transform. Two equal arms here is a Palafin that upgrades on any entry,
   * which is the bug the comment above says this probe exists for. */
  return { works: firstStayedBase && returnUpgraded,
           arms: { control: firstEntry.atk, test: me.st.at },
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

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Same defect as the neverMisses probe above:
 * `moveAccuracy('aurasphere') >= 100` is what an engine with no accuracy system at all also prints.
 * Focus Blast is the honest control -- the same type, the same user, the same target, 70% against
 * Aura Sphere's guarantee, which is the exact trade the real game asks a Fighting special attacker to
 * make -- and it is run on a winning roll too so that "it missed" is distinguishable from "it does
 * nothing here". */
probe('move', 'neverMissesAttack', 'Aura Sphere cannot miss', () => {
  const shot = (mv, rng) => turnDamage(['alakazam', 'incineroar', 'garchomp', 'garchomp'], null, mv, rng);
  const capable = shot('focusblast', rng5);       // 0.50 beats 70
  const control = shot('focusblast', rngLose);    // 0.99 loses 70 — must be 0
  const test = shot('aurasphere', rngLose);       // must land anyway
  return { works: capable > 0 && control === 0 && test > 0,
           arms: { control, test },
           detail: `Focus Blast (70%) on a winning roll ${capable}, on a LOSING roll ${control} `
                 + `(must be 0); Aura Sphere on that same losing roll ${test} (must land)` };
});

probe('move', 'inflictsFreeze', 'Ice Beam can freeze', () => {
  /* A 10% secondary, so the roll is forced LOW. At rng 0.5 it would never fire and the probe would
   * report MISSING on a mechanic that works -- the same class of staging error as having the target
   * Protect on the turn it was meant to be Encored. */
  /* THE TARGET HAS TO SURVIVE THE HIT. The first version fired Ice Beam at Garchomp -- 4x on
   * Dragon/Ground -- which knocked it out, and a fainted Pokemon takes no status. The probe read
   * 'none' and blamed the engine. Corviknight resists Ice and lives. */
  /* ARMED, 2026-08-06. The control is Surf at the SAME forced-low roll: a damaging move with no
   * secondary at all. "The target is frozen after an Ice Beam at rng 0.01" is also what an engine
   * that fires a status secondary off every connecting hit prints, and that engine would freeze,
   * burn and paralyse its way through a game. */
  const run = (mv) => {
    const me = bare('milotic'), ally = bare('incineroar');
    const f1 = bare('corviknight'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, () => 0.01, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return f1.fainted ? 'FAINTED' : (f1.status || 'none');
  };
  const control = run('surf'), test = run('icebeam');
  return { works: control === 'none' && test === 'frz',
           arms: { control, test },
           detail: 'at the same forced roll 0.01 — Surf (no secondary) left the target ' + control
                 + ', Ice Beam left it ' + test };
});

/* ARMED, 2026-08-06. The control is the OTHER foe, which is never aimed at and must stay clean —
 * an engine that poisoned the whole opposing side would pass the one-armed version, and Toxic is a
 * single-target move. The idle arm rules out an engine that poisons on any turn. */
probe('move', 'inflictsPoison', 'Toxic poisons', () => {
  const run = (mv) => {
    const me = bare('milotic'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, mv ? M.playerAction(me, mv, f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [f1.status || 'none', f2.status || 'none'];
  };
  const control = run(null), test = run('toxic');
  return { works: String(control) === 'none,none' && /psn|tox/.test(test[0]) && test[1] === 'none',
           arms: { control, test },
           detail: `[aimed foe, other foe] — no click ${control}; after Toxic ${test} (the unaimed `
                 + `body must stay clean)` };
});

/* ARMED, 2026-08-06. Same two arms, and the second foe is again the control that separates "Confuse
 * Ray confuses its target" from "the engine confuses the opposing side". */
probe('move', 'inflictsConfusion', 'Confuse Ray confuses', () => {
  const run = (mv) => {
    const me = bare('milotic'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, mv ? M.playerAction(me, mv, f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [!!(f1._vol && f1._vol.confusion), !!(f2._vol && f2._vol.confusion)];
  };
  const control = run(null), test = run('confuseray');
  return { works: String(control) === 'false,false' && test[0] === true && test[1] === false,
           arms: { control, test },
           detail: `[aimed foe confused, other foe confused] — no click ${control}; after Confuse Ray ${test}` };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST: a refusal or a redirection
 * turns a certainty into a failure whatever its usage, so tests/test-medicham-coverage.js
 * requires it to carry a machine-checked control. Both arms were already computed here; what was
 * missing was declaring them, which is the difference between a control a reader can see and one
 * the harness can check. */
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
  const control = run(false), test = run(true);
  return { works: test < control && control > 0, arms: { control, test },
           detail: 'ally took ' + control + ' without  ->  ' + test + ' behind Wide Guard' };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE OLD STAGING VARIED EVERYTHING. It fired
 * at a WHIMSICOTT and then at an ARCHALUDON -- different Defence, different types, different weight --
 * and asked only whether the two numbers differed, which they would have on an engine that read no
 * weight at all. One species now, with `wt` overridden on the body, so weight is the only thing that
 * moves; and the DIRECTION is asserted, because heavier must mean stronger. */
probe('move', 'weightBased', 'Grass Knot scales with target weight', () => {
  const hit = (kg) => turnDamage(['venusaur', 'incineroar', 'garchomp', 'garchomp'],
    (B) => { B.f1.wt = kg; unfaintable(B.f1); }, 'grassknot');
  const control = hit(5), test = hit(400);
  return { works: test > control && control > 0,
           arms: { control, test },
           detail: `same Garchomp, only its weight moves -- 5 kg takes ${control}, 400 kg takes ${test}` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Two identical bodies but for the stat that
 * should matter; if Body Press reads Attack instead, the high-Defence one deals the SAME damage and
 * that equality is the null result. A THIRD ARM was added with the conversion: the same two bodies
 * clicking a move that reads Attack normally, which must NOT move -- otherwise "Defence changed the
 * damage" is also what an engine that mixed the two stats everywhere would print. */
probe('move', 'swapsStat', 'Body Press attacks with Defense', () => {
  const hit = (mult, mv) => turnDamage(['corviknight', 'incineroar', 'garchomp', 'garchomp'],
    (B) => { B.me.st = Object.assign({}, B.me.st, { df: B.me.st.df * mult }); unfaintable(B.f1); }, mv);
  const control = [hit(1, 'bodypress'), hit(1, 'ironhead')];
  const test = [hit(2, 'bodypress'), hit(2, 'ironhead')];
  return { works: test[0] > control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `Body Press: base Def ${control[0]} -> double Def ${test[0]}; Iron Head, which `
                 + `reads Attack: ${control[1]} -> ${test[1]} (must not move)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND A SECOND MOVE HAD TO COME WITH IT. The old
 * body asserted `a.max === b.max` — the +4 Defence changed nothing — which is exactly what an engine
 * that ignored stat stages for EVERY move also prints. That is the same defect the `ignoresBoosts`
 * Darkest Lariat probe was corrected for on 2026-08-06 and it was sitting here unfixed.
 * Close Combat is the control and it MUST fall against the same boost. */
probe('move', 'ignoresStatStages', 'Sacred Sword ignores a Defense boost and Close Combat does not', () => {
  const hit = (df, mvId) => turnDamageBig(['garchomp', 'incineroar', 'corviknight', 'milotic'],
    (B) => { B.f1.boosts.df = df; }, mvId);
  const control = [hit(0, 'sacredsword'), hit(0, 'closecombat')];
  const test = [hit(4, 'sacredsword'), hit(4, 'closecombat')];
  return { works: test[0] === control[0] && control[0] > 0 && test[1] < control[1],
           arms: { control, test },
           detail: `[Sacred Sword, Close Combat] into the same Corviknight — unboosted ${control}, `
                 + `+4 Def ${test} (Sacred Sword must not move, Close Combat must fall)` };
});

/* ARMED, 2026-08-06. The control is Crunch -- the same body, the same type, the same contact flag,
 * landing on the same target -- and it must leave the item alone. "The item field is empty after a
 * Knock Off" is also what an engine that strips an item on every connecting hit prints. The OTHER
 * foe is read as well, because a knock that emptied the whole side would pass both of those. */
probe('move', 'readsTargetItem', 'Knock Off removes the item', () => {
  const run = (mv) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    f1.item = 'lifeorb'; f2.item = 'lifeorb';
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [f1.item || '', f2.item || ''];
  };
  const control = run('crunch'), test = run('knockoff');
  return { works: String(control) === 'lifeorb,lifeorb' && test[0] === '' && test[1] === 'lifeorb',
           arms: { control, test },
           detail: '[aimed foe item, other foe item] -- after Crunch ' + JSON.stringify(control)
                 + '; after Knock Off ' + JSON.stringify(test) };
});

/* ARMED, 2026-08-06. Recover is the control -- a heal of the same size class, spent on the same turn,
 * that must reach the USER and NOT the partner. "The partner's HP went up" is also what an engine
 * that heals the whole side on every heal click prints, and that engine makes Recover strictly
 * better than it is. The FOE's HP is the third reading, so a field-wide heal fails too. */
probe('move', 'healsAlly', 'Life Dew heals the partner', () => {
  const run = (mv) => {
    const me = bare('milotic'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    me.curHP = Math.floor(me.st.hp / 2);
    ally.curHP = Math.floor(ally.st.hp / 2);
    f1.curHP = Math.floor(f1.st.hp / 2);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const b = [ally.curHP, me.curHP, f1.curHP];
    const fa = new Map([[me, M.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [ally.curHP - b[0], me.curHP - b[1], f1.curHP - b[2]];
  };
  const control = run('recover'), test = run('lifedew');
  return { works: control[0] === 0 && control[1] > 0 && control[2] === 0
                  && test[0] > 0 && test[1] > 0 && test[2] === 0,
           arms: { control, test },
           detail: '[partner gained, user gained, foe gained] -- after Recover ' + control
                 + ' (the partner must gain nothing); after Life Dew ' + test };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND GIVEN THE ARM ITS NAME DEMANDS: it is
 * SAME-TYPE damage, and the old probe only ever fired a Water move off a Water body. The control is
 * Crunch -- a Dark move this body gets no STAB on, so Adaptability must leave it exactly alone. */
probe('ability', 'stabBoost', 'Adaptability raises same-type damage', () => {
  const hit = (ab, mv) => turnDamage(['basculegion', 'incineroar', 'garchomp', 'garchomp'],
    (B) => { B.me.ability = ab; unfaintable(B.f1); }, mv);
  const control = [hit('none', 'wavecrash'), hit('none', 'crunch')];
  const test = [hit('adaptability', 'wavecrash'), hit('adaptability', 'crunch')];
  return { works: test[0] > control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `Wave Crash (STAB Water off a Water body): none ${control[0]} -> Adaptability `
                 + `${test[0]}; Crunch (not this body's type): ${control[1]} -> ${test[1]} (must not move)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Two effSpeed reads prove the multiplier; they
 * cannot prove the battle loop orders the turn by it. Same staging as the Choice Scarf probe — the
 * foe on 1 HP, so being faster is visible as damage NOT taken — and the sky is the only varied thing.
 * A third arm runs the sun WITHOUT the ability, because "it was faster in sun" is also what a body
 * with any other sun-speed ability, or a mis-scoped weather multiplier, would produce. */
probe('ability', 'speedCond', 'Chlorophyll doubles Speed in sun', () => {
  const run = (ab, weather) => {
    const { me, ally, f1, f2, S } = board('venusaur', 'incineroar', 'garchomp', 'garchomp');
    me.ability = ab; S.field.weather = weather;
    me.st = Object.assign({}, me.st, { sp: 90 });
    f1.st = Object.assign({}, f1.st, { sp: 130 });
    f1.curHP = 1;
    const before = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'gigadrain', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'dragonclaw', me, S.field)], [f2, { kind: 'pass' }]]));
    return [M.effSpeed(me, S.field, 'A'), before - me.curHP];
  };
  const control = run('chlorophyll', ''), test = run('chlorophyll', 'sun');
  const noAbility = run('none', 'sun');
  return { works: control[0] === 90 && test[0] === 180 && control[1] > 0 && test[1] === 0
                  && noAbility[1] > 0,
           arms: { control, test },
           detail: `[own Speed, damage taken from a 130-Speed foe on 1 HP] — Chlorophyll no sun `
                 + `${control}, Chlorophyll in sun ${test}; NO ability in sun ${noAbility} (must still `
                 + `be hit, or the sun itself is doing it)` };
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
  return { works: off < 0 && on === 0, arms: { control: off, test: on },
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
           arms: { control: [plain.d, plain.d], test: [veil.d, steel.d] },
           detail: `sand, Milotic: ability none -${plain.d} (a sixteenth is ${plain.sixteenth}), `
                 + `Sand Veil -${veil.d}; sand, Archaludon (Steel) -${steel.d}; snow, Milotic -${snow.d}` };
});

probe('ability', 'speedOnItemLoss', 'Unburden doubles Speed once the item is gone', () => {
  /* THROUGH battleInit, because that is where the engine stamps what each body STARTED holding --
   * the flag that distinguishes 'lost its item' from 'never had one'. The first version called
   * effSpeed on a loose body, so the flag was undefined and the probe reported the engine broken
   * while measuring its own shortcut. */
  /* ARMED, 2026-08-06. The control is the SAME body losing the SAME item with a different ability:
   * an engine that speeds anything up when its hand empties would pass the one-armed version, and
   * `speedOnItemLoss` over-matched on Sticky Hold once already (docs/ENGINE.md). */
  const run = (ab) => {
    const m = bare('weavile'); m.ability = ab; m.item = 'focussash';
    const ally = bare('incineroar'), f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([m, ally], [f1, f2], { seeded: true });
    const held = M.effSpeed(m, S.field, 'A');
    m.item = '';                                   // the Sash is spent
    return [held, M.effSpeed(m, S.field, 'A')];
  };
  const control = run('none'), test = run('unburden');
  return { works: control[1] === control[0] && test[1] > test[0] * 1.8,
           arms: { control, test },
           detail: '[speed holding, speed once the item is gone] — ability none ' + control
                 + ' (must not move); Unburden ' + test };
});

/* ARMED, 2026-08-06, AND THE CONTROL IS KNOCK OFF RATHER THAN A NO-OP. Both moves empty the target's
 * hand; only one of them puts the item in MINE. A control that did nothing at all would be satisfied
 * by an engine that treats every item-touching move as a knock -- which is the likelier bug, and the
 * one that costs a Life Orb's worth of damage on every Covet in the corpus. */
probe('move', 'takesTargetItem', 'Covet steals the item', () => {
  const run = (mv) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    f1.item = 'lifeorb'; me.item = '';
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const act = M.playerAction(me, mv, f1, S.field);
    if (!act || act.kind === 'pass') return ['RESOLVED-TO-' + (act && act.kind), ''];
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [me.item || '', f1.item || ''];
  };
  const control = run('knockoff'), test = run('covet');
  return { works: String(control) === ',' && String(test) === 'lifeorb,',
           arms: { control, test },
           detail: '[my item, target item] -- after Knock Off ' + JSON.stringify(control)
                 + ' (removed, not taken); after Covet ' + JSON.stringify(test) };
});


/* ---- BATCH 3 — the next by corpus usage -------------------------------------------------------
 *
 * Written while an R4 self-play run was in flight, which is why nothing here touches the engine:
 * a probe reads, it does not change, so the run keeps measuring the build it started on.
 */

/* ARMED, 2026-08-06, AND WITH THREE ARMS BECAUSE THE SKY HAS A NAME. Howl is the control — a status
 * click that spends the same turn and sets nothing — and Sunny Day is the third, because an engine
 * that stamped ONE weather on every weather move would pass both of the first two. */
probe('move', 'setsWeather', 'Sandstorm sets the weather', () => {
  const run = (mv) => {
    const me = bare('tyranitar'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    S.field.weather = '';
    const fa = new Map([[me, M.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return S.field.weather || 'none';
  };
  const control = run('howl'), test = run('sandstorm'), sun = run('sunnyday');
  return { works: control === 'none' && test === 'sand' && sun === 'sun',
           arms: { control, test },
           detail: 'weather after the turn — Howl ' + control + '; Sandstorm ' + test + '; Sunny Day '
                 + sun + ' (the third arm is what separates the move from "any weather click")' };
});

/* ARMED, 2026-08-06. Will-O-Wisp is the control: the same body, the same target, another status
 * move that must produce a DIFFERENT status. "The target is asleep" is also what an engine that
 * stamps one status on every status click prints, and the unaimed second foe rules out an engine
 * that puts the whole opposing side under. */
probe('move', 'inflictsSleep', 'Spore puts the target to sleep', () => {
  const mv = MC.moves['spore'] ? 'spore' : 'sleeppowder';
  const run = (click) => {
    const me = bare('venusaur'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const fa = new Map([[me, M.playerAction(me, click, f1, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, rng5, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [f1.status || 'none', f2.status || 'none'];
  };
  const control = run('willowisp'), test = run(mv);
  return { works: String(control) === 'brn,none' && String(test) === 'slp,none',
           arms: { control, test },
           detail: '[aimed foe, other foe] — Will-O-Wisp ' + control + '; ' + mv + ' ' + test };
});

probe('move', 'forbidsStatusMoves', 'Taunt stops the target using a status move', () => {
  /* Staged like the Encore probe: the target is Taunted, then left FREE, and what it picks is the
   * measurement. Checking only that the volatile was recorded would pass on a Taunt nothing reads. */
  /* ARMED, 2026-08-06. THE CONTROL MUST PICK A STATUS MOVE, or "it clicked an attack" is the
   * chooser's own ordering rather than the Taunt — the identical correction the Disable probe next
   * door already carries, and the reason that one was a false LIVE for as long as it existed. */
  const run = (taunt) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('whimsicott'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5,
      new Map([[me, taunt ? M.playerAction(me, 'taunt', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    const tainted = !!(f1._vol && f1._vol.taunt);
    /* THE FOE IS LEFT FREE BY OMITTING IT FROM A PARTIAL MAP, not by handing side B a null. A null
     * map is what the FIRST version of this arm used and `S.lastActs` then carried no side-B record
     * at all, so the control read "nothing" and the probe reported a working Taunt as MISSING —
     * the probe wrong before the engine, again. The Disable probe next door already stages it this
     * way and that is where the correct form came from. */
    M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f2, { kind: 'pass' }]]));
    /* THE STATUS CLICK DOES NOT ALWAYS CARRY A MOVE NAME, and that is what made the first version of
     * this arm read "nothing". chooseAction emits Tailwind as `{kind:'tail'}` with `move:null` —
     * every non-attack KIND in this engine is a status click, which is exactly the set Taunt
     * forbids. So the reading is the kind, and only an `attack` kind is looked up in MC.moves. */
    const rec = (S.lastActs || []).find(x => x.side === 'B');
    const kind = (rec && rec.kind) || 'nothing';
    const picked = (rec && rec.move) || kind;
    const isStatus = kind !== 'nothing' && (kind !== 'attack'
      || !!(rec.move && MC.moves[rec.move] && !MC.moves[rec.move].bp));
    return { tainted, picked, isStatus };
  };
  const free = run(false), taunted = run(true);
  return { works: !free.tainted && free.isStatus && taunted.tainted && !taunted.isStatus,
           arms: { control: free.picked, test: taunted.picked },
           detail: 'left alone the foe freely clicked ' + (free.picked || 'nothing') + ' (status='
                 + free.isStatus + ', and it MUST be, or the Taunt proves nothing); after Taunt it clicked '
                 + (taunted.picked || 'nothing') + ' (status=' + taunted.isStatus + ')' };
});

/* WIRE 119 -- THE TWO PROBES THE ONE ABOVE COULD NOT BE. The probe above checks that a Taunted body's
 * free pick is not a status move, with NO CONTROL showing that an untaunted one would have picked
 * one -- so it passed for as long as Taunt did nothing at all, which is the whole of this engine's
 * history until 2026-08-06. Showdown answers Taunt in TWO handlers and each needs its own probe:
 * `onBeforeMove` (a move already chosen FAILS when it runs) and `onDisableMove` (the move cannot be
 * chosen next turn). Every expected value below was played at the pinned Showdown commit first. */
probe('move', 'forbidsStatusMoves', 'Taunt FAILS a status move the target had already chosen (execution time)', () => {
  /* Alakazam (181) resolves before Incineroar (80), so the Taunt Incineroar had ALREADY chosen must
   * fail and Alakazam must not end the turn Taunted. Reference, gen9championsvgc2026regmb at
   * 20ad99ff: foe Taunts -> foe NOT taunted; foe attacks instead -> foe taunted. The outcome is read
   * off the FOE's volatile, not off a classification. */
  const run = (foeMove) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('alakazam'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'taunt', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, foeMove, me, S.field)], [f2, { kind: 'pass' }]]));
    return !!(f1._vol && f1._vol.taunt > 0);
  };
  const control = run('expandingforce'), test = run('taunt');
  return { works: control === true && test === false,
           detail: 'foe attacked -> foe ends up Taunted ' + control
                 + ';  foe Taunted first -> foe ends up Taunted ' + test,
           arms: { control, test } };
});

probe('move', 'forbidsStatusMoves', 'Taunt takes every status move off the menu (selection time)', () => {
  /* Reference, same commit: the turn after a Taunt lands, the target's request marks every
   * Status-category move `disabled: true` and leaves its attacks alone. Measured here as an OUTCOME
   * over the CHOOSER -- 40 independent seeded draws, the same stream in both arms, counting how many
   * of them clicked a status move. Milotic is the body because its priors actually reach Protect,
   * Hypnosis and Coil; a body that never clicks a status move would make both arms 0 and the probe
   * would pass on a dead engine, which is the defect the probe above has. */
  const TAGS = require(D('engine', 'tags.js'));
  const KINDMV = { protect: 'protect', wideguard: 'wideguard', tail: 'tailwind' };
  const run = (taunted) => {
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const me = bare('milotic'), ally = bare('corviknight');
      const f1 = bare('garchomp'), f2 = bare('weavile');
      const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
      if (taunted) (me._vol = me._vol || {}).taunt = 3;
      /* mulberry32, the generator engine/chomp_ev.js settled on: every step goes through Math.imul
       * and >>>, so the state stays inside 32-bit integer range. The textbook LCG this replaced
       * overflows float53 in JavaScript and cycles after ~16k draws — tests/test-prng.js forbids the
       * constant outright and caught the first version of this probe using it. */
      let s = 1000 + i * 7919;
      const rng = () => { s = (s + 0x6D2B79F5) | 0; let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      M.battleTurn(S, rng, null, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      const act = (S.lastActs || []).find(x => x.side === 'A' && x.name === me.name);
      const id = act && (act.move || KINDMV[act.kind]);
      if (id && TAGS.has('move', id, 'statusCategory')) n++;
    }
    return n;
  };
  const control = run(false), test = run(true);
  return { works: control > 0 && test === 0,
           detail: 'status clicks in 40 draws: untaunted ' + control + ', Taunted ' + test,
           arms: { control, test } };
});

/* WIRE 122 -- Good as Gold (2,461 sheets) refuses every foe-aimed status move, and the Yawn branch
 * was the one route in this engine that never asked, so Gholdengo took a drowse it is immune to.
 * Reference at 20ad99ff, both arms on the SAME Gholdengo so the body is not the variable:
 * Good as Gold -> `vol=[]`, a Honey Gather control -> `vol=[yawn]`. */
probe('ability', 'refusesStatusMoves', 'Good as Gold refuses Yawn', () => {
  const run = (ab) => {
    const me = bare('milotic'), ally = bare('corviknight');
    const f1 = bare('gholdengo'), f2 = bare('weavile');
    f1.ability = ab;
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'yawn', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return f1._yawn != null;
  };
  /* The control must TAKE the drowse, or "Gholdengo was not drowsed" is satisfied by an engine in
   * which Yawn does nothing at all. */
  const control = run('none'), test = run('goodasgold');
  return { works: control === true && test === false,
           detail: 'drowsed? plain ability ' + control + ', Good as Gold ' + test,
           arms: { control, test } };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST: a refusal or a redirection
 * turns a certainty into a failure whatever its usage, so tests/test-medicham-coverage.js
 * requires it to carry a machine-checked control. Both arms were already computed here; what was
 * missing was declaring them, which is the difference between a control a reader can see and one
 * the harness can check. */
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
  const control = run('bulletpunch'), test = run('feint');
  return { works: test > 0 && control === 0, arms: { control, test },
           detail: 'a normal move into Protect dealt ' + control + ', Feint dealt ' + test };
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

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE OLD STAGING WAS NOT THE MECHANIC.
 * It set `curHP = half` on one body and called that "already hit" -- which is a HP LEVEL, not an
 * event. Avalanche doubles when the user was DAMAGED BY THE TARGET THIS TURN, and the only way to
 * produce that is to let the target hit first: Avalanche is -4 priority, so a foe clicking in the
 * same turn always lands before it.
 *
 * STILL MISSING, AND FOR A REASON WORTH RECORDING RATHER THAN GUESSING AT. `needsTargetToAttack`
 * carries `{needs: "target attacking"}` for all nine of its members -- Avalanche, Assurance, Payback,
 * Counter, Mirror Coat, Metal Burst, Focus Punch, Upper Hand and Sucker Punch -- and those nine do
 * four completely different things with that condition (double the power, reflect the damage, fail
 * outright, go first). Sucker Punch's half IS wired, through the separate and much sharper
 * `failsIfTargetNotAttacking` tag. There is nothing in the artifact that distinguishes Avalanche's
 * doubling from Counter's reflection, so the fix is a TAG before it is any code. */
probe('move', 'needsTargetToAttack', 'Avalanche doubles after the target hits it this turn', () => {
  const run = (foeAttacks) => {
    const B = board('corviknight', 'incineroar', 'garchomp', 'milotic');
    unfaintable(B.f1); unfaintable(B.me);
    const before = B.f1.curHP;
    M.battleTurn(B.S, rng5,
      new Map([[B.me, M.playerAction(B.me, 'avalanche', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      new Map([[B.f1, foeAttacks ? M.playerAction(B.f1, 'dragonclaw', B.me, B.S.field) : { kind: 'pass' }],
               [B.f2, { kind: 'pass' }]]));
    return before - B.f1.curHP;
  };
  const control = run(false), test = run(true);
  return { works: test > control * 1.8 && control > 0,
           arms: { control, test },
           detail: `Avalanche (-4 priority, so it lands last): foe passed ${control}, foe clicked `
                 + `Dragon Claw into it first ${test} (must be about double)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE OLD STAGING VARIED TWO THINGS AT ONCE.
 * It compared an Archaludon against a WEAVILE — different Attack, different types, different
 * everything — so "the numbers differ" was guaranteed whether or not Gyro Ball read a speed at all.
 * One body now, one stat varied, through a real turn; and the DIRECTION is asserted, because Gyro
 * Ball gets WEAKER as its user gets faster and an engine that read the ratio upside down would pass
 * a not-equal test. */
probe('move', 'needsUntrackedState', 'Gyro Ball scales with the speed gap', () => {
  const hit = (spe) => turnDamage(['archaludon', 'incineroar', 'garchomp', 'garchomp'],
    (B) => { B.me.st = Object.assign({}, B.me.st, { sp: spe }); unfaintable(B.f1); }, 'gyroball');
  const control = hit(30), test = hit(150);
  return { works: control > test && test > 0,
           arms: { control, test },
           detail: `same Archaludon, only its Speed moves — 30 Spe deals ${control}, 150 Spe deals `
                 + `${test} (Gyro Ball must get WEAKER as the user gets faster)` };
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
           arms: { control: off, test: on },
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
           arms: { control: off.d, test: on.d },
           detail: `partner hp change: ability none ${off.d}, Hospitality ${on.d} (a quarter is ${on.quarter})` };
});

/* THE LAST TWO SOURCE-GREP PROBES IN THIS FILE, NOW BEHAVIOURAL. Both reported MISSING, so they were
 * honest negatives rather than hollow LIVEs — but a probe that passes on a STRING would have flipped
 * to LIVE the day somebody typed `unnerve` into a comment, and `weatherChipImmune` is exactly how that
 * ends. The hollow check at the bottom of this file now asserts there are none left. */
/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST: a refusal or a redirection
 * turns a certainty into a failure whatever its usage, so tests/test-medicham-coverage.js
 * requires it to carry a machine-checked control. Both arms were already computed here; what was
 * missing was declaring them, which is the difference between a control a reader can see and one
 * the harness can check. */
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
           arms: { control: off, test: on },
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
           arms: { control: off.then, test: on.then },
           detail: `foe hit with ${off.hit}; next free pick: ability none ${off.then}, `
                 + `Cursed Body ${on.then} (sealed=${JSON.stringify(on.sealed)})` };
});

probe('item', 'restoresStats', 'White Herb undoes a stat drop', () => {
  /* ARMED, 2026-08-06. The control is the empty hand: "the stage is back at 0 after a turn" is also
   * what an engine that forgot to PERSIST stat stages across a turn prints, and that engine reads as
   * a working White Herb on every body in the game. */
  const run = (item) => {
    const m = bare('garchomp'); m.item = item;
    const ally = bare('incineroar'), f1 = bare('incineroar'), f2 = bare('garchomp');
    const S = M.battleInit([m, ally], [f1, f2], { seeded: true });
    M.applyIntimidate(m);
    const dropped = m.boosts.at;
    M.battleTurn(S, rng5, new Map([[m, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return [dropped, m.boosts.at];
  };
  const control = run(''), test = run('whiteherb');
  return { works: control[0] < 0 && control[1] === control[0] && test[0] < 0 && test[1] === 0,
           arms: { control, test },
           detail: '[stage after Intimidate, stage after the turn] — no item ' + control
                 + ' (the drop must survive the turn); White Herb ' + test };
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
  /* ARMED, 2026-08-06. Shadow Ball is the control at the SAME forced-low roll: a special attack
   * with no status secondary at all. "Something landed at rng 0.01" is what an engine that fires a
   * status off every connecting hit prints, and that is a far worse engine than one with no Tri
   * Attack secondary. */
  const run = (click) => {
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    f1.status = ''; f1.curHP = f1.st.hp;
    const fa = new Map([[me, M.playerAction(me, click, f1, S.field)], [ally, { kind: 'pass' }]]);
    M.battleTurn(S, () => 0.01, fa, new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return f1.status || 'none';
  };
  const control = run('shadowball'), test = run('triattack');
  return { works: control === 'none' && /brn|frz|par/.test(test),
           arms: { control, test },
           detail: 'at the same forced roll 0.01 — Shadow Ball left the target ' + control
                 + ', Tri Attack left it ' + test };
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

/* `board` and `PASS2` used to be declared HERE, and were hoisted to the top of the file on
 * 2026-08-06 so that a probe written above this line can also spend a real turn. */

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3), AND THESE TEN WERE PICKED BY A NUMBER RATHER THAN BY
 * EYE. tests/test-medicham-coverage.js weights every tag by the corpus usage of the entities in
 * the 99% set that carry it, and these are the top of that list -- `statusInflict` 585,893,
 * `contact` 444,874, `priority` 359,331. Move coverage read 9.3% of USAGE armed against 260 of 277
 * moves LIVE, and the gap is entirely that the handful of tags the biggest moves carry were the
 * ones nobody had declared arms on. Every control below was already being computed. */
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
  const control = run('ironhead'), test = run('bulletpunch');
  return { works: control > 0 && test === 0, arms: { control, test },
           detail: 'slow user took ' + control + ' with a 0-priority move, ' + test + ' with Bullet Punch' };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3), AND THESE TEN WERE PICKED BY A NUMBER RATHER THAN BY
 * EYE. tests/test-medicham-coverage.js weights every tag by the corpus usage of the entities in
 * the 99% set that carry it, and these are the top of that list -- `statusInflict` 585,893,
 * `contact` 444,874, `priority` 359,331. Move coverage read 9.3% of USAGE armed against 260 of 277
 * moves LIVE, and the gap is entirely that the handful of tags the biggest moves carry were the
 * ones nobody had declared arms on. Every control below was already being computed. */
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
  const test = run('closecombat'), control = run('flamethrower');
  return { works: test > 0 && control === 0, arms: { control, test },
           detail: 'contact move cost the user ' + test + ', special non-contact cost ' + control };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3), AND THESE TEN WERE PICKED BY A NUMBER RATHER THAN BY
 * EYE. tests/test-medicham-coverage.js weights every tag by the corpus usage of the entities in
 * the 99% set that carry it, and these are the top of that list -- `statusInflict` 585,893,
 * `contact` 444,874, `priority` 359,331. Move coverage read 9.3% of USAGE armed against 260 of 277
 * moves LIVE, and the gap is entirely that the handful of tags the biggest moves carry were the
 * ones nobody had declared arms on. Every control below was already being computed. */
probe('move', 'spreadFoes', 'Rock Slide hits both foes and Stone Edge hits one', () => {
  /* THE CONTROL IS A SINGLE-TARGET MOVE OF THE SAME TYPE off the same body: the un-aimed foe must
   * take zero from it. Without that arm "both foes took damage" is also what an engine that made
   * every move a spread move prints, which is a much worse bug and reads as this one working. */
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('tyranitar', 'incineroar', 'garchomp', 'milotic');
    unfaintable(f1); unfaintable(f2);
    const b1 = f1.curHP, b2 = f2.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [b1 - f1.curHP, b2 - f2.curHP];
  };
  const control = run('stoneedge'), test = run('rockslide');
  return { works: test[0] > 0 && test[1] > 0 && control[0] > 0 && control[1] === 0,
           arms: { control, test },
           detail: '[aimed foe, the OTHER foe] — Stone Edge (single-target) ' + control
                 + ', Rock Slide (spread) ' + test };
});

/* ARMED, 2026-08-06. THE CONTROL IS A SPREAD MOVE THAT IS **NOT** spreadAll. Rock Slide hits both
 * FOES and must leave my own partner untouched; Earthquake hits everything on the field. A control
 * of "no click at all" would be satisfied by an engine that splashed every move onto the whole
 * field, which is the likelier bug and the more expensive one. */
probe('move', 'spreadAll', 'Earthquake hits your own partner too', () => {
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('garchomp', 'milotic', 'incineroar', 'incineroar');
    const b = [ally.curHP, f1.curHP, f2.curHP];
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [b[0] - ally.curHP, b[1] - f1.curHP, b[2] - f2.curHP];
  };
  const control = run('rockslide'), test = run('earthquake');
  return { works: control[0] === 0 && control[1] > 0 && control[2] > 0
                  && test[0] > 0 && test[1] > 0 && test[2] > 0,
           arms: { control, test },
           detail: `[own partner, foe 1, foe 2] — Rock Slide (spreadFoes) ${control} (my partner must `
                 + `take 0); Earthquake (spreadAll) ${test}` };
});

/* ROADMAP #81 WIRE 4 -- THE SPREAD MULTIPLIER IS x0.75 ROUNDED HALF UP ON 4096ths, NOT A TRUNCATION.
 *
 * `spreadFoes` above proves a spread move hits two foes. It says nothing about the NUMBER, and the
 * number was wrong on about half of all base-damage values: Showdown's `modifyDamage` spends the
 * multi-target modifier through `modify(baseDamage, 0.75)` (battle-actions.ts:1738), which is
 * `tr((tr(v * 3072) + 2047) / 4096)` -- a ROUND-HALF-UP. `Math.floor(base * 0.75)` truncates, so the
 * two agree only when `0.75 * base` lands on a quarter that does not round up, i.e. base % 4 === 0
 * or 3. Measured before the fix on 300 sampled real matchups: 226/300 exact with a spread move
 * against 293/300 with no modifier at all.
 *
 * THE EXACT NUMBERS CAME OUT OF THE AUTHORITY, with these two bodies, at these two rolls
 * (scratchpad/verify_staging.js, SHOWDOWN_PATH pinned):
 *
 *     garchomp(roughskin) Flamethrower -> kingambit(defiant)            58-70   single target
 *     garchomp(roughskin) Heat Wave    -> kingambit(defiant)  SPREAD    46-56   the naive float: 44-54
 *
 * so the seeded turn (rng 0.5 picks min + floor(span/2)) must read 64 and 51, and a truncating
 * engine reads 64 and 49. THE CONTROL IS IDENTICAL ON BOTH ENGINES BY CONSTRUCTION -- a single-target
 * Fire special move on the same board -- which is what makes the second arm the multiplier and
 * nothing else. The item is cleared on both arms because buildMon hands out a usage item and a
 * Life Orb underneath this would be a second modifier in the same chain. */
probe('move', 'spreadFoes', 'a spread move takes Showdown\'s x0.75 rounded half up, not a truncation', () => {
  const run = (mv) => turnDamageBig(['garchomp', 'milotic', 'kingambit', 'incineroar'],
    (B) => { B.me.item = ''; B.f1.item = ''; }, mv);
  const control = run('flamethrower'), test = run('heatwave');
  return { works: control === 64 && test === 51,
           arms: { control, test },
           detail: `Garchomp -> Kingambit, item cleared: single-target Flamethrower ${control} (must be 64, `
                 + `the authority's 58-70 at this roll — identical on a truncating engine), spread Heat Wave `
                 + `${test} (must be 51; the authority is 46-56, a truncating x0.75 gives 44-54 and reads 49)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). The two `moveAccuracy` reads proved the LOOKUP
 * returns 70 and 100; they could not prove the battle loop asks it, and the loop is where the roll
 * actually happens. Same board, same click, same losing roll — only the sky moves, and the outcome
 * read back is damage on the board rather than a number out of a table.
 *
 * Milotic is the target because it RESISTS Ice: a Garchomp is 4x weak and would faint, and a fainted
 * target saturates both arms at its own max HP, which is Lesson 5's "stage it against a body that can
 * show the effect" one field over. Snow raises the Defence of ICE types only, so it does not move
 * Milotic's side of the calculation. */
probe('move', 'weatherScaled', 'Blizzard cannot miss in snow', () => {
  const shot = (weather) => turnDamage(['alakazam', 'incineroar', 'milotic', 'garchomp'],
    (B) => { B.S.field.weather = weather; }, 'blizzard', rngLose);
  const control = shot('');        // 70% on a losing roll — must miss
  const test = shot('snow');       // the tag says 100 in snow — must land
  return { works: control === 0 && test > 0,
           arms: { control, test },
           detail: `Blizzard on a LOSING roll — clear sky ${control} (70%, must be 0), snow ${test} `
                 + `(the tag says 100, must land)` };
});

/* ARMED, 2026-08-06. The one-armed version — "the frozen target is no longer frozen" — is what an
 * engine that never freezes anything, or that clears every status on every hit, also prints. The
 * control is the SAME body on the SAME board taking a DARK move: Crunch is neither Fire nor tagged
 * thawsTarget, so the ice must still be there afterwards. Only the move varies. */
probe('move', 'thawsTarget', 'Flare Blitz thaws a frozen target', () => {
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    f1.status = 'frz';                                 // Garchomp resists Fire, so it survives to be looked at
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { status: f1.fainted ? 'FAINTED' : (f1.status || 'none'), dealt: before - f1.curHP };
  };
  /* AND A THIRD ARM, BECAUSE FLARE BLITZ DOES NOT TEST THE TAG. The engine thaws when the move's
   * effective type is FIRE **or** when it carries `thawsTarget`, and Flare Blitz satisfies the first
   * clause — so stripping the tag off it changes nothing, which is how the red demonstration for
   * this probe found out. Matcha Gotcha (5,352 uses) is GRASS and carries the tag, so it is the only
   * arm here that the artifact actually drives. */
  const control = run('crunch'), test = run('flareblitz'), tagged = run('matchagotcha');
  return { works: control.status === 'frz' && control.dealt > 0 && test.status === 'none' && test.dealt > 0
                  && tagged.status === 'none' && tagged.dealt > 0,
           arms: { control: control.status, test: tagged.status },
           detail: `a frozen Garchomp — Crunch (Dark, no thaw) dealt ${control.dealt} and left it `
                 + `${control.status}; Flare Blitz (Fire, thaws by TYPE) dealt ${test.dealt} and left it `
                 + `${test.status}; Matcha Gotcha (Grass, thaws by TAG) dealt ${tagged.dealt} and left `
                 + `it ${tagged.status}` };
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
  /* ARMS DECLARED, 2026-08-06. Both were already computed; what was missing was handing them to the
   * harness so the structural agreement check can see them. */
  return { works: none.dead && !sash.dead && sash.hp === 1,
           arms: { control: none, test: sash },
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
  return { works: berry > none, arms: { control: none, test: berry },
           detail: 'no item ended on ' + none + ' hp  ->  Sitrus ended on ' + berry };
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
  return { works: berry < none && none > 0, arms: { control: none, test: berry },
           detail: 'no item took ' + none + '  ->  Chople took ' + berry };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). The item is now read where the battle loop
 * reads it rather than only where dmgRange does -- which matters here more than most, because Life
 * Orb's other half (the recoil) IS in the loop, and the mutation sweep's top row is `damageMultAll /
 * lifeorb` precisely because the two halves are wired at different layers. */
probe('item', 'damageMultAll', 'Life Orb raises damage', () => {
  const hit = (item) => turnDamage(['incineroar', 'corviknight', 'garchomp', 'garchomp'],
    (B) => { B.me.item = item; unfaintable(B.f1); }, 'closecombat');
  const control = hit(''), test = hit('lifeorb');
  return { works: test > control && control > 0,
           arms: { control, test },
           detail: `Close Combat into Garchomp -- no item ${control}  ->  Life Orb ${test}` };
});

/* ROADMAP #81 WIRE 4 -- THE OTHER HALF OF THE SAME TAG, AND IT IS THE ARITHMETIC. The probe above
 * proves Life Orb raises damage. It cannot see WHETHER BY HOW MUCH, and "1.3" is not the number:
 * `data/items.ts` spells Life Orb `onModifyDamage ... this.chainModify([5324, 4096])`, which is
 * 1.29980469 rounded half up, and this engine spent `Math.floor(d * 1.3)`. Measured before the fix
 * on 300 sampled real matchups: 107/300 exact with a Life Orb against 293/300 with no modifier --
 * i.e. TWO THIRDS OF EVERY LIFE ORB DAMAGE IN THIS ENGINE WAS OFF BY ONE, in both directions.
 *
 * THE EXACT NUMBERS CAME OUT OF THE AUTHORITY, with these two bodies, at these two rolls
 * (scratchpad/verify_staging.js):
 *
 *     incineroar(intimidate) Close Combat -> garchomp(roughskin)             73-86
 *     the same click holding a Life Orb                                      95-112   the naive float: 94-111
 *
 * so the seeded turn must read 80 and 104, where the truncating engine reads 80 and 103. THE CONTROL
 * IS IDENTICAL ON BOTH ENGINES BY CONSTRUCTION, which is the whole point: an off-by-one is only
 * legible against an arm that does not move. */
probe('item', 'damageMultAll', 'Life Orb is 5324/4096 rounded half up, not a float 1.3', () => {
  const hit = (item) => turnDamageBig(['incineroar', 'corviknight', 'garchomp', 'garchomp'],
    (B) => { B.me.item = item; B.f1.item = ''; }, 'closecombat');
  const control = hit(''), test = hit('lifeorb');
  return { works: control === 80 && test === 104,
           arms: { control, test },
           detail: `Close Combat into Garchomp: no item ${control} (must be 80, the authority's 73-86 at `
                 + `this roll — identical on a truncating engine), Life Orb ${test} (must be 104; the `
                 + `authority is 95-112, a float x1.3 gives 94-111 and reads 103)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). THE SECOND ARM IS THE ONE THAT MATTERS. An
 * item that raised every move would pass a probe that only looked at Crunch, and would be a worse bug
 * than doing nothing. Four real turns now, same board, same target, only the item moves. */
probe('item', 'damageMultType', 'Black Glasses raises Dark damage only', () => {
  const hit = (item, mv) => turnDamage(['incineroar', 'corviknight', 'garchomp', 'garchomp'],
    (B) => { B.me.item = item; unfaintable(B.f1); }, mv);
  const control = [hit('', 'crunch'), hit('', 'closecombat')];
  const test = [hit('blackglasses', 'crunch'), hit('blackglasses', 'closecombat')];
  return { works: test[0] > control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `Dark ${control[0]}->${test[0]}, Fighting ${control[1]}->${test[1]} (must not move)` };
});

/* ARMED, 2026-08-06. The one-armed "the partner got faster after the click" is also true of an
 * engine that speeds a side up on any turn — and the FOE's speed is the second arm, because a
 * Tailwind that doubled everybody's Speed would pass the first one and be worth nothing. Both arms
 * spend the same turn; only the click varies. */
probe('move', 'doublesSideSpeed', 'Tailwind doubles the side Speed', () => {
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
    const b = [M.effSpeed(ally, S.field, 'A'), M.effSpeed(f1, S.field, 'B')];
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [M.effSpeed(ally, S.field, 'A') / b[0], M.effSpeed(f1, S.field, 'B') / b[1]];
  };
  const control = run('recover'), test = run('tailwind');
  return { works: String(control) === '1,1' && test[0] > 1.8 && test[1] === 1,
           arms: { control, test },
           detail: `[partner speed x, FOE speed x] after the turn — Recover ${control}; Tailwind `
                 + `${test} (the foe's side must not move)` };
});

/* WIRE 118 -- THE OTHER HALF OF THE SAME TAG. The probe above proves the multiplier is APPLIED; it
 * reads the speed AFTER the turn and cannot see when the boost starts counting. This asks whether the
 * partner overtakes INSIDE the turn the Tailwind was clicked, which is what modern VGC does and what
 * the engine did not: `acts` was sorted once and walked as a frozen list.
 *
 * THE EXPECTED ORDER CAME OUT OF THE OFFICIAL ENGINE at the pinned commit, both arms printed before a
 * line of engine changed (harness: scratchpad/ref-dynspeed2.js, and ref-dynspeed.js before it):
 *     control : Whimsicott -> Garchomp -> Milotic -> Incineroar
 *     tailwind: Whimsicott -> Incineroar -> Garchomp -> Milotic     Incineroar OVERTOOK, same turn
 *
 * MILOTIC IS THE OVERTAKEN BODY AND THE REFERENCE HARNESS WAS RESTAGED TO SAY SO. The dispatch's pair
 * was Garchomp/Incineroar at 0 EV (122 vs 80 -> 160). buildMon uses USAGE spreads and its Garchomp is
 * invested at 161, so Tailwind's 160 does NOT overtake it -- that staging would have printed identical
 * arms and read as agreement. Incineroar 80 and Milotic 101 are the two bodies whose MC lines are
 * exactly the reference's own 0-EV lines, so this is the same question at the same numbers in both
 * engines.
 *
 * THE OUTCOME, NOT THE ORDER LIST -- the same shape as the `priority` probe above. Milotic is left on
 * 1 HP, so whoever moves first decides whether Milotic ever acts: if Incineroar overtakes it, Milotic
 * faints before its Scald and the partner takes NOTHING. */
probe('move', 'doublesSideSpeed', 'Tailwind speeds the PARTNER up inside the same turn', () => {
  const run = (setTailwind) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'milotic', 'garchomp');
    f1.curHP = 1;                                   // so the KO decides whether it ever acts
    const before = ally.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, setTailwind ? M.playerAction(me, 'tailwind', null, S.field) : { kind: 'pass' }],
               [ally, M.playerAction(ally, 'knockoff', f1, S.field)]]),
      new Map([[f1, M.playerAction(f1, 'scald', ally, S.field)], [f2, { kind: 'pass' }]]));
    return before - ally.curHP;
  };
  const control = run(false), test = run(true);
  return { works: control > 0 && test === 0, arms: { control, test },
           detail: 'partner (Incineroar 80) took ' + control + ' from a Milotic (101) that outran it, '
                 + 'and ' + test + ' after the ally clicked Tailwind on the same turn' };
});

/* ROADMAP #81 WIRE 8 -- A SECOND TAILWIND DOES NOT REFRESH THE FIRST, AND THE PROOF IS THE SPEED
 * FOUR TURNS LATER.
 *
 * `Side.addSideCondition` (sim/side.ts:420) returns false when the condition is already present and
 * declares no `onSideRestart`; tailwind declares none, so Showdown writes `|-fail|` and the ORIGINAL
 * clock keeps running. This engine wrote a second `|-sidestart|` and reset the counter, which hands
 * a doubles side a permanent Tailwind for the price of one click a turn. 12,889 corpus uses.
 *
 * THE ASSERTION IS AN EQUALITY, AND AN EQUALITY ALONE CANNOT TELL A REFUSED RE-SET FROM A KNOB THAT
 * IS NOT WIRED. So the third arm clicks Tailwind on turn 2 AND NOWHERE ELSE: that click, allowed to
 * land, keeps the side fast into turn 5. The duplicate arm contains the very same turn-2 click and
 * must NOT get that extension. The measurement is shown able to see the extension before it is used
 * to claim there was none. */
probe('move', 'doublesSideSpeed', 'a second Tailwind does not extend the first', () => {
  /* Tailwind is set to 4 and ticks at every residual, so a turn-1 click leaves the side fast through
   * turn 4 and slow at the start of turn 5. Four turns are played and the speed is read after them. */
  const run = (clickOn) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
    const base = M.effSpeed(ally, S.field, 'A');
    for (let t = 1; t <= 4; t++) {
      M.battleTurn(S, rng5,
        new Map([[me, clickOn.includes(t) ? M.playerAction(me, 'tailwind', null, S.field) : { kind: 'pass' }],
                 [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    }
    return +(M.effSpeed(ally, S.field, 'A') / base).toFixed(2);
  };
  const once = run([1]), dup = run([1, 2]), lateOnly = run([2]), fresh = run([4]);
  return { works: once === 1 && dup === once && lateOnly > 1.8 && fresh > 1.8,
           arms: { control: lateOnly, test: dup },
           detail: 'partner speed x at the start of turn 5 — clicked on turn 1 only: ' + once
                 + ' (expired); clicked on turn 1 AND 2: ' + dup + ' (must equal ' + once
                 + ' — the re-set is refused); the SAME turn-2 click alone: ' + lateOnly
                 + ' (still fast, so the measurement can see an extension); a turn-4 click: ' + fresh };
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
           arms: { control: free.then, test: sealed.then },
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
/* ARMED, 2026-08-06. The control is Close Combat: the same body, the same type, the same contact
 * flag, damaging the same target — and NOT a drain. "The user's HP went up" is what an engine that
 * healed on every connecting hit also prints, and that engine is worse than one with no drain at
 * all. THE DAMAGE DEALT IS PRINTED TOO: a drain that healed nothing and a move that never landed
 * look identical from the user's HP alone, and only one of them is an engine gap. */
probe('move', 'drain', 'Drain Punch heals the user', () => {
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    me.curHP = Math.floor(me.st.hp / 2);
    unfaintable(f1);
    const before = me.curHP, foeBefore = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { gained: me.curHP - before, dealt: foeBefore - f1.curHP };
  };
  const control = run('closecombat'), test = run('drainpunch');
  return { works: control.dealt > 0 && control.gained === 0 && test.dealt > 0 && test.gained > 0,
           arms: { control: control.gained, test: test.gained },
           detail: `Close Combat dealt ${control.dealt} and returned ${control.gained} hp (must be 0); `
                 + `Drain Punch dealt ${test.dealt} and returned ${test.gained} hp` };
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
  /* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST -- redirection turns "I aimed
   * at that body" into a failure, and at 20,684 uses it is the largest member of the carve-out. */
  const control = run(false), test = run(true);
  return { works: control.aimed > 0 && test.guard > 0 && test.aimed === 0,
           arms: { control, test },
           detail: 'no Follow Me: aimed ' + control.aimed + ' / partner ' + control.guard
                 + '   |   Follow Me: aimed ' + test.aimed + ' / partner ' + test.guard };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST: a refusal or a redirection
 * turns a certainty into a failure whatever its usage, so tests/test-medicham-coverage.js
 * requires it to carry a machine-checked control. Both arms were already computed here; what was
 * missing was declaring them, which is the difference between a control a reader can see and one
 * the harness can check. */
probe('move', 'powder', 'Sleep Powder fails into a Grass type', () => {
  const run = (foeSp) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', foeSp, 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'sleeppowder', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  const control = run('garchomp'), test = run('venusaur');
  return { works: control === 'slp' && test !== 'slp', arms: { control, test },
           detail: 'into Garchomp: ' + control + ', into Venusaur (Grass): ' + test };
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
  return { works: on < off && on > 0, arms: { control: off, test: on },
           detail: 'took ' + off + ' with no screen  ->  ' + on + ' behind Reflect' };
});

/* ROADMAP #81 WIRE 8 -- A SECOND REFLECT DOES NOT EXTEND THE FIRST, AND THE PROOF IS THE DAMAGE ON
 * TURN SIX. Same rule as the Tailwind probe above (sim/side.ts:420) and the same three-arm shape,
 * for the same reason: the claim is an EQUALITY, so a third arm plays the identical turn-2 click on
 * its own and must show the extension the duplicate arm must not get.
 *
 * A REFRESHED SCREEN IS A DAMAGE BUG FOR THE REST OF THE GAME, which is why this reads HP and not a
 * counter. Reflect lasts five turns; a click on turn 2 that is wrongly allowed keeps it up through
 * turn 6, so turn 6 is where the two answers part. The body is restored to full before every turn so
 * only the LAST turn's loss is read and nothing can faint. */
probe('move', 'halvesDamage', 'a second Reflect does not extend the first', () => {
  const run = (clickOn) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    let took = 0;
    for (let t = 1; t <= 6; t++) {
      me.curHP = me.st.hp;
      const before = me.curHP;
      M.battleTurn(S, rng5,
        new Map([[me, clickOn.includes(t) ? M.playerAction(me, 'reflect', null, S.field) : { kind: 'pass' }],
                 [ally, { kind: 'pass' }]]),
        new Map([[f1, M.playerAction(f1, 'earthquake', me, S.field)], [f2, { kind: 'pass' }]]));
      took = before - me.curHP;
    }
    return took;
  };
  const once = run([1]), dup = run([1, 2]), lateOnly = run([2]);
  return { works: once > 0 && dup === once && lateOnly < once,
           arms: { control: lateOnly, test: dup },
           detail: 'turn-6 Earthquake — one Reflect on turn 1: ' + once + ' (expired); re-clicked on '
                 + 'turn 2: ' + dup + ' (must equal ' + once + ' — the re-set is refused); the SAME '
                 + 'turn-2 click alone: ' + lateOnly + ' (halved, so the measurement can see a screen '
                 + 'that really is up on turn 6)' };
});

/* ROADMAP #81 WIRE 8 -- THE REFUSAL IS PER CONDITION, NOT PER DAMAGE CATEGORY, AND THIS IS THE
 * OVER-MATCH GUARD.
 *
 * Showdown keeps Reflect, Light Screen and Aurora Veil as three independent side conditions, so an
 * Aurora Veil goes up perfectly happily on a side that already has a Reflect. The obvious way to
 * write the duplicate check — a flag per damage category, which is how this engine used to store
 * screens at all — would refuse it, and the failure would look exactly like the fix working. So the
 * claim here is the OPPOSITE sign: the second, different screen must LAND, and the evidence is that
 * the SPECIAL side of the damage starts being halved while the physical screen is untouched. */
probe('move', 'halvesDamage', 'Aurora Veil still goes up on a side that already has Reflect', () => {
  const run = (veil) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    S.field.weather = 'snow';                      // Aurora Veil fails without it
    let special = 0, physical = 0;
    for (let t = 1; t <= 3; t++) {
      me.curHP = me.st.hp;
      const before = me.curHP;
      const click = t === 1 ? 'reflect' : (t === 2 && veil ? 'auroraveil' : null);
      M.battleTurn(S, rng5,
        new Map([[me, click ? M.playerAction(me, click, null, S.field) : { kind: 'pass' }],
                 [ally, { kind: 'pass' }]]),
        new Map([[f1, M.playerAction(f1, t === 3 ? 'earthpower' : 'earthquake', me, S.field)],
                 [f2, { kind: 'pass' }]]));
      if (t === 3) special = before - me.curHP; else physical = before - me.curHP;
    }
    return { special, physical };
  };
  const control = run(false), test = run(true);
  return { works: control.special > 0 && test.special < control.special
                  && control.physical > 0 && test.physical === control.physical,
           arms: { control: control.special, test: test.special },
           detail: 'Reflect up since turn 1. Turn-3 SPECIAL hit: ' + control.special
                 + ' with no veil -> ' + test.special + ' after an Aurora Veil on turn 2 (it must LAND '
                 + '— a per-category refusal would have failed it). Physical unchanged at '
                 + control.physical + '/' + test.physical };
});

probe('ability', 'weatherSetter', 'Drizzle sets rain on entry', () => {
  const run = (ab) => {
    const me = bare('pelipper'), ally = bare('incineroar');
    me.ability = ab;
    const S = M.battleInit([me, ally], [bare('garchomp'), bare('garchomp')], {});   // NOT seeded: entry effects fire
    return S.field.weather || 'none';
  };
  /* NOT CONVERTED IN THE 2026-08-06 PASS, AND THAT IS A JUDGEMENT WITH A REASON RATHER THAN A SKIP.
   * The ranked direct-call list counts this probe because it spends no battleTurn, but the mechanic
   * IS an entry effect and `battleInit` with entry effects on is the real path it takes -- WIRE 123's
   * bug lived in that exact function and was caught by the probe below, which is the same route with
   * three arms. Spending a turn here would add nothing the entry already exercises. It is ARMED
   * instead, since it always computed a real control. */
  const control = run('none'), test = run('drizzle');
  return { works: control === 'none' && test === 'rain',
           arms: { control, test },
           detail: 'weather after the leads arrive: ability none -> ' + control + ', Drizzle -> ' + test };
});

/* WIRE 123 -- THE PROBE ABOVE ASKS WHETHER DRIZZLE SETS RAIN. IT CANNOT ASK WHOSE WEATHER WINS.
 *
 * Will, 2026-08-06: *"if two incins come out, which intim goes first indicates speed."* He is right
 * about the real game, and the mechanic underneath his observation is that Showdown resolves every
 * switch-in ability through ONE speed-sorted field event (`battle-actions.ts:184`,
 * `fieldEvent('SwitchIn', switchersIn)` -> `battle.ts:794`, `this.speedSort(handlers)`). So the LAST
 * entry weather setter to resolve owns the field, which means the SLOWER one wins it -- and the
 * whole battle's damage is then computed under the wrong sky if the order is wrong.
 *
 * MEASURED FIRST, in the official engine at the pinned commit, both arms printed before a line of
 * engine changed (scratchpad ref-entryorder2.js / ref-entryorder4.js). L50, Champions SP:
 *
 *     Pelipper 117 / Tyranitar  81   ->  SAND   (Tyranitar resolves last)
 *     Pelipper  85 / Tyranitar 113   ->  RAIN   (Pelipper  resolves last)
 *     Pelipper 117 / Tyranitar 113 / Torkoal 40 (Pelipper's ALLY)  ->  SUN
 *
 * THE THIRD ARM IS NOT DECORATION. The sort is GLOBAL across all four leads, not per side: a slow
 * ALLY resolves after the opposing lead. A per-side implementation ("side A, then side B") passes the
 * first two arms and fails this one, which is exactly the comfortable wrong answer to reach for.
 *
 * THE OUTCOME, NOT THE ORDER LIST. What is read back is the weather standing on the field after the
 * leads arrive, because that is the thing every later damage roll multiplies by. */
probe('ability', 'weatherSetter', 'the SLOWER entry weather setter owns the field, across both sides', () => {
  const run = (pelSpe, tyrSpe, allySp, allyAb, allySpe) => {
    const pel = bare('pelipper'), ally = bare(allySp);
    const tyr = bare('tyranitar'), f2 = bare('milotic');
    pel.ability = 'drizzle'; tyr.ability = 'sandstream';
    ally.ability = allyAb;   /* explicit on BOTH arms — bare() blanks it, nothing is left to default */
    f2.ability = 'none';
    pel.st.sp = pelSpe; tyr.st.sp = tyrSpe; ally.st.sp = allySpe; f2.st.sp = 100;
    const S = M.battleInit([pel, ally], [tyr, f2], {});   // NOT seeded: entry effects fire
    return S.field.weather || 'none';
  };
  /* the two-setter arms: only the SPEEDS differ, and the fourth body carries no entry ability */
  const pelFast = run(117, 81, 'corviknight', 'none', 100);
  const tyrFast = run(85, 113, 'corviknight', 'none', 100);
  /* the global-sort arm: a THIRD setter, slowest of all, and it is side A's ALLY */
  const allyLast = run(117, 113, 'torkoal', 'drought', 40);
  return { works: pelFast === 'sand' && tyrFast === 'rain' && allyLast === 'sun',
           arms: { control: pelFast, test: tyrFast },
           detail: `Pelipper 117 v Tyranitar 81 -> ${pelFast} (want sand); Pelipper 85 v Tyranitar 113 `
                 + `-> ${tyrFast} (want rain); + Torkoal 40 as A's ALLY -> ${allyLast} (want sun)` };
});

/* ARMED, 2026-08-06. The control is Snarl — another status click aimed at the same foe that drops
 * the same stat and does NOT pivot. "The bench body is on the field" is what an engine that swapped
 * on every status move would print too, and that engine loses a game a turn. */
probe('move', 'pivotStatus', 'Parting Shot switches the user out', () => {
  const run = (mv) => {
    const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('milotic');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return S.actA.map(x => x && x.name).join(',');
  };
  const control = run('charm'), test = run('partingshot');
  return { works: control === 'incineroar,corviknight' && test === 'milotic,corviknight',
           arms: { control, test },
           detail: `active side A after the turn — after Charm ${control} (the user must stay); `
                 + `after Parting Shot ${test}` };
});

/* WIRE 120 -- THE PROBE ABOVE ASKS WHETHER THE PIVOT FIRES; THIS ONE ASKS WHETHER IT FIRES AT THE
 * RIGHT MOMENT, which is the scope question this division keeps finding on the wrong side of. A
 * `kind:'switch'` action was given priority +6 whether or not it carried a MOVE, so Parting Shot --
 * 7,475 corpus clicks -- was the fastest action in the game and its user dodged every hit.
 * Reference, gen9championsvgc2026regmb at 20ad99ff: Milotic (101) Scalds an Incineroar (80) that
 * clicked Parting Shot; the Scald lands FIRST and the pivot USER takes it (54/170), identically to a
 * Knock Off control. The replacement takes nothing. */
probe('move', 'pivotStatus', 'Parting Shot does NOT jump the queue — the user eats the hit before it leaves', () => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const rep = bare('garchomp'), rep2 = bare('pangoro');
  const f1 = bare('milotic'), f2 = bare('weavile');
  const S = M.battleInit([me, ally, rep, rep2], [f1, f2], { seeded: true });
  const hp0 = me.curHP, rep0 = rep.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'partingshot', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'scald', me, S.field)], [f2, { kind: 'pass' }]]));
  const user = hp0 - me.curHP, replacement = rep0 - rep.curHP;
  /* The pivot MUST still have happened, or "the user took the hit" is satisfied by an engine in which
   * Parting Shot does not switch at all. */
  const pivoted = S.actA.indexOf(rep) >= 0 && S.actA.indexOf(me) < 0;
  return { works: pivoted && user > 0 && replacement === 0,
           detail: 'pivot user (80 spe) took ' + user + ', its replacement took ' + replacement
                 + ', pivoted=' + pivoted,
           arms: { control: replacement, test: user } };
});

/* ARMED, 2026-08-06. The control is Crunch: the same body dealing damage to the same target and
 * NOT leaving. "The bench body is on the field and the foe took damage" is what an engine that
 * pivoted on every attack also prints, and that engine cannot hold a position for a turn. */
probe('move', 'pivotDamaging', 'U-turn damages and then switches the user out', () => {
  const run = (mv) => {
    const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('milotic');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { dealt: before - f1.curHP, front: S.actA.map(x => x && x.name).join(',') };
  };
  const control = run('crunch'), test = run('uturn');
  return { works: control.dealt > 0 && control.front === 'incineroar,corviknight'
                  && test.dealt > 0 && test.front === 'milotic,corviknight',
           arms: { control: control.front, test: test.front },
           detail: 'Crunch dealt ' + control.dealt + ' and left ' + control.front + ' standing; U-turn dealt '
                 + test.dealt + ' and left ' + test.front };
});

/* WIRE 121 -- SCOPE AGAIN: the probe above asks whether U-turn pivots, not whether it pivots only
 * when it CONNECTED. Showdown fires `selfSwitch` only if `moveHit` did not fail, so a Volt Switch
 * into an Electric-immune ability leaves its user standing. Reference at 20ad99ff, all three arms:
 * Lightning Rod -> `p1 slot0 after = pikachu`, Volt Absorb -> `pikachu`, Marvel Scale control ->
 * `garchomp`. 1,459 x 2,108 by pair volume — the largest remaining row on the matrix. */
probe('move', 'pivotDamaging', 'Volt Switch does NOT pivot out of a Lightning Rod that absorbed it', () => {
  const run = (ab) => {
    const me = bare('pikachu'), ally = bare('corviknight');
    const rep = bare('garchomp'), rep2 = bare('incineroar');
    const f1 = bare('milotic'), f2 = bare('weavile');
    f1.ability = ab;
    const S = M.battleInit([me, ally, rep, rep2], [f1, f2], { seeded: true });
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'voltswitch', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    /* IDENTITY, NOT A NAME: buildMon's `name` casing is not this probe's business, and comparing to a
     * typed string is how the first version read false on a correct engine. */
    return { stayed: S.actA.indexOf(me) >= 0, slot0: S.actA[0] && S.actA[0].name };
  };
  /* The control MUST pivot, or "the user is still there" is satisfied by an engine in which Volt
   * Switch never switches at all. */
  const c = run('marvelscale'), t = run('lightningrod');
  return { works: c.stayed === false && t.stayed === true,
           detail: 'slot 0 after the turn — plain ability ' + c.slot0 + ', Lightning Rod ' + t.slot0,
           arms: { control: c.stayed, test: t.stayed } };
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
           arms: { control: off.took, test: on.took },
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
           arms: { control: bird[0], test: fly[0] },
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
  return { works: sun > 0 && dry === 0, arms: { control: dry, test: sun },
           detail: 'turn-1 damage: no sun ' + dry + ' (must be 0), sun ' + sun + ' (must be > 0)' };
});

/* ROADMAP #81 WIRE 8 -- THE WIND-UP HAPPENS EVEN WHEN THE TURN IS NOT SPENT, AND ELECTRO SHOT WAS
 * FIRING IN RAIN WITH NO SPECIAL ATTACK BOOST AT ALL.
 *
 * The probe above proves the charge is SKIPPED in the right weather. It cannot see that the skipped
 * charge still does everything the charge turn does, because Solar Beam's wind-up grants nothing.
 * Electro Shot's grants +1 Special Attack, and data/moves.ts:4640 puts the boost ABOVE the rain test:
 *
 *     this.add('-prepare', attacker, move.name);
 *     this.boost({ spa: 1 }, attacker, ...);
 *     if (['raindance','primordialsea'].includes(attacker.effectiveWeather())) { ...; return; }
 *
 * This engine had both lines inside the "we are charging" branch, so a rain Electro Shot skipped the
 * turn AND the boost. Staged against the official engine before a line was changed — Archaludon into
 * a Snorlax under Drizzle: Showdown 97, medicham2 65.
 *
 * THE CONTROL IS THE SAME BODY STARTED AT −1, so the +1 nets to zero. That is the only arm that can
 * separate "the boost was applied" from "130 base power is just large": an engine that skipped the
 * boost would print the two arms EQUAL. 2,579 corpus uses; Archaludon is the only carrier here. */
probe('move', 'chargeTurn', 'Electro Shot keeps its +1 Special Attack when rain skips the charge', () => {
  const run = (weather, pre) => {
    const { me, ally, f1, f2, S } = board('archaludon', 'incineroar', 'milotic', 'garchomp');
    unfaintable(f1);
    S.field.weather = weather;
    me.boosts.sa = pre;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'electroshot', f1, S.field)], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    return { dmg: before - f1.curHP, sa: me.boosts.sa };
  };
  const rain = run('rain', 0), flat = run('rain', -1), dry = run('', 0);
  return { works: rain.dmg > 0 && dry.dmg === 0 && rain.sa === 1 && dry.sa === 1
                  && flat.sa === 0 && rain.dmg > flat.dmg,
           arms: { control: flat.dmg, test: rain.dmg },
           detail: 'in rain the turn is NOT spent (' + rain.dmg + ' damage on turn 1) and Special '
                 + 'Attack is +' + rain.sa + '; the same click from −1 nets 0 and deals ' + flat.dmg
                 + ' (must be lower — equal arms would mean the boost is not applied); out of rain '
                 + 'it charges (' + dry.dmg + ' damage) and still takes +' + dry.sa };
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
  return { works: attacking > 0 && idle === 0, arms: { control: attacking, test: idle },
           detail: 'foe attacking: ' + attacking + ', foe idle: ' + idle + ' (must be 0)' };
});

probe('item', 'choiceLock', 'Choice Scarf locks the holder into its first move', () => {
  /* THIS IS NOT "NOBODY IMPLEMENTED CHOICE LOCK". tests/test-choice-lock.js asserts it four ways and
   * passes -- on board.js, where B.candidates() removes the other moves from the SEARCH's action set.
   * MEDICHAM's battleTurn honours whatever action it is handed, so the rule exists on one engine and
   * not the other. That is CLAUDE.md's FACTS ARE GLOBAL rule broken: whether a Choice item locks you
   * is a fact about the game, and two engines that disagree about it will keep disagreeing invisibly,
   * because each keeps working. The probe stays red until MEDICHAM enforces it too. */
  /* ARMED, 2026-08-06. THE CONTROL IS THE EMPTY HAND, and it is the arm that makes this probe mean
   * anything: "turn 2 used Crunch" is also what an engine that ignores the second action entirely
   * prints. Without the item the second click must be honoured. */
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('basculegion', 'incineroar', 'garchomp', 'garchomp');
    me.item = item;
    unfaintable(f1);
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'crunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    const first = me._lastMove;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [first, me._lastMove];
  };
  const control = run(''), test = run('choicescarf');
  return { works: String(control) === 'crunch,closecombat' && String(test) === 'crunch,crunch',
           arms: { control, test },
           detail: '[turn 1, turn 2 after asking for closecombat] — no item ' + control
                 + ' (the second click must be honoured); Choice Scarf ' + test };
});

/* ARMED, 2026-08-06. Tailwind is the control — another status click, the same turn spent, no heal.
 * The PARTNER's HP is the second reading, because a self-heal that healed the whole side would pass
 * a one-armed probe and is a different (and much better) move than Recover. */
probe('move', 'healsSelf', 'Recover restores the user', () => {
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'garchomp', 'garchomp');
    me.curHP = Math.floor(me.st.hp / 3);
    ally.curHP = Math.floor(ally.st.hp / 3);
    const b = [me.curHP, ally.curHP];
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [me.curHP - b[0], ally.curHP - b[1]];
  };
  const control = run('tailwind'), test = run('recover');
  return { works: String(control) === '0,0' && test[0] > 0 && test[1] === 0,
           arms: { control, test },
           detail: `[user hp gained, partner hp gained] — after Tailwind ${control}; after Recover `
                 + `${test} (the partner must gain nothing)` };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST: a refusal or a redirection
 * turns a certainty into a failure whatever its usage, so tests/test-medicham-coverage.js
 * requires it to carry a machine-checked control. Both arms were already computed here; what was
 * missing was declaring them, which is the difference between a control a reader can see and one
 * the harness can check. */
probe('ability', 'blocksMove', 'Armor Tail refuses a priority move', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'farigiraf', 'garchomp');
    f1.ability = ab;
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'bulletpunch', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const control = run('none'), test = run('armortail');
  return { works: control > 0 && test === 0, arms: { control, test },
           detail: 'no ability took ' + control + ', Armor Tail took ' + test };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE ROUTE IS THE POINT HERE. dmgRange
 * returning 0 and the battle loop refusing the hit are different claims: WIRE 20's own note records
 * that a nullification the loop applies while dmgRange reports raw damage is a real shape in this
 * engine (Disguise), and this probe was asking the half that cannot see it. Dragon Claw is the added
 * arm -- Levitate must not blunt anything that is not Ground. */
probe('ability', 'typeImmunity', 'Levitate takes nothing from Earthquake', () => {
  const hit = (ab, mv) => turnDamage(['garchomp', 'incineroar', 'hydreigon', 'milotic'],
    (B) => { B.f1.ability = ab; unfaintable(B.f1); }, mv);
  const control = [hit('none', 'earthquake'), hit('none', 'dragonclaw')];
  const test = [hit('levitate', 'earthquake'), hit('levitate', 'dragonclaw')];
  return { works: control[0] > 0 && test[0] === 0 && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `Earthquake: no ability ${control[0]} -> Levitate ${test[0]} (must be 0); `
                 + `Dragon Claw: ${control[1]} -> ${test[1]} (must not move)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). THE SHARPEST FORM OF THIS TEST, and the
 * conversion makes it sharper still: Normal does exactly ZERO to a Ghost, and a type immunity is
 * enforced in the battle loop as well as inside dmgRange, so a conversion that reached one and not
 * the other would read as working here and do nothing in a game. Turning a 0 into a number through a
 * real turn is what no partial implementation can fake. */
probe('ability', 'convertsMoveType', 'Aerilate makes Body Slam hit a Ghost', () => {
  const hit = (ab) => turnDamage(['staraptor', 'incineroar', 'gengar', 'garchomp'],
    (B) => { B.me.ability = ab; unfaintable(B.f1); }, 'bodyslam');
  const control = hit('none'), test = hit('aerilate');
  return { works: control === 0 && test > 0,
           arms: { control, test },
           detail: `Body Slam into a Ghost -- no ability ${control} (Normal cannot touch it)  ->  `
                 + `Aerilate ${test}` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). THE CONTROL IS STILL A COPY OF THE MOVE WITH
 * ITS ID CHANGED, so the tag lookup misses and the copy is a single 25-BP hit by construction -- an
 * identical result across that knob would mean multiHit is unwired, not that it does not matter
 * (Lesson 5). What changes is that both arms are now CLICKED: the action is assembled in exactly the
 * shape playerAction emits and resolved by battleTurn, so the hit count is priced on the path a
 * rollout takes.
 *
 * ONE SIDE EFFECT, STATED: the synthetic id is in no accuracy source, so the census run ticks
 * `fails.accuracyUnknown` once per arm. That counter reading non-zero after THIS file is expected and
 * is the counter working; what it must read over MC.moves is zero, and tests/test-engine-diff.js
 * asserts exactly that over all 500. */
probe('move', 'multiHit', 'Rock Blast lands more than one hit', () => {
  const run = (fake) => {
    const { me, ally, f1, f2, S } = board('tyranitar', 'incineroar', 'garchomp', 'garchomp');
    unfaintable(f1);
    const real = MC.moves['rockblast'];
    if (!real) return -1;
    const id = fake ? '__rockblast_onehit' : 'rockblast';
    const mv = fake ? Object.assign({}, real, { id }) : real;
    const act = { kind: 'attack', target: f1,
                  move: { id, mv, spread: false, d: M.dmgRange(me, f1, mv, S.field, false), acc: 1 } };
    const before = f1.curHP;
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const control = run(true), test = run(false);
  return { works: control > 0 && test > control * 1.5,
           arms: { control, test },
           detail: `one hit ${control}  ->  Rock Blast as the engine prices it ${test} `
                 + `(real average is about 3.2 hits)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE OLD ONE SAID SO IN ITS OWN COMMENT:
 * `S.sfA.fainted = 3;   // the input, not the effect`. It wrote the counter by hand and then asked
 * whether dmgRange read it — so it tested the FORMULA and left the whole question of whether
 * anything ever INCREMENTS that counter unasked. A move whose entire identity is "it grows as your
 * team dies" would have scored LIVE on an engine where nothing counted a death.
 *
 * The ally really faints now, killed by a real attack on a real turn, and the same Houndstone clicks
 * the same move into the same target in both arms. The counter is read back beside the damage, so
 * "the count moved but the damage did not" is distinguishable from "neither moved". */
probe('move', 'powerFromFallen', 'Last Respects grows with fallen allies', () => {
  const run = (killAlly) => {
    const me = bare('houndstone'), ally = bare('corviknight');
    const sp1 = bare('milotic'), sp2 = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('tyranitar');
    const S = M.battleInit([me, ally, sp1, sp2], [f1, f2], { seeded: true });
    unfaintable(f1);
    if (killAlly) ally.curHP = 1;                       // the ONLY varied thing
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, M.playerAction(f1, 'dragonclaw', ally, S.field)], [f2, { kind: 'pass' }]]));
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'lastrespects', f1, S.field)], [S.actA[1], { kind: 'pass' }]]),
      PASS2(f1, f2));
    return [S.sfA.fainted, before - f1.curHP];
  };
  const control = run(false), test = run(true);
  return { works: control[0] === 0 && test[0] === 1 && test[1] > control[1] && control[1] > 0,
           arms: { control, test },
           detail: `[fallen allies, Last Respects damage] — nobody died ${control}, one ally really `
                 + `fainted first ${test}` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). THE MOVE'S ENTIRE IDENTITY, and found by the
 * differential test rather than by anyone reading a list. Ice is normally RESISTED by Water;
 * Freeze-Dry is super effective on it. The added arm fires both moves at a NON-Water body, where the
 * override must not apply -- otherwise "Freeze-Dry hit harder" is also what a Freeze-Dry that is
 * simply stronger than Ice Beam everywhere would print.
 *
 * THE OFF-TYPE ARM WAS WRITTEN "MUST BE EQUAL" AND THAT WAS WRONG BEFORE THE ENGINE WAS. THIRTY-THREE.
 * Freeze-Dry is 70 BP and Ice Beam is 90, so off a Water target the correct answer is that Freeze-Dry
 * is LOWER, and asking for equality would have failed on a perfectly correct engine. The comfortable
 * shape here was "the control arm should be a null result"; the honest one is the direction the base
 * powers dictate, and it separates the two hypotheses just as well. */
probe('move', 'overridesEffectiveness', 'Freeze-Dry beats Ice Beam into a Water type', () => {
  const hit = (defSp, mv) => turnDamage(['weavile', 'incineroar', defSp, 'garchomp'],
    (B) => { unfaintable(B.f1); }, mv);
  const control = [hit('vaporeon', 'icebeam'), hit('incineroar', 'icebeam')];
  const test = [hit('vaporeon', 'freezedry'), hit('incineroar', 'freezedry')];
  return { works: test[0] > control[0] && test[1] < control[1] && control[1] > 0,
           arms: { control, test },
           detail: `into a WATER body -- Ice Beam ${control[0]}, Freeze-Dry ${test[0]} (must be HIGHER, `
                 + `the override); into a non-Water body -- Ice Beam ${control[1]}, Freeze-Dry `
                 + `${test[1]} (must be LOWER, 70 BP against 90 with no override)` };
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
  return { works: fg < none && fg > 0, arms: { control: none, test: fg },
           detail: 'took ' + none + ' with a plain partner  ->  ' + fg + ' with Friend Guard' };
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
  return { works: none === 'none' && /psn|tox/.test(pt), arms: { control: none, test: pt },
           detail: 'no ability -> ' + none + ', Poison Touch -> ' + pt };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). ON THE CARVE-OUT LIST: an immunity turns a
 * certainty into a failure whatever its usage, so it is armed regardless of where it ranks.
 *
 * A THIRD ARM CAME OUT OF WIRE 128 and is the point of converting this one: Bulletproof is
 * `isBreakable` in Showdown, so a MOLD BREAKER attacker goes straight through it. dmgRange knew
 * that (its inline copy of the check read the suppressed ability); moveClassBlocked(), which is what
 * the battle loop calls, did not — one fact with two implementations that had already drifted. The
 * third arm is what stops the fix being asserted rather than shown. */
probe('ability', 'immuneToMoveClass', 'Bulletproof refuses Rock Blast, and a Mold Breaker goes through it', () => {
  const run = (defAb, attAb) => {
    const B = board('tyranitar', 'corviknight', 'kommoo', 'garchomp');
    unfaintable(B.f1);
    B.f1.ability = defAb; B.me.ability = attAb;
    const before = B.f1.curHP;
    M.battleTurn(B.S, rng5,
      new Map([[B.me, M.playerAction(B.me, 'rockblast', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    return before - B.f1.curHP;
  };
  const control = run('none', 'none'), test = run('bulletproof', 'none');
  const broken = run('bulletproof', 'moldbreaker');
  return { works: control > 0 && test === 0 && broken > 0,
           arms: { control, test },
           detail: `HP the Kommo-o lost to Rock Blast — no ability ${control}, Bulletproof ${test}, `
                 + `Bulletproof against a Mold Breaker ${broken} (breakable, so it goes through)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Both moves are Fighting and both make contact,
 * so the ONLY thing separating them is the `punch` class — which is what makes the non-punch arm a
 * control rather than a second experiment. */
probe('ability', 'boostsMoveClass', 'Iron Fist raises a punch and nothing else', () => {
  const hit = (ab, mvId) => turnDamageBig(['incineroar', 'corviknight', 'garchomp', 'milotic'],
    (B) => { B.me.ability = ab; }, mvId);
  const control = [hit('none', 'drainpunch'), hit('none', 'closecombat')];
  const test = [hit('ironfist', 'drainpunch'), hit('ironfist', 'closecombat')];
  return { works: test[0] > control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `[Drain Punch (punch), Close Combat (not a punch)] — no ability ${control}, `
                 + `Iron Fist ${test} (only the punch may move)` };
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
  return { works: none === 0 && ng > 0, arms: { control: none, test: ng },
           detail: 'roll 0.9 vs 80% accuracy: no ability dealt ' + none + ', No Guard dealt ' + ng };
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
  return { works: none > 0 && sv === 0, arms: { control: none, test: sv },
           detail: 'roll 0.7 in sand: no ability took ' + none + ', Sand Veil took ' + sv };
});

/* ARMED, 2026-08-06, AND WITH A SECOND TURN, because "every turn" is the mechanic and one turn
 * cannot see it. The control is the same body with no ability, which must not move at all. */
probe('ability', 'boostsEachTurn', 'Speed Boost raises Speed every turn', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
    me.ability = ab;
    M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    const one = me.boosts.sp;
    M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    return [one, me.boosts.sp];
  };
  const control = run('none'), test = run('speedboost');
  return { works: String(control) === '0,0' && test[0] === 1 && test[1] === 2,
           arms: { control, test },
           detail: '[speed stage after turn 1, after turn 2] — no ability ' + control
                 + '; Speed Boost ' + test + ' (it must keep going, not fire once)' };
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
           arms: { control: off.d, test: on.d },
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
  return { works: none === 0 && j > 0, arms: { control: none, test: j },
           detail: 'no ability atk stage ' + none + ', Justified ' + j };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Fifty is the level and it must survive the
 * whole turn path -- the damage roll, the spread modifier, STAB, the type chart -- none of which apply
 * to a fixed-damage move and any one of which would show up as a number that is not 50. Close Combat
 * is the added arm on the same two bodies, so "both took 50" is separable from "this board flattens
 * every number". */
probe('move', 'fixedDamage', 'Seismic Toss deals the level, whoever it hits', () => {
  const hit = (defSp, mv) => turnDamage(['incineroar', 'milotic', defSp, 'garchomp'],
    (B) => { unfaintable(B.f1); }, mv);
  const control = [hit('alakazam', 'seismictoss'), hit('alakazam', 'closecombat')];
  const test = [hit('corviknight', 'seismictoss'), hit('corviknight', 'closecombat')];
  return { works: control[0] === 50 && test[0] === 50 && control[1] !== test[1],
           arms: { control, test },
           detail: `Seismic Toss vs frail ${control[0]} and vs bulky ${test[0]} (both must be 50); `
                 + `Close Combat vs the same two ${control[1]} and ${test[1]} (must differ)` };
});

/* ARMED, 2026-08-06, AND THE CLOCK IS READ AT BOTH ENDS. Howl is the control — the same four turns
 * spent, no song — and the target must still be standing; and the song's own arm is checked one turn
 * EARLY as well, because a Perish Song that killed immediately would pass "it is dead by turn four"
 * and be a completely different move. */
probe('move', 'perishClock', 'Perish Song faints the target three turns later', () => {
  const run = (mv, turns) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    for (let t = 0; t < turns; t++) M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    return !!f1.fainted;
  };
  const control = run('howl', 3), early = run('perishsong', 1), test = run('perishsong', 3);
  return { works: control === false && early === false && test === true,
           arms: { control, test },
           detail: 'fainted after four turns — Howl ' + control + '; Perish Song ' + test
                 + '; and after only two turns Perish Song ' + early + ' (must still be false)' };
});

probe('move', 'costsUserHP', 'Substitute costs the user a quarter', () => {
  /* The ACTION KIND is printed, because "the engine resolved this to a pass" and "the engine did the
   * move and forgot the cost" are different bugs with the same HP reading. */
  /* ARMED, 2026-08-06. Howl is the control: another self-targeting status click on the same turn
   * that must cost nothing. The cost is asserted at EXACTLY a quarter rather than "went down",
   * because an engine charging the wrong fraction is a live mechanic with a wrong number. */
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    const act = M.playerAction(me, mv, null, S.field);
    const before = me.curHP;
    M.battleTurn(S, rng5, new Map([[me, act], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { kind: act && act.kind, paid: before - me.curHP, quarter: Math.floor(me.st.hp / 4) };
  };
  const control = run('howl'), test = run('substitute');
  return { works: control.paid === 0 && test.paid === test.quarter,
           arms: { control: control.paid, test: test.paid },
           detail: 'Howl (kind ' + control.kind + ') cost ' + control.paid + '; Substitute (kind '
                 + test.kind + ') cost ' + test.paid + ' (a quarter is ' + test.quarter + ')' };
});

probe('move', 'delayedSleep', 'Yawn puts the target to sleep on the following turn', () => {
  const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'yawn', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  const immediate = f1.status || 'none';
  M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
  /* ARMS DECLARED, 2026-08-06. The control here is not a second board but the SAME board one turn
   * earlier: Yawn's whole content is that the sleep arrives LATE, so "clean now, asleep next turn"
   * is a genuine two-arm reading and an engine that slept the target immediately fails it. */
  return { works: immediate !== 'slp' && f1.status === 'slp',
           arms: { control: immediate, test: f1.status || 'none' },
           detail: 'same turn: ' + immediate + ' (must not be slp), next turn: ' + (f1.status || 'none') };
});

probe('move', 'partialTrap', 'Infestation chips at the end of each turn', () => {
  /* ARMED, 2026-08-06. Bug Bite is the control — the same attacker landing another Bug move on the
   * same target — and the idle turn after it must cost the target nothing. "It lost HP on an idle
   * turn" is also what an engine with a stray residual anywhere prints.
   *
   * THE HIT ITSELF IS PRINTED. "the trap chips nothing" and "the move never landed" are different
   * bugs and the target's HP after one idle turn cannot tell them apart on its own. */
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    const full = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    const afterHit = f1.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally), PASS2(f1, f2));
    return { hit: full - afterHit, chip: afterHit - f1.curHP };
  };
  const control = run('bugbite'), test = run('infestation');
  return { works: control.hit > 0 && control.chip === 0 && test.hit > 0 && test.chip > 0,
           arms: { control: control.chip, test: test.chip },
           detail: 'Bug Bite dealt ' + control.hit + ' then chipped ' + control.chip + ' on the idle turn '
                 + '(must be 0); Infestation dealt ' + test.hit + ' then chipped ' + test.chip };
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
  return { works: broken > behind && behind > 0, arms: { control: behind, test: broken },
           detail: 'screen up ' + behind + '  ->  after Brick Break ' + broken };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST: a refusal or a redirection
 * turns a certainty into a failure whatever its usage, so tests/test-medicham-coverage.js
 * requires it to carry a machine-checked control. Both arms were already computed here; what was
 * missing was declaring them, which is the difference between a control a reader can see and one
 * the harness can check. */
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
  const control = run(false), test = run(true);
  return { works: control > 0 && test === 0, arms: { control, test },
           detail: 'sound move dealt ' + control + ' normally, ' + test + ' after Throat Chop' };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND IT HAD NO CONTROL AT ALL: `a.max === b.max`
 * is exactly what an engine that ignores stat stages for EVERY move prints, which is a much worse bug
 * than this one. Crunch is the control -- same user, same type, same category -- and it must be cut by
 * the +4, or "Darkest Lariat ignored it" means nothing. */
probe('move', 'ignoresBoosts', 'Darkest Lariat ignores a Defense boost', () => {
  const hit = (df, mv) => turnDamage(['incineroar', 'milotic', 'corviknight', 'garchomp'],
    (B) => { B.f1.boosts.df = df; unfaintable(B.f1); }, mv);
  const control = [hit(0, 'darkestlariat'), hit(0, 'crunch')];
  const test = [hit(4, 'darkestlariat'), hit(4, 'crunch')];
  return { works: test[0] === control[0] && test[1] < control[1] && control[0] > 0,
           arms: { control, test },
           detail: `into a +4 Def Corviknight -- Darkest Lariat ${control[0]} -> ${test[0]} (equal = `
                 + `ignored); Crunch ${control[1]} -> ${test[1]} (must fall, or nothing reads boosts)` };
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
  return { works: snow < dry && snow > 0, arms: { control: dry, test: snow },
           detail: 'took ' + dry + ' after Aurora Veil in clear weather (must be unreduced), '
                 + snow + ' in snow' };
});

/* ARMED, 2026-08-06. PROTECT IS THE CONTROL AND IT IS THE ONLY HONEST ONE: it blocks the identical
 * move on the identical turn and must cost the attacker NOTHING. "The attacker lost HP behind a
 * shield" is also what an engine that tolled every blocked hit prints, and that engine would make
 * Protect — the single most-clicked move in this format — silently better than Spiky Shield.
 *
 * WHETHER THE BLOCK EVEN HAPPENED IS PART OF THE READING. A shield that never blocked and a shield
 * that blocked without punishing both leave the attacker on full HP, and only the second is the
 * mechanic this probe is named for. */
probe('move', 'punishesContact', 'Spiky Shield hurts the attacker it blocked', () => {
  const run = (shield) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    const before = f1.curHP, meBefore = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, shield, null, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'dragonclaw', me, S.field)], [f2, { kind: 'pass' }]]));
    return { blocked: (meBefore - me.curHP) === 0, toll: before - f1.curHP };
  };
  const control = run('protect'), test = run('spikyshield');
  return { works: control.blocked && control.toll === 0 && test.blocked && test.toll > 0,
           arms: { control: control.toll, test: test.toll },
           detail: 'Protect blocked=' + control.blocked + ' and tolled ' + control.toll + ' (must be 0); '
                 + 'Spiky Shield blocked=' + test.blocked + ' and tolled ' + test.toll };
});

/* ROADMAP #81 WIRE 1 -- A SHIELD AND A TYPE IMMUNITY ARE DIFFERENT STATES, AND THE SHIELD ANSWERS
 * FIRST. This is the consequence that does NOT live in the protocol line, so it is asserted on HP.
 *
 * Showdown's hit steps (sim/battle-actions.ts:553-576) run TryHit -- where Protect lives, at
 * `onTryHitPriority: 3` -- as step 1, and the type chart as step 2. medicham2 ran them the other way
 * round, so a contact move the target happened to be IMMUNE to was reported as a bare `|-immune|` and
 * the shield never bit. Measured in the authority, both dice pinned:
 *     Body Slam (Normal, contact) -> Gengar behind Spiky Shield
 *       |-activate|p2a: Gengar|move: Protect
 *       |-damage|p1a: Tauros|132/150|[from] Spiky Shield|[of] p2a: Gengar     <- 1/8, on a GHOST
 *     the same click with the shield down
 *       |-immune|p2a: Gengar                                                  <- and nothing else
 *
 * THE CONTROL IS THE SAME IMMUNE TARGET WITH NO SHIELD. "The attacker lost HP" is also what an engine
 * that tolls on any blocked-looking outcome prints, and the toll must be exactly the shield's 1/8. */
probe('move', 'punishesContact', 'a Spiky Shield answers before the type chart, so it tolls a move the body is immune to', () => {
  const run = (shield) => {
    const me = bare('tauros'), ally = bare('corviknight');
    const f1 = bare('gengar'), f2 = bare('garchomp');
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    unfaintable(f1);
    const meBefore = me.curHP, foeBefore = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'bodyslam', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, shield ? { kind: 'protect', mv: shield } : { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { toll: meBefore - me.curHP, dealt: foeBefore - f1.curHP, eighth: Math.floor(me.st.hp / 8),
             line: (trace.find(l => /^\|-(activate|immune|miss)\|/.test(l)) || '(none)') };
  };
  const control = run(null), test = run('spikyshield');
  return { works: control.dealt === 0 && control.toll === 0 && /-immune/.test(control.line)
                  && test.dealt === 0 && test.toll === test.eighth && /move: Protect/.test(test.line),
           arms: { control: control.toll, test: test.toll },
           detail: 'immune, no shield: line ' + control.line + ', attacker lost ' + control.toll
                 + ' (must be 0); immune, Spiky Shield up: line ' + test.line + ', attacker lost '
                 + test.toll + ' (must be ' + test.eighth + ')' };
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
           arms: { control: [nsArmor, cPlain], test: [nsPlain, cArmor] },
           detail: 'roll 0.1 (above 1/24, below 1/8): Night Slash plain ' + nsPlain + ' / Shell Armor '
                 + nsArmor + '   |   Crunch plain ' + cPlain + ' / Shell Armor ' + cArmor + ' (must be equal)' };
});

/* `preventsCrit` — 151 uses, never probed. Staged on an ALWAYS-crit move so the reading is exact and
 * deterministic rather than a rate: Flower Trick is +50% on every hit, Shell Armor takes it back to
 * the plain number, and a third arm (a move with no crit tag at all) shows the plain number is really
 * the un-crit one rather than a coincidence. Through dmgRange because that is where the CERTAIN half
 * of a crit lives (see WIRE 35). */
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE THIRD ARM HAD TO CHANGE SHAPE. The
 * direct version's control was a COPY of Flower Trick with the id rewritten, which cannot be clicked
 * through a real turn -- playerAction resolves an id against MC.moves, and putting a synthetic move
 * in that global table would make it visible to every probe after this one and would bump
 * MEDFAILS.accuracyUnknown, which is a counter this repo asserts at zero.
 *
 * SO THE CONTROL IS A SECOND REAL MOVE: Knock Off, same attacker, same target, no crit tag. At rng
 * 0.99 -- above every crit rate in the game -- Knock Off cannot crit either way, so Shell Armor must
 * leave it exactly where it was. Without that arm, "the damage fell" is also what a Shell Armor that
 * cut all incoming damage would print. */
probe('ability', 'preventsCrit', 'Shell Armor takes the guaranteed crit off Flower Trick and leaves an ordinary move alone', () => {
  const hit = (ab, mvId) => turnDamageBig(['meowscarada', 'corviknight', 'garchomp', 'milotic'],
    (B) => { B.f1.ability = ab; }, mvId, rngLose);
  const control = [hit('none', 'flowertrick'), hit('none', 'knockoff')];
  const test = [hit('shellarmor', 'flowertrick'), hit('shellarmor', 'knockoff')];
  return { works: test[0] < control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `[Flower Trick (always crits), Knock Off (cannot crit at rng 0.99)] — no ability `
                 + `${control}, Shell Armor ${test} (only the certain crit may move)` };
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

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). FOUR REAL TURNS, and the arms are unchanged
 * because they were already the right ones: BOTH VOCABULARIES for the terrain, and the WRONG terrain
 * as a third, since a wire that multiplied under ANY terrain would pass a two-armed probe and be
 * wrong on every Electric Terrain board. What the conversion adds is that the terrain is now read off
 * the field the battle loop is running on rather than a literal handed straight to the formula. */
probe('move', 'terrainScaled', 'Expanding Force gains power on Psychic Terrain', () => {
  const hit = (t) => turnDamage(['alakazam', 'incineroar', 'garchomp', 'garchomp'],
    (B) => { B.S.field.terrain = t; unfaintable(B.f1); }, 'expandingforce');
  const control = hit(''), test = hit('psychic');
  const boardWord = hit('psychicterrain'), wrong = hit('electric');
  return { works: test > control && boardWord === test && wrong === control && control > 0,
           arms: { control, test },
           detail: `Expanding Force dealt: no terrain ${control}, 'psychic' ${test}, `
                 + `'psychicterrain' ${boardWord} (the board's own word), 'electric' ${wrong} `
                 + `(must equal no terrain)` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Two identical targets but for their Attack; if
 * Foul Play reads the USER's Attack the two are equal, and that equality is the null result.
 * Confirmed against Showdown independently: spiritomb foulplay -> pelipper reads 28-34 there and
 * 51-61 here. The added third arm is Crunch, the same type and category off the same user, which must
 * NOT care what the target's Attack is. */
probe('move', 'swapsStat', 'Foul Play attacks with the TARGET Attack', () => {
  const hit = (mult, mv) => turnDamage(['spiritomb', 'incineroar', 'pelipper', 'garchomp'],
    (B) => { B.f1.st = Object.assign({}, B.f1.st, { at: B.f1.st.at * mult }); unfaintable(B.f1); }, mv);
  const control = [hit(1, 'foulplay'), hit(1, 'crunch')];
  const test = [hit(3, 'foulplay'), hit(3, 'crunch')];
  return { works: test[0] > control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `Foul Play: target at base Attack ${control[0]} -> at triple Attack ${test[0]}; `
                 + `Crunch, same user and type: ${control[1]} -> ${test[1]} (must not move)` };
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
           arms: { control: none, test: dis },
           detail: 'no ability took ' + none + ', Disguise took ' + dis + ' (must be exactly maxhp/8 = ' + eighth + ')' };
});

probe('ability', 'untagged', 'Marvel Scale raises Defense while statused', () => {
  /* `untagged` is a BUCKET, not a mechanic -- 45 abilities carry it, worth 2,129 clicks between
   * them. Probed here under that name because that is what the artifact says, with the mechanic
   * named in the label so the census row is readable. Marvel Scale is on the differential's hand
   * list; the tag walk found it has no tag at all to be wired from. */
  /* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE STATUS BECAME THE KNOB. The direct
   * version burned BOTH bodies and varied only the ability, which cannot tell "raises Defence while
   * statused" from "raises Defence always". Same ability on both arms now; only the burn moves. */
  const hit = (ab, status) => turnDamageBig(['garchomp', 'incineroar', 'milotic', 'corviknight'],
    (B) => { B.f1.ability = ab; B.f1.status = status; }, 'earthquake');
  /* THE ARMS ARE THE ABILITY AT A FIXED STATUS, NOT THE STATUS AT A FIXED ABILITY, and the first cut
   * of this had it the other way round -- which read `clean 92 -> burned 147` and looked like the
   * ability making the body SOFTER. It was the end-of-turn BURN CHIP, which lands inside the same
   * HP-loss reading. Both burned arms carry the identical chip on the identical body, so comparing
   * them cancels it; comparing a burned arm against a clean one does not. Arm 34. */
  const control = [hit('none', ''), hit('marvelscale', '')];
  const test = [hit('none', 'brn'), hit('marvelscale', 'brn')];
  return { works: control[0] === control[1] && control[0] > 0 && test[1] < test[0],
           arms: { control, test },
           detail: `Earthquake into a Milotic, [no ability, Marvel Scale] — clean ${control} (must be `
                 + `equal: the ability does nothing on a healthy body), burned ${test} (the Marvel `
                 + `Scale one must take less; both readings carry the same burn chip)` };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3), AND THESE TEN WERE PICKED BY A NUMBER RATHER THAN BY
 * EYE. tests/test-medicham-coverage.js weights every tag by the corpus usage of the entities in
 * the 99% set that carry it, and these are the top of that list -- `statusInflict` 585,893,
 * `contact` 444,874, `priority` 359,331. Move coverage read 9.3% of USAGE armed against 260 of 277
 * moves LIVE, and the gap is entirely that the handful of tags the biggest moves carry were the
 * ones nobody had declared arms on. Every control below was already being computed. */
probe('move', 'secondaryStatEffect', 'Moonblast drops the target Special Attack on its roll and not otherwise', () => {
  /* THE ROLL IS THE KNOB, and the second arm is what makes it one. Moonblast's drop is a 30% chance;
   * at rng 0.99 it must NOT fire, and an engine that applied every secondary unconditionally would
   * pass a one-armed version of this while being wrong on every 10% and 20% secondary in the game. */
  const run = (rngIn) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'corviknight', 'garchomp');
    unfaintable(f1);
    M.battleTurn(S, rngIn,
      new Map([[me, M.playerAction(me, 'moonblast', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.boosts.sa;
  };
  const test = run(() => 0.01), control = run(rngLose);
  return { works: test < 0 && control === 0, arms: { control, test },
           detail: 'target spa stage — roll forced low ' + test + ', roll forced high ' + control
                 + ' (a 30% secondary must not fire at 0.99)' };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3), AND THESE TEN WERE PICKED BY A NUMBER RATHER THAN BY
 * EYE. tests/test-medicham-coverage.js weights every tag by the corpus usage of the entities in
 * the 99% set that carry it, and these are the top of that list -- `statusInflict` 585,893,
 * `contact` 444,874, `priority` 359,331. Move coverage read 9.3% of USAGE armed against 260 of 277
 * moves LIVE, and the gap is entirely that the handful of tags the biggest moves carry were the
 * ones nobody had declared arms on. Every control below was already being computed. */
probe('move', 'statusInflict', 'Scald burns as a secondary of a damaging move, and Surf does not', () => {
  /* TWO CONTROLS, because "the target is burned" has two boring explanations. Surf is the same type
   * off the same body with no secondary at all and must leave it clean; and Scald on a LOSING roll
   * must also leave it clean, or the engine is applying secondaries unconditionally. */
  const run = (mv, rngIn) => {
    const { me, ally, f1, f2, S } = board('milotic', 'incineroar', 'corviknight', 'garchomp');
    unfaintable(f1); unfaintable(f2);
    M.battleTurn(S, rngIn,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.status || 'none';
  };
  const test = run('scald', () => 0.01);
  const control = run('surf', () => 0.01);
  const highRoll = run('scald', rngLose);
  return { works: test === 'brn' && control === 'none' && highRoll === 'none',
           arms: { control, test },
           detail: 'Scald on a low roll -> ' + test + '; Surf on the same roll -> ' + control
                 + '; Scald on a high roll -> ' + highRoll };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Life Orb is deliberately the control item
 * rather than "some item": it raises the held arm by 1.3x, so a working Acrobatics has to beat a
 * BOOSTED number to pass, and an implementation that merely noticed the item slot was empty and did
 * nothing with it fails. The click is now a real turn, so the item is read where the battle loop
 * reads it and not only where dmgRange does. */
probe('move', 'variablePower', 'Acrobatics doubles with no item held', () => {
  const hit = (item) => turnDamage(['staraptor', 'incineroar', 'garchomp', 'garchomp'],
    (B) => { B.me.item = item; unfaintable(B.f1); }, 'acrobatics');
  const control = hit('lifeorb'), test = hit('');
  return { works: test > control,
           arms: { control, test },
           detail: `holding a Life Orb (which is itself worth 1.3x) ${control}  ->  empty-handed ${test}` };
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

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Psyshock is a SPECIAL move that hits the
 * PHYSICAL side, so raising Defence must lower the damage; if the engine reads Special Defence the
 * two are equal and that equality is the null result. Psychic is the added control -- the same user,
 * type and category -- and it must be UNMOVED by the same Defence change. */
probe('move', 'statSwap', 'Psyshock is scored against the target Defense', () => {
  const hit = (mult, mv) => turnDamage(['alakazam', 'incineroar', 'milotic', 'garchomp'],
    (B) => { B.f1.st = Object.assign({}, B.f1.st, { df: B.f1.st.df * mult }); unfaintable(B.f1); }, mv);
  const control = [hit(1, 'psyshock'), hit(1, 'psychic')];
  const test = [hit(3, 'psyshock'), hit(3, 'psychic')];
  return { works: test[0] < control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `target Defence tripled -- Psyshock ${control[0]} -> ${test[0]} (must fall); `
                 + `Psychic, which reads Sp. Def: ${control[1]} -> ${test[1]} (must not move)` };
});

probe('move', 'removesItem', 'a knocked-off Life Orb stops boosting the target damage', () => {
  /* NOT "is the item field blank" -- that is already probed under readsTargetItem, and a blank field
   * nothing reads is worth nothing. This asks the CONSEQUENCE: after the item is gone, does the
   * damage the victim deals actually fall back to the no-item number. */
  /* ARMED, 2026-08-06. Crunch is the control: the same turn, the same damage on the same body, and
   * no knock. "The number fell after the turn" is also what an engine that re-priced the victim for
   * any other reason -- a stat drop, a burn, a screen -- would print. */
  const run = (mv) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    f1.item = 'lifeorb';
    const withOrb = M.dmgRange(f1, me, MC.moves['earthquake'], S.field, false).max;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { before: withOrb, after: M.dmgRange(f1, me, MC.moves['earthquake'], S.field, false).max,
             item: f1.item || '' };
  };
  const control = run('crunch'), test = run('knockoff');
  return { works: control.item === 'lifeorb' && control.after === control.before
                  && test.item === '' && test.after < test.before,
           arms: { control: control.after, test: test.after },
           detail: 'what the victim then deals -- after Crunch ' + control.before + ' -> ' + control.after
                 + ' (item kept); after Knock Off ' + test.before + ' -> ' + test.after + ' (item gone)' };
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
  return { works: clay < none && none > 0, arms: { control: none, test: clay },
           detail: 'turn 7 damage: no item ' + none + '  ->  Light Clay ' + clay };
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
  return { works: none === 'par' && gold !== 'par', arms: { control: none, test: gold },
           detail: 'no ability -> ' + none + ', Good as Gold -> ' + gold };
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
  /* ARMS DECLARED, 2026-08-06. The first tick against the last one: ordinary poison is a FLAT
   * sixteenth, so two equal arms here is exactly the engine this probe exists to catch. */
  return { works: chips[chips.length - 1] > chips[0] && chips[0] > 0,
           arms: { control: chips[0], test: chips[chips.length - 1] },
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
           arms: { control: grounded.took, test: airborne.took },
           detail: 'flier speed ' + grounded.mine + ' vs attacker ' + grounded.theirs
                 + '; on the ground took ' + grounded.took + ', on the Fly charge turn took ' + airborne.took };
});

/* ---- BATCH 6 — the rest of the walk, plus the authorised fix list ------------------------------- */

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). The Fighting arm is the control: an ability
 * that cut everything would pass a Fire-only version. */
probe('ability', 'halvesTypeDamage', 'Thick Fat halves Fire and Ice and nothing else', () => {
  const hit = (ab, mvId) => turnDamageBig(['incineroar', 'corviknight', 'milotic', 'garchomp'],
    (B) => { B.f1.ability = ab; }, mvId);
  const control = [hit('none', 'flamethrower'), hit('none', 'closecombat')];
  const test = [hit('thickfat', 'flamethrower'), hit('thickfat', 'closecombat')];
  return { works: test[0] < control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `[Flamethrower (Fire), Close Combat (Fighting)] — no ability ${control}, `
                 + `Thick Fat ${test} (only the Fire may move)` };
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
  /* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). A SECOND MOVE came with the conversion: Dry
   * Skin raises FIRE damage and absorbs Water, and it must leave an Electric move where it was --
   * without that arm, "the number went up" is what a blanket fragility would print too. */
  const hit = (ab, mvId) => turnDamageBig(['incineroar', 'corviknight', 'heliolisk', 'garchomp'],
    (B) => { B.f1.ability = ab; }, mvId);
  const control = [hit('none', 'flamethrower'), hit('none', 'bodyslam')];
  const test = [hit('dryskin', 'flamethrower'), hit('dryskin', 'bodyslam')];
  return { works: test[0] > control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `[Flamethrower (Fire, must rise about 1.25x), Body Slam (Normal, must not move)] `
                 + `— no ability ${control}, Dry Skin ${test}` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND IT FOUND WIRE 128. THE OLD PROBE ASKED
 * dmgRange, WHICH WAS THE HALF THAT WAS ALREADY RIGHT.
 *
 * Measured before a line of engine changed: `dmgRange` priced this Earthquake at 60 and a real turn
 * dealt 0, because the battle loop's absorb gate read `tg.ability` raw while dmgRange had honoured
 * the Mold Breaker suppression since WIRE 37. Two implementations of one fact, disagreeing.
 *
 * BOTH HALVES ARE ASSERTED NOW — the FORMULA and the TURN — because a probe that only asks the turn
 * would go green again on an engine that broke dmgRange in the same direction. Levitate is the
 * sharpest available target: a hard zero becomes a number and no partial implementation can fake it. */
probe('ability', 'ignoresDefenderAbility', 'Mold Breaker ignores Levitate, in the calc AND in the turn', () => {
  const run = (ab) => {
    const B = board('tinkaton', 'corviknight', 'hydreigon', 'garchomp');
    unfaintable(B.f1);
    B.f1.ability = 'levitate'; B.me.ability = ab;
    const before = B.f1.curHP;
    const priced = M.dmgRange(B.me, B.f1, MC.moves['earthquake'], B.S.field, false).max;
    M.battleTurn(B.S, rng5,
      new Map([[B.me, M.playerAction(B.me, 'earthquake', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    return [priced, before - B.f1.curHP];
  };
  const control = run('none'), test = run('moldbreaker');
  return { works: control[0] === 0 && control[1] === 0 && test[0] > 0 && test[1] > 0,
           arms: { control, test },
           detail: `[dmgRange max, HP the Levitate body actually lost] — no ability ${control}, `
                 + `Mold Breaker ${test}` };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND IT FOUND THE OTHER HALF OF WIRE 128.
 * dmgRange said 88 and a real turn dealt 0: the loop's stage-5 immunity gate was a bare
 * `mcEff(effMoveType(...), tg.types)` and knew nothing about Scrappy. Both halves asserted. */
probe('ability', 'ignoresTypeImmunity', 'Scrappy lets Normal hit a Ghost, in the calc AND in the turn', () => {
  const run = (ab) => {
    const B = board('incineroar', 'corviknight', 'gengar', 'garchomp');
    unfaintable(B.f1);
    B.me.ability = ab;
    const before = B.f1.curHP;
    const priced = M.dmgRange(B.me, B.f1, MC.moves['bodyslam'], B.S.field, false).max;
    M.battleTurn(B.S, rng5,
      new Map([[B.me, M.playerAction(B.me, 'bodyslam', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    return [priced, before - B.f1.curHP];
  };
  const control = run('none'), test = run('scrappy');
  return { works: control[0] === 0 && control[1] === 0 && test[0] > 0 && test[1] > 0,
           arms: { control, test },
           detail: `[dmgRange max, HP the Ghost actually lost] — no ability ${control}, `
                 + `Scrappy ${test}` };
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
  return { works: none > 0 && rh === 0, arms: { control: none, test: rh },
           detail: 'no ability lost ' + none + ' to recoil, Rock Head lost ' + rh };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). The synthetic-copy control is gone for the
 * reason written on the preventsCrit probe above -- it cannot be CLICKED. What replaces it is the
 * SECOND HALF OF THE SAME FACT: at a roll where nothing else can crit, Flower Trick must still be
 * carrying a crit, and the only way to see one in a battle state is to take it away. Shell Armor is
 * the instrument; a body with NO Grass resistance would have done just as well and this one is
 * cheaper. The Knock Off arm is what separates "the crit went away" from "the body took less".
 *
 * IT SHARES ITS STAGING WITH THE preventsCrit PROBE AND THAT IS STATED RATHER THAN HIDDEN: the two
 * assert opposite attributions of one interaction, so stripping EITHER tag turns both red. That is
 * correct -- both facts really are required for the pair to differ -- and it is not the same thing as
 * one probe counted twice, because the assertions are different. */
probe('move', 'alwaysCrit', 'Flower Trick carries a crit at a roll where nothing else can', () => {
  const hit = (ab, mvId) => turnDamageBig(['meowscarada', 'corviknight', 'garchomp', 'milotic'],
    (B) => { B.f1.ability = ab; }, mvId, rngLose);
  const control = hit('none', 'flowertrick'), test = hit('shellarmor', 'flowertrick');
  const koPlain = hit('none', 'knockoff'), koArmor = hit('shellarmor', 'knockoff');
  return { works: control > test && test > 0 && koPlain === koArmor && koPlain > 0,
           arms: { control, test },
           detail: `Flower Trick at rng 0.99: plain ${control}, crit-proof body ${test} (the gap IS `
                 + `the certain crit); Knock Off at the same roll: ${koPlain} -> ${koArmor} (no crit `
                 + `to take away, so it must not move)` };
});

/* ARMED, 2026-08-06. Dragon Claw is the control: the same attacker, the same type, the same target,
 * comparable damage, and NO drag. "The foe is not where it was" is what an engine that phazed on any
 * damaging hit prints, and that engine cannot keep a body on the field.
 *
 * THE DAMAGE IS PRINTED so "the drag is not modelled" cannot be confused with "the move never
 * resolved" -- Dragon Tail deals damage AND drags, and only one of those halves is in question. */
probe('move', 'forcesSwitch', 'Dragon Tail drags the target out', () => {
  const run = (mv) => {
    const me = bare('garchomp'), ally = bare('corviknight');
    const f1 = bare('incineroar'), f2 = bare('milotic'), fbench = bare('whimsicott');
    const S = M.battleInit([me, ally], [f1, f2, fbench], { seeded: true });
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { dealt: before - f1.curHP, dragged: S.actB.indexOf(f1) < 0,
             front: S.actB.map(x => x && x.name).join(',') };
  };
  const control = run('dragonclaw'), test = run('dragontail');
  return { works: control.dealt > 0 && !control.dragged && test.dealt > 0 && test.dragged,
           arms: { control: control.front, test: test.front },
           detail: 'Dragon Claw dealt ' + control.dealt + ' and left ' + control.front
                 + '; Dragon Tail dealt ' + test.dealt + ' and left ' + test.front };
});

probe('move', 'crashOnMiss', 'High Jump Kick hurts the user when it misses', () => {
  /* THE ROLL IS PINNED ABOVE THE MOVE'S ACCURACY so the miss is guaranteed. At rng 0.5 it would
   * connect and the probe would report a working crash whatever the engine does. */
  /* ARMED, 2026-08-06. The control is the SAME move at a WINNING roll: it must connect and cost the
   * user nothing. "The user lost HP" is also what an engine charging recoil on every High Jump Kick
   * prints, and half of a crash mechanic is not the mechanic. */
  const run = (roll) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    if (!MC.moves['highjumpkick']) return { dealt: -1, lost: -1 };
    unfaintable(f1);
    const before = me.curHP, foeBefore = f1.curHP;
    M.battleTurn(S, () => roll,
      new Map([[me, M.playerAction(me, 'highjumpkick', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { dealt: foeBefore - f1.curHP, lost: before - me.curHP };
  };
  const control = run(0.5), test = run(0.99);
  return { works: control.dealt > 0 && control.lost === 0 && test.dealt === 0 && test.lost > 0,
           arms: { control: control.lost, test: test.lost },
           detail: 'landed (roll 0.5): dealt ' + control.dealt + ', user lost ' + control.lost
                 + ' (must be 0); missed (roll 0.99): dealt ' + test.dealt + ', user lost ' + test.lost };
});

/* ROADMAP #81 WIRE 1 -- THE CRASH IS AN onMoveFail AND A MISS IS ONLY ONE WAY TO FAIL.
 *
 * Showdown fires `singleEvent('MoveFail', ...)` (sim/battle-actions.ts:526) whenever the move result
 * is falsy, and High Jump Kick's crash is an `onMoveFail` handler (data/moves.ts). A Protect makes
 * the hit fail, so the crash lands -- measured in the authority, both dice pinned:
 *     |-activate|p2a: Garchomp|move: Protect
 *     |-damage|p1a: Hitmonlee|63/125|[from] highjumpkick
 * This engine paid it only off the accuracy roll, so High Jump Kick (146 sets) into a shield was
 * free. THE ROLL IS THE WINNING ONE (0.5) IN BOTH ARMS, which is the point of the probe: at a losing
 * roll the old accuracy-bound crash fires too and an engine with the wire missing would pass.
 *
 * THE CONTROL IS THE SAME CLICK AT THE SAME ROLL WITH THE SHIELD DOWN -- it must connect and cost
 * the user nothing, or "the user lost half its HP" would also be what an engine that crashes on
 * every High Jump Kick prints. */
probe('move', 'crashOnMiss', 'High Jump Kick crashes when PROTECT blocks it, not only when it misses', () => {
  const run = (shielded) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    if (!MC.moves['highjumpkick']) return { dealt: -1, lost: -1, line: 'NO-MOVE' };
    unfaintable(f1);
    const trace = [];
    S._trace = trace;
    const before = me.curHP, foeBefore = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'highjumpkick', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, shielded ? { kind: 'protect', mv: 'protect' } : { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    return { dealt: foeBefore - f1.curHP, lost: before - me.curHP, half: Math.floor(me.st.hp / 2),
             line: (trace.find(l => /^\|-(activate|immune|miss)\|/.test(l)) || '(no block line)') };
  };
  const control = run(false), test = run(true);
  const half = test.half;
  return { works: control.dealt > 0 && control.lost === 0
                  && test.dealt === 0 && test.lost === half && /move: Protect/.test(test.line),
           arms: { control: control.lost, test: test.lost },
           detail: 'shield down: dealt ' + control.dealt + ', user lost ' + control.lost + ' (must be 0); '
                 + 'shield up: dealt ' + test.dealt + ', user lost ' + test.lost + ' (must be ' + half
                 + ') and the block line was ' + test.line };
});

probe('move', 'userFaints', 'Explosion faints its user', () => {
  /* ARMED, 2026-08-06. Crunch is the control: the same body clicking another damaging move on the
   * same turn, and it must live. */
  const run = (click) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'garchomp', 'garchomp');
    if (!MC.moves['explosion']) return 'NO-MOVE';
    unfaintable(f1);
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, click, f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return (me.fainted || me.curHP <= 0) ? 'FAINTED' : (me.curHP + ' hp');
  };
  const control = run('crunch'), test = run('explosion');
  return { works: control !== 'FAINTED' && control !== 'NO-MOVE' && test === 'FAINTED',
           arms: { control, test },
           detail: 'user after Crunch: ' + control + '; after Explosion: ' + test };
});

/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). The varied thing is the ITEM and the two arms
 * are two TARGETS, one super-effective and one not -- an item that raised everything would pass a
 * one-target version. */
probe('item', 'boostsSuperEffective', 'Expert Belt raises only super-effective damage', () => {
  const hit = (item, foeSp) => turnDamageBig(['incineroar', 'milotic', foeSp, 'garchomp'],
    (B) => { B.me.item = item; }, 'flamethrower');
  const control = [hit('', 'corviknight'), hit('', 'garchomp')];
  const test = [hit('expertbelt', 'corviknight'), hit('expertbelt', 'garchomp')];
  return { works: test[0] > control[0] && test[1] === control[1] && control[1] > 0,
           arms: { control, test },
           detail: `Flamethrower into [Corviknight (Steel/Flying, super-effective), Garchomp `
                 + `(resisted)] — no item ${control}, Expert Belt ${test} (only the first may move)` };
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
  return { works: none === 'brn' && lum === 'none', arms: { control: none, test: lum },
           detail: 'no item -> ' + none + ', Lum Berry -> ' + lum };
});

probe('ability', 'typeBecomesMoveType', 'Protean makes the user the type it just used', () => {
  /* THE MOVE'S TYPE MUST BE ONE THE USER DOES NOT ALREADY HAVE. The first version fired Crunch off a
   * Meowscarada, which is already Grass/DARK, so a fully working Protean and a completely absent one
   * both leave a Dark type in the list. Earthquake is Ground and Meowscarada is not. */
  /* ARMED, 2026-08-06. The control is the same body with no ability: its types must not move. */
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('meowscarada', 'incineroar', 'garchomp', 'garchomp');
    me.ability = ab;
    const before = (me.types || []).join('/');
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return [before, (me.types || []).join('/')];
  };
  const control = run('none'), test = run('protean');
  return { works: control[1] === control[0] && test[1] === 'Ground',
           arms: { control, test },
           detail: '[types before, types after a Ground move] — no ability ' + control
                 + ' (must not move); Protean ' + test };
});

probe('ability', 'invertsBoosts', 'Contrary turns a self-drop into a boost', () => {
  /* ARMED, 2026-08-06. The control is the same body with no ability, and it must go DOWN — an
   * engine that had lost the self-drop altogether would read 0 in both arms and pass nothing. */
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('staraptor', 'incineroar', 'garchomp', 'garchomp');
    me.ability = ab;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return me.boosts.df;
  };
  const control = run('none'), test = run('contrary');
  return { works: control < 0 && test > 0, arms: { control, test },
           detail: 'own def stage after Close Combat — no ability ' + control + ' (must fall), Contrary '
                 + test + ' (must rise)' };
});

/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST: a refusal or a redirection
 * turns a certainty into a failure whatever its usage, so tests/test-medicham-coverage.js
 * requires it to carry a machine-checked control. Both arms were already computed here; what was
 * missing was declaring them, which is the difference between a control a reader can see and one
 * the harness can check. */
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
           arms: { control: none, test: damp },
           detail: 'no ability: foe took ' + none.took + ' / user ' + (none.userDead ? 'fainted' : 'lived')
                 + '   |   Damp: foe took ' + damp.took + ' / user ' + (damp.userDead ? 'FAINTED' : 'lived') };
});

probe('move', 'hazard', 'Stealth Rock chips what comes in afterwards', () => {
  /* ARMED, 2026-08-06. Howl is the control — the same turn spent, no rocks laid — and the same body
   * must then walk in untouched. "The switch-in lost HP" is also what an engine with a stray
   * entry residual prints, and the hazard is a claim about what was LAID rather than about entering.
   *
   * WHETHER THE SWITCH HAPPENED IS PART OF THE READING. An unchipped body that never came in and an
   * unchipped body that walked through a hazard nothing implements read the same from HP alone. */
  const run = (mv) => {
    const me = bare('garchomp'), ally = bare('corviknight');
    const f1 = bare('incineroar'), f2 = bare('milotic'), fbench = bare('staraptor');
    const S = M.battleInit([me, ally], [f1, f2, fbench], { seeded: true });
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    const before = fbench.curHP;
    M.battleTurn(S, rng5, PASS2(me, ally),
      new Map([[f1, { kind: 'switch', to: fbench }], [f2, { kind: 'pass' }]]));
    return { cameIn: S.actB.indexOf(fbench) >= 0, lost: before - fbench.curHP };
  };
  const control = run('howl'), test = run('stealthrock');
  return { works: control.cameIn && control.lost === 0 && test.cameIn && test.lost > 0,
           arms: { control: control.lost, test: test.lost },
           detail: 'the switch-in (Staraptor, 4x weak to Rock) lost ' + control.lost + ' after Howl '
                 + '(came in=' + control.cameIn + ', must be 0) and ' + test.lost + ' after Stealth Rock '
                 + '(came in=' + test.cameIn + ')' };
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
  return { works: free > 0 && blocked <= 0, arms: { control: free, test: blocked },
           detail: 'healed ' + free + ' normally, ' + blocked + ' after Psychic Noise' };
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
  return { works: none === true && herb === false, arms: { control: none, test: herb },
           detail: 'no item taunted=' + none + ', Mental Herb taunted=' + herb };
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE PREVIOUS PASS DECLINED TO CONVERT IT
 * BECAUSE THE DISCOUNT REALLY IS A PRICING QUESTION dmgRange OWNS. That judgement was right about the
 * ratio and wrong that a turn adds nothing, and here is what it adds:
 *
 * IS THE 90% COUNTED TWICE? The expected-hits discount is 1 + p + p^2 = 2.71, which is the
 * expectation CONDITIONAL on the move connecting at all -- and the battle loop then rolls
 * `moveAccuracy(id) < 100 && rng()*100 > acc` on top of it. Those two are only compatible if the
 * discount is the conditional one; an unconditional p(1 + p + p^2) = 2.44 alongside the same roll
 * would price every Triple Axel about 10% low forever, and nothing had ever asked. So the turn arms
 * assert that the move CAN miss entirely (rng 0.99, above 90) and DOES connect on a winning roll --
 * which is what makes the conditional expectation the correct one to be using.
 *
 * The ratio arms stay as dmgRange calls and are labelled as such: `one()` needs a tag-free twin of
 * the move, and a twin cannot be CLICKED (playerAction resolves ids against MC.moves, and putting a
 * synthetic move in that global table would be visible to every probe after this one). */
probe('move', 'multiAccuracy', 'Triple Axel is priced below three full hits, and the 90% is not counted twice', () => {
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
  const turn = (rngIn) => turnDamageBig(['weavile', 'incineroar', 'garchomp', 'milotic'], null,
    'tripleaxel', rngIn);
  const landed = turn(rng5), missed = turn(rngLose);
  return { works: taR > 2 && taR < 2.95 && rbR > 3.0 && landed > 0 && missed === 0,
           arms: { control: missed, test: landed },
           detail: 'Triple Axel ' + taOne + ' x' + taR.toFixed(2) + ' = ' + taAll
                 + ' (three full hits would be x3, the discount is x2.71);  Rock Blast ' + rbOne
                 + ' x' + rbR.toFixed(2) + ' = ' + rbAll + ' (no per-hit roll, must stay x3.1);  '
                 + 'through a real turn it deals ' + landed + ' on a winning roll and ' + missed
                 + ' on a losing one (so the 90% is a to-hit roll, not a second discount)' };
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). The word `applyField` writes is now put on a
 * REAL battle's field and a real Fire click is made under it, which is the thing the rollout actually
 * does -- dmgRange was only ever half the path, and the loop re-derives the damage itself. */
probe('move', 'boardWeatherLanguage', "a board's Showdown weather name reaches the damage formula", () => {
  const RL = require(D('engine', 'rollout_leaf.js'));
  const probeS = { field: {} };
  RL.applyField(probeS, { weather: 'sunnyday' }, 'p1', true);
  const landed = probeS.field.weather;
  const hit = (wx) => turnDamageBig(['charizard', 'incineroar', 'garchomp', 'milotic'],
    (B) => { B.S.field.weather = wx; }, 'flamethrower');
  const none = hit(''), sun = hit('sun'), got = hit(landed);
  return { works: sun > none && none > 0 && got === sun,
           arms: { control: none, test: got },
           detail: `applyField('sunnyday') -> ${JSON.stringify(landed)}; Flamethrower through a real `
                 + `turn: clear ${none}, 'sun' ${sun}, as landed ${got}` };
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND BOTH HALVES WENT THROUGH A TURN. The
 * priority half used to read `priorityRefusedAbove` directly, which is the function WIRE 117 proved
 * was right while the loop calling it was handed the wrong argument -- so the outcome is now whether
 * an Ice Shard aimed at a GROUNDED body actually lands. */
probe('move', 'boardTerrainLanguage', "a board's Showdown terrain name reaches the engine", () => {
  const RL = require(D('engine', 'rollout_leaf.js'));
  const probeS = { field: {} };
  RL.applyField(probeS, { terrain: 'electricterrain' }, 'p1', true);
  const landed = probeS.field.terrain;
  const hit = (t) => turnDamageBig(['milotic', 'incineroar', 'garchomp', 'corviknight'],
    (B) => { B.me.ability = 'hadronengine'; B.S.field.terrain = t; }, 'surf');
  const none = hit(''), eng = hit('electric'), got = hit(landed);
  /* The OTHER site, in the OTHER direction: this one already spoke the board's word and not the
   * artifact's. The receipt is the damage a +1 priority move deals to a grounded target. */
  const shard = (t) => {
    const B = board('garchomp', 'incineroar', 'weavile', 'milotic');
    unfaintable(B.me);
    B.S.field.terrain = t;
    const before = B.me.curHP;
    M.battleTurn(B.S, rng5, PASS2(B.me, B.ally),
      new Map([[B.f1, M.playerAction(B.f1, 'iceshard', B.me, B.S.field)], [B.f2, { kind: 'pass' }]]));
    return before - B.me.curHP;
  };
  const pClear = shard(''), pEng = shard('psychic'), pBoard = shard('psychicterrain');
  return { works: eng > none && none > 0 && got === eng
                  && pClear > 0 && pEng === 0 && pBoard === 0,
           arms: { control: [none, pClear], test: [got, pBoard] },
           detail: `applyField('electricterrain') -> ${JSON.stringify(landed)}; Surf under Hadron `
                 + `Engine through a real turn: clear ${none}, 'electric' ${eng}, as landed ${got}; `
                 + `Ice Shard into a grounded Garchomp: clear ${pClear}, 'psychic' ${pEng}, `
                 + `'psychicterrain' ${pBoard}` };
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Four dmgRange calls became four real turns:
 * same board, same target, same two moves, and the ability is the only thing that moves. A class
 * multiplier read in dmgRange and dropped on the way through the battle loop would have passed the
 * old version, and "the handler is right and the path around it is not" is this engine's most
 * expensive bug shape (WIRE 123). */
probe('move', 'moveClass', 'Iron Fist boosts a punch and leaves a non-punch alone', () => {
  const hit = (ab, mv) => turnDamage(['incineroar', 'corviknight', 'garchomp', 'garchomp'],
    (B) => { B.me.ability = ab; unfaintable(B.f1); }, mv);
  const control = [hit('none', 'machpunch'), hit('none', 'flareblitz')];
  const test = [hit('ironfist', 'machpunch'), hit('ironfist', 'flareblitz')];
  return { works: test[0] > control[0] && test[1] === control[1],
           arms: { control, test },
           detail: `Mach Punch (punch): none ${control[0]} -> Iron Fist ${test[0]}; `
                 + `Flare Blitz (not punch): none ${control[1]} -> Iron Fist ${test[1]} (must not move)` };
});

/* `statChange` — 64,869 uses, second largest unprobed. The param carries the exact table
 * (`charm -> {atk: -2}`), so the probe asserts the SIZE and not merely that something happened: a
 * generic "drop one stage" wire is the failure this file already found in the setup branch, where
 * every click gave +1 Atk/SpA/Spe and Swords Dance was one-third right. */
/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3), AND THESE TEN WERE PICKED BY A NUMBER RATHER THAN BY
 * EYE. tests/test-medicham-coverage.js weights every tag by the corpus usage of the entities in
 * the 99% set that carry it, and these are the top of that list -- `statusInflict` 585,893,
 * `contact` 444,874, `priority` 359,331. Move coverage read 9.3% of USAGE armed against 260 of 277
 * moves LIVE, and the gap is entirely that the handful of tags the biggest moves carry were the
 * ones nobody had declared arms on. Every control below was already being computed. */
probe('move', 'statChange', 'Charm drops the target Attack by exactly two stages', () => {
  const run = (click) => {
    const { me, ally, f1, f2, S } = board('whimsicott', 'incineroar', 'garchomp', 'garchomp');
    M.battleTurn(S, rng5,
      new Map([[me, click ? M.playerAction(me, 'charm', f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    return f1.boosts.at;
  };
  const control = run(false), test = run(true);
  return { works: control === 0 && test === -2, arms: { control, test },
           detail: `foe atk stage: no click ${control}, after Charm ${test} (the param says -2)` };
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
           arms: { control: [sOff, nOff], test: [sOn, nOn] },
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
           arms: { control: [cOff, sOff], test: [cOn, sOn] },
           detail: `Waterfall (contact): none ${cOff} -> Rough Skin ${cOn}; `
                 + `Surf (special): none ${sOff} -> Rough Skin ${sOn} (must stay 0)` };
});

/* `reflectsStatusMoves` — 568 uses (Magic Bounce). The status move must come BACK, not merely fail:
 * a refusal reads identical on the target and the difference is entirely on the USER, which is why
 * both bodies' stages are printed. */
/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST: a refusal or a redirection
 * turns a certainty into a failure whatever its usage, so tests/test-medicham-coverage.js
 * requires it to carry a machine-checked control. Both arms were already computed here; what was
 * missing was declaring them, which is the difference between a control a reader can see and one
 * the harness can check. */
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
           arms: { control: off, test: on },
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
           arms: { control: off.d, test: on.d },
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
/* ARMS DECLARED, 2026-08-06 (#42/#45 part 3). ON THE CARVE-OUT LIST: a refusal or a redirection
 * turns a certainty into a failure whatever its usage, so tests/test-medicham-coverage.js
 * requires it to carry a machine-checked control. Both arms were already computed here; what was
 * missing was declaring them, which is the difference between a control a reader can see and one
 * the harness can check. */
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
           arms: { control: free.then, test: pinned.then },
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Six arms, all through a real turn; the weather
 * is written onto the BATTLE's field rather than into a synthetic one handed to dmgRange. */
probe('move', 'weatherDamageMult', 'sun raises Fire and halves Water, rain does the reverse', () => {
  const at = (w, mv) => turnDamageBig(['charizard', 'incineroar', 'garchomp', 'milotic'],
    (B) => { B.S.field.weather = w; }, mv);
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
  /* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Eight arms through real turns.
   * THE WEATHER CHIP IS WHY EACH PAIR VARIES ONLY THE SKY ON ONE BODY: the HP reading includes
   * residual damage, so comparing a Rock body against a Water one across a sandstorm would differ for
   * a reason that has nothing to do with Special Defence. The cross-species comparison is never made;
   * each of the four pairs is one species, clear against its weather. */
  const at = (defSp, mv, w) => turnDamageBig(
    [mv === 'earthquake' ? 'garchomp' : 'alakazam', 'corviknight', defSp, 'milotic'],
    (B) => { B.S.field.weather = w; unfaintable(B.f2); }, mv);
  const sandRock = [at('tyranitar', 'shadowball', ''), at('tyranitar', 'shadowball', 'sand')];
  const sandOther = [at('gholdengo', 'shadowball', ''), at('gholdengo', 'shadowball', 'sand')];
  const snowIce = [at('weavile', 'earthquake', ''), at('weavile', 'earthquake', 'snow')];
  const snowOther = [at('incineroar', 'earthquake', ''), at('incineroar', 'earthquake', 'snow')];
  return { works: sandRock[1] < sandRock[0] && sandOther[1] === sandOther[0]
                  && snowIce[1] < snowIce[0] && snowOther[1] === snowOther[0],
           arms: { control: [sandOther, snowOther], test: [sandRock, snowIce] },
           detail: `Shadow Ball into Rock clear/sand ${sandRock.join('/')} (into Water ${sandOther.join('/')}, `
                 + `must not move);  Earthquake into Ice clear/snow ${snowIce.join('/')} `
                 + `(into Fire ${snowOther.join('/')}, must not move)` };
});

/* ACCURACY, BOTH DIRECTIONS. Thunder is 70 in clear skies, cannot miss in rain and drops to 50 in sun.
 * A wire that only knew about rain would pass a two-armed probe and be wrong on every sun board. */
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE OUTCOME IS WHETHER THE MOVE LANDED.
 * `moveAccuracy` returning 100 is exactly what WIRE 124 proved could be true of a move the engine
 * could not miss with for a completely different reason. The roll is pinned at 0.99 -- above every
 * printed accuracy in the format -- so a move that connects on it is one the engine believes cannot
 * miss, and the clear-sky and sun arms must both come back zero. The winning-roll arm is the control
 * that says the staging works at all: Thunder must land in clear skies at rng 0.5. */
probe('move', 'weatherAccuracy', 'Thunder never misses in rain and is worse in sun', () => {
  /* THE TARGET IS A WATER TYPE, AND THE FIRST STAGING GOT THAT WRONG -- arm 35. It fired Thunder at
   * a GARCHOMP, which is Dragon/GROUND and takes literally nothing from an Electric move: every arm
   * read 0, including the winning-roll control, and on a perfectly correct engine the probe reported
   * the mechanic MISSING. A never-miss claim means nothing against a target the move cannot damage. */
  const at = (w, rngIn) => turnDamageBig(['pikachu', 'incineroar', 'milotic', 'garchomp'],
    (B) => { B.S.field.weather = w; }, 'thunder', rngIn);
  const clearWin = at('', rng5);
  const clear = at('', rngLose), rain = at('rain', rngLose), sun = at('sun', rngLose);
  const accs = ['', 'rain', 'sun'].map(w => M.moveAccuracy('thunder', Object.assign(fresh(), { weather: w })));
  return { works: clearWin > 0 && clear === 0 && rain > 0 && sun === 0
                  && accs[1] === 100 && accs[0] < 100 && accs[2] < accs[0],
           arms: { control: clear, test: rain },
           detail: `Thunder on a LOSING roll (0.99): clear ${clear}, rain ${rain} (must land), sun `
                 + `${sun}; on a winning roll in clear skies ${clearWin}; the printed accuracies are `
                 + `clear ${accs[0]}, rain ${accs[1]}, sun ${accs[2]}` };
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
  /* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE TURN IS WHERE THE HARD ZERO ACTUALLY
   * BITES: the loop has its own type-immunity gate, and WIRE 128 has just finished proving that gate
   * was a second implementation which disagreed with dmgRange. A clear-sky Weather Ball must be
   * refused by BOTH. */
  const at = w => turnDamageBig(['alakazam', 'incineroar', 'gengar', 'milotic'],
    (B) => { B.S.field.weather = w; unfaintable(B.f2); }, 'weatherball');
  const clear = at(''), rain = at('rain'), sun = at('sun'), sand = at('sand'), snow = at('snow');
  return { works: clear === 0 && rain > 0 && sun > 0 && sand > 0 && snow > 0,
           arms: { control: clear, test: [rain, sun, sand, snow] },
           detail: `Weather Ball max into Gengar (Ghost, immune to NORMAL): clear ${clear} (must be 0), `
                 + `rain ${rain} (Water), sun ${sun} (Fire), sand ${sand} (Rock), snow ${snow} (Ice)` };
});

/* SWIFT SWIM ONLY IN ITS OWN WEATHER. `speedCond` is already probed through Chlorophyll, and a wire
 * that doubled Speed in ANY weather would pass that probe — so the third arm is the WRONG sky. */
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE OUTCOME IS TURN ORDER, not a Speed
 * number -- the same correction the Choice Scarf probe was given, for the same reason: this engine
 * has had the COMPARATOR wrong (WIRE 118, WIRE 123) while every speed number was right. The foe is
 * left on 1 HP, so if the Swift Swim body really moved first the foe never acts and takes nothing
 * back. Speeds are forced on both bodies so the ability is the only thing that can flip the order. */
probe('ability', 'speedCondWrongWeather', 'Swift Swim moves a slower body first in rain and not in sun', () => {
  const run = (ab, w) => {
    const B = board('basculegion', 'incineroar', 'basculegion', 'garchomp');
    B.me.st = Object.assign({}, B.me.st, { sp: 100 });
    B.f1.st = Object.assign({}, B.f1.st, { sp: 130 });
    B.me.ability = ab; B.me.item = ''; B.f1.item = '';
    B.S.field.weather = w; B.f1.curHP = 1;
    const before = B.me.curHP;
    M.battleTurn(B.S, rng5,
      /* RECOIL-FREE ON MY SIDE — see the identical note on the Choice Scarf probe (WIRE 4). Wave
       * Crash's recoil is clamped to a minimum of 1 in the real game, so a 1 HP kill with it costs
       * the killer a point and "damage taken === 0" stops meaning "the foe never acted". */
      new Map([[B.me, M.playerAction(B.me, 'liquidation', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      new Map([[B.f1, M.playerAction(B.f1, 'wavecrash', B.me, B.S.field)], [B.f2, { kind: 'pass' }]]));
    return [M.effSpeed(B.me, B.S.field, 'A'), before - B.me.curHP];
  };
  const off = run('none', 'rain'), on = run('swiftswim', 'rain'), wrong = run('swiftswim', 'sun');
  return { works: off[0] === 100 && on[0] === 200 && wrong[0] === 100
                  && off[1] > 0 && on[1] === 0 && wrong[1] > 0,
           arms: { control: off, test: on },
           detail: `[own Speed, damage taken from a 130-Speed foe on 1 HP] — no ability in rain `
                 + `${off} (slower, so it got hit), Swift Swim in rain ${on} (faster, so the foe `
                 + `never acted), Swift Swim in SUN ${wrong} (the wrong sky: back to slower)` };
});

/* SOLAR POWER raises Special Attack in sun and must leave a PHYSICAL move alone — the natural
 * mis-statement of the rule is "it boosts damage in sun", and that version is wrong on half the
 * movepool of every body that carries it. */
probe('ability', 'solarPower', 'Solar Power raises a special move in sun and not a physical one', () => {
  /* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Solar Power also costs its holder 1/8 HP per
   * turn in sun; that lands on the ATTACKER and the reading here is the TARGET's loss, so it does not
   * confound -- said here because it is exactly the kind of thing that would. */
  const at = (ab, mv, w) => turnDamageBig(['charizard', 'incineroar', 'garchomp', 'milotic'],
    (B) => { B.me.ability = ab; B.S.field.weather = w; unfaintable(B.f2); }, mv);
  const spec = [at('none', 'flamethrower', 'sun'), at('solarpower', 'flamethrower', 'sun')];
  const phys = [at('none', 'earthquake', 'sun'), at('solarpower', 'earthquake', 'sun')];
  const noSun = [at('none', 'flamethrower', ''), at('solarpower', 'flamethrower', '')];
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND A THIRD ARM CAME WITH IT: the suppressed
 * number must equal the CLEAR-SKY number, not merely be smaller than the sunny one. "It went down" is
 * also what a defender ability that cut Fire damage would print, which is a different mechanic. */
probe('ability', 'weatherSuppression', 'Air Lock stops the sun boosting Fire', () => {
  const at = (ab, w) => turnDamageBig(['charizard', 'incineroar', 'garchomp', 'milotic'],
    (B) => { B.f1.ability = ab; B.S.field.weather = w; }, 'flamethrower');
  const control = at('none', 'sun'), test = at('airlock', 'sun');
  const clear = at('none', '');
  return { works: control > test && test === clear && clear > 0,
           arms: { control, test },
           detail: `Flamethrower in sun: plain defender ${control}, Air Lock defender ${test}; `
                 + `the same click in CLEAR skies ${clear} (the suppressed arm must equal it exactly)` };
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE OUTCOME MOVED FROM THE ACTION'S KIND TO
 * THE TERRAIN ON THE BOARD. `playerAction(...).kind === 'terrain'` is a classification, and this file
 * has been caught before by testing a classification instead of an outcome -- an action labelled
 * 'terrain' that the loop then dropped would read as the mechanic working. Every member is CLICKED
 * and the field is read afterwards; Swords Dance is the control that must leave it empty. */
probe('move', 'setsTerrainEveryMember', 'every setsTerrain move actually resolves to a terrain', () => {
  const landed = (id) => {
    const B = board('venusaur', 'incineroar', 'garchomp', 'milotic');
    M.battleTurn(B.S, rng5,
      new Map([[B.me, M.playerAction(B.me, id, null, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    return B.S.field.terrain || 'none';
  };
  const members = ['psychicterrain', 'electricterrain', 'grassyterrain', 'mistyterrain'];
  const got = members.map(id => id + '->' + landed(id));
  const control = landed('swordsdance');
  const test = members.every(id => landed(id) !== 'none') ? 'all-set' : 'not-all-set';
  return { works: test === 'all-set' && control === 'none', arms: { control, test },
           detail: got.join(' ') + '   control swordsdance->' + control };
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). WIRE 126 is the reason this one had to move:
 * the conversion was correct inside dmgRange and ABSENT from the battle loop's own type resolution
 * for its whole life, so a probe that asked the calc could not have seen it. Both arms are turns. */
probe('ability', 'convertsMoveTypeByFlag', 'Liquid Voice makes a sound move Water', () => {
  const hit = (attSp, ab, mvId, foeSp) => turnDamageBig([attSp, 'incineroar', foeSp, 'milotic'],
    (B) => { B.me.ability = ab; }, mvId);
  const control = hit('primarina', 'none', 'psychicnoise', 'venusaur');
  const test = hit('primarina', 'liquidvoice', 'psychicnoise', 'venusaur');
  /* The -ate arm, so "reads the type half" cannot pass this on its own. */
  const ateOff = hit('pikachu', 'none', 'bodyslam', 'venusaur');
  const ateOn = hit('pikachu', 'galvanize', 'bodyslam', 'venusaur');
  return { works: control !== test && control > 0 && ateOff !== ateOn && ateOff > 0,
           arms: { control, test },
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THIS IS THE PROBE docs/ENGINE.md NAMED AS
 * THE EXAMPLE OF THE WHOLE PROBLEM. `applyIntimidate` was correct throughout WIRE 123 and the ORDER
 * the entry effects ran in was not, so side B's lead owned the weather and every damage roll after it
 * carried the wrong multiplier -- and this probe was green the whole time, because it called the
 * handler itself. The drop now arrives the way it does in a game: a real Incineroar switching in
 * through battleInit's entry-effect pass. */
probe('ability', 'intimidateRetaliationNet', 'Intimidate into Defiant is net +1 Atk; into Competitive it is Atk -1 AND SpA +2', () => {
  const run = (ab) => {
    const me = bare('incineroar'), ally = bare('corviknight');
    const f1 = bare('milotic'), f2 = bare('garchomp');
    me.ability = 'intimidate'; f1.ability = ab;
    M.battleInit([me, ally], [f1, f2], {});          // NOT seeded: entry abilities fire
    return { at: f1.boosts.at, sa: f1.boosts.sa };
  };
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

/* WIRE 97 -- Sheer Force, both halves plus the Life Orb interaction.
 * CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Rock Slide is SPREAD, so the click is aimed
 * through a real turn and the number read is what the AIMED foe lost, at the spread multiplier the
 * loop applies -- which the direct call was asking dmgRange for with `spread:false` and therefore
 * comparing a number the battle never produces. Double-Edge is the no-secondary control. */
probe('ability', 'removesOwnSecondaries', 'Sheer Force boosts a secondary-carrying move x1.3 and strips its secondary', () => {
  const hit = (ab, mvId) => turnDamageBig(['incineroar', 'corviknight', 'milotic', 'garchomp'],
    (B) => { B.me.ability = ab; unfaintable(B.f2); }, mvId);
  const a = hit('none', 'rockslide'), b = hit('sheerforce', 'rockslide');
  const pa = hit('none', 'doubleedge'), pb = hit('sheerforce', 'doubleedge');
  return { works: b > a * 1.2 && pb === pa && pa > 0,
           arms: { control: a, test: b },
           detail: `Rock Slide (has a secondary): none ${a} -> Sheer Force ${b}; `
                 + `a no-secondary move must NOT move: ${pa} -> ${pb}` };
});

/* WIRE 96 -- Sniper.
 * CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). The roll is pinned at 0.99, which is ABOVE
 * every crit rate in the game, so the control move cannot crit in the loop and the only crit on the
 * board is Flower Trick's certain one -- which is the half Sniper multiplies and the half dmgRange
 * owns. Close Combat is the arm that must not move. */
probe('ability', 'critDamageUp', "Sniper multiplies a crit's damage half again", () => {
  const hit = (ab, mvId) => turnDamageBig(['meowscarada', 'corviknight', 'milotic', 'garchomp'],
    (B) => { B.me.ability = ab; }, mvId, rngLose);
  const a = hit('none', 'flowertrick'), b = hit('sniper', 'flowertrick');
  const ca = hit('none', 'closecombat'), cb = hit('sniper', 'closecombat');
  return { works: b > a * 1.4 && cb === ca && ca > 0,
           arms: { control: a, test: b },
           detail: `Flower Trick (always crits): none ${a} -> Sniper ${b} (x1.5 on the crit); `
                 + `a non-crit move must not move: ${ca} -> ${cb}` };
});

/* WIRE 98 -- Parental Bond.
 * CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE SPREAD ARM IS THE REASON IT MATTERED.
 * The direct version passed `spread:true` to dmgRange by hand; through a real turn the loop decides
 * for itself whether Earthquake is a spread move, so the control now asks the engine rather than
 * telling it. Both foes are made unfaintable because Earthquake hits both. */
probe('ability', 'hitsTwice', 'Parental Bond adds a quarter-strength second hit, and not on a spread move', () => {
  const hit = (ab, mvId) => turnDamageBig(['kangaskhan', 'corviknight', 'milotic', 'garchomp'],
    (B) => { B.me.ability = ab; unfaintable(B.f2); }, mvId);
  const a = hit('none', 'doubleedge'), b = hit('parentalbond', 'doubleedge');
  const sa = hit('none', 'earthquake'), sb = hit('parentalbond', 'earthquake');
  return { works: b > a * 1.15 && sb === sa && sa > 0,
           arms: { control: a, test: b },
           detail: `single-target: none ${a} -> Parental Bond ${b} (x1.25); `
                 + `spread Earthquake must not move: ${sa} -> ${sb}` };
});

/* WIRE 94 -- Unaware, the ability half of ignoresStatStages. The MOVE half (Sacred Sword) has been
 * live under `ignoresBoosts` all along, which makes the move-side tag a redundant second spelling --
 * staged for tag_dex cleanup. */
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Both directions, four arms, every one through a
 * real turn — the same four comparisons the direct version made, and no comparison was weakened.
 * Attacker boosts are set on the CLICKING body and defender boosts on the target, which is the whole
 * point of the mechanic and the thing a rollout gets wrong if the loop reads a different body. */
probe('ability', 'ignoresStatStages', "Unaware ignores the attacker's +6 when defending and the defender's +6 when attacking", () => {
  const hit = (attAb, defAb, atk, df) => turnDamageBig(['garchomp', 'incineroar', 'milotic', 'corviknight'],
    (B) => { B.me.ability = attAb; B.f1.ability = defAb; B.me.boosts.at = atk; B.f1.boosts.df = df; },
    'earthquake');
  const plain = hit('none', 'none', 6, 0);
  const seen = hit('none', 'unaware', 6, 0);
  const base = hit('none', 'unaware', 0, 0);
  /* other direction: an Unaware attacker into a +6 Def target */
  const boosted = hit('none', 'none', 0, 6);
  const ignored = hit('unaware', 'none', 0, 6);
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45), AND THE "PRIVATE" HALF IS NOW MEASURED RATHER
 * THAN ASSERTED IN PROSE. The old comment said the field still reports no weather; nothing checked
 * it. Three arms: the holder's own Fire click must rise, the FIELD must still be clear after the
 * turn, and an ALLY's Fire click on the same board must NOT rise -- which is the entire difference
 * between a private sun and Drought. */
probe('ability', 'privateWeather', "Mega Sol's own Fire move fires under a sun only it can see", () => {
  let seenField = 'unset';
  const hit = (ab, whoAlly) => {
    const B = board('meganium', 'meganium', 'corviknight', 'milotic');
    /* THE SHOOTER IS ALWAYS `me`. The first cut put the ability on the ALLY and then had the ALLY
     * shoot, which is the same body wearing a different label -- it read 179 both ways and looked
     * like a private sun leaking across the side. Arm 36. */
    B.me.ability = whoAlly ? 'none' : ab;
    B.ally.ability = whoAlly ? ab : 'none';
    unfaintable(B.f1);
    const before = B.f1.curHP;
    M.battleTurn(B.S, rng5,
      new Map([[B.me, M.playerAction(B.me, 'flamethrower', B.f1, B.S.field)], [B.ally, { kind: 'pass' }]]),
      PASS2(B.f1, B.f2));
    seenField = B.S.field.weather || 'CLEAR';
    return before - B.f1.curHP;
  };
  const control = hit('none', false), test = hit('megasol', false);
  const fieldAfter = seenField;
  const allyShoots = hit('megasol', true);          // the ALLY holds it; the shooter does not
  return { works: test > control * 1.3 && control > 0 && fieldAfter === 'CLEAR' && allyShoots === control,
           arms: { control, test },
           detail: `Flamethrower on a clear field: ability none ${control}, Mega Sol ${test} (the `
                 + `private sun's x1.5); the field after the turn is ${fieldAfter} (must be CLEAR); `
                 + `an ALLY holding it shoots for ${allyShoots} (must equal the no-ability number)` };
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
/* CONVERTED FROM A DIRECT CALL, 2026-08-06 (#42/#45). Same two moves, same two arms, through a turn. */
probe('ability', 'halvesTypeDamage', 'Purifying Salt halves a GHOST move and leaves the others alone', () => {
  const hit = (ab, mvId) => turnDamageBig(['gengar', 'incineroar', 'garganacl', 'garchomp'],
    (B) => { B.f1.ability = ab; }, mvId);
  const ghost = hit('none', 'shadowball'), ghostS = hit('purifyingsalt', 'shadowball');
  const other = hit('none', 'sludgebomb'), otherS = hit('purifyingsalt', 'sludgebomb');
  return { works: ghostS < ghost * 0.6 && ghostS > 0 && otherS === other && other > 0,
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

/* ---- ACCURACY: ONE MECHANIC, THREE DOORS, AND ONE STAGING FOR ALL OF THEM ----------------------
 *
 * `move|accuracyMod` (Coil, Gravity, Minimize, Double Team, Sweet Scent), `item|accuracyMod` (Wide
 * Lens, Bright Powder, Zoom Lens), `ability|accuracyMod` (Sand Veil, Snow Cloak, Compound Eyes,
 * Hustle) and `ability|writesAccuracy` (No Guard) are the SAME question — does this move land —
 * arriving at the engine through four different doors. ~5,000 corpus uses between them and not one
 * axis had a probe of any kind.
 *
 * EVERY ACCURACY PROBE IN THIS FILE GOES THROUGH THE ONE HELPER BELOW, and that is not tidiness.
 * Three separately hand-rolled accuracy comparisons is exactly how WIRE 124 happened — two
 * implementations of `moveAccuracy` in one file, disagreeing on 78 moves for 35,608 corpus clicks,
 * under a green probe that asserted its own answer.
 *
 * THE OUTCOME IS DAMAGE, NEVER A CLASSIFICATION AND NEVER A RETURNED PROBABILITY. `roll` is the ONLY
 * random number the staged turn ever sees, and the battle loop's to-hit test is `rng()*100 > acc`. So
 * a roll of 0.85 misses everything printed below 85 and lands everything at or above it, and ZERO
 * damage against an unfaintable target is a MISS and nothing else.
 *
 * MOVE LEGALITY IS NOT THE QUESTION HERE and is deliberately not respected: one body carries every
 * arm so that the varied knob is the accuracy layer rather than the attacker. A probe that swapped
 * species between arms would be WIRE 124's sibling — see the `weightBased` and `needsUntrackedState`
 * corrections above, both of which compared two different Pokemon and called the difference a result. */
const hitOnRoll = (sps, roll, moveId, opt) => {
  const o = opt || {};
  const B = board(sps[0], sps[1], sps[2], sps[3]);
  unfaintable(B.f1);
  if (o.stage) o.stage(B);
  const rng = () => roll;
  const mine = (mv) => new Map([[B.me, mv ? M.playerAction(B.me, mv, B.f1, B.S.field) : { kind: 'pass' }],
                                [B.ally, { kind: 'pass' }]]);
  const theirs = (mv) => new Map([[B.f1, mv ? M.playerAction(B.f1, mv, B.me, B.S.field) : { kind: 'pass' }],
                                  [B.f2, { kind: 'pass' }]]);
  /* A SETUP TURN IS SPENT ON BOTH ARMS OR ON NEITHER. Coil against "no setup at all" would vary the
   * number of turns, and every end-of-turn effect in the engine rides on that. */
  if (o.setupMe || o.setupFoe) M.battleTurn(B.S, rng, mine(o.setupMe || null), theirs(o.setupFoe || null));
  const before = B.f1.curHP;
  M.battleTurn(B.S, rng, mine(moveId), theirs(null));
  return before - B.f1.curHP;
};
/* Milotic into Garchomp for every accuracy arm: Garchomp is GROUND, so the sandstorm the Sand Veil
 * arms need cannot chip the body whose HP loss is the measurement. */
const ACCSPS = ['milotic', 'incineroar', 'garchomp', 'incineroar'];

probe('move', 'accuracyMod', 'Coil lands an 80% move on a losing roll; Minimize makes a 100% one miss', () => {
  /* Coil is +1 Atk / +1 Def / +1 ACCURACY -> 80 x 4/3 = 106.7, which cannot miss. Howl is the control
   * because it is also a setup click that also boosts Attack and does NOT touch accuracy — so "a
   * setup turn happened" and "Attack went up" are both true on both arms. */
  const howl = hitOnRoll(ACCSPS, 0.85, 'hydropump', { setupMe: 'howl' });
  const coil = hitOnRoll(ACCSPS, 0.85, 'hydropump', { setupMe: 'coil' });
  /* The evasion half, in the other direction and on the FOE. Minimize is +2 evasion -> 100 x 3/5 = 60. */
  const plain = hitOnRoll(ACCSPS, 0.85, 'icebeam', { setupFoe: 'protect' });
  const minim = hitOnRoll(ACCSPS, 0.85, 'icebeam', { setupFoe: 'minimize' });
  return { works: howl === 0 && coil > 0 && plain > 0 && minim === 0,
           arms: { control: [howl, plain], test: [coil, minim] },
           detail: `Hydro Pump (80) at roll 0.85 after Howl ${howl} / after Coil ${coil}; `
                 + `Ice Beam (100) at roll 0.85 into a foe that clicked Protect ${plain} / Minimize ${minim}` };
});

probe('item', 'accuracyMod', 'Wide Lens lands an 80% move on a losing roll; Bright Powder makes it miss on a winning one', () => {
  const at = (roll, stage) => hitOnRoll(ACCSPS, roll, 'hydropump', stage ? { stage } : null);
  /* 80 x 1.1 = 88, so roll 0.85 flips from miss to hit. */
  const noLens = at(0.85), lens = at(0.85, (B) => { B.me.item = 'widelens'; });
  /* 80 x 0.9 = 72, so roll 0.75 flips from hit to miss — and it is the TARGET's item, which is the
   * half a one-sided implementation gets wrong. */
  const noPowder = at(0.75), powder = at(0.75, (B) => { B.f1.item = 'brightpowder'; });
  return { works: noLens === 0 && lens > 0 && noPowder > 0 && powder === 0,
           arms: { control: [noLens, noPowder], test: [lens, powder] },
           detail: `Hydro Pump (80) at roll 0.85 — no item ${noLens}, Wide Lens ${lens}; `
                 + `at roll 0.75 — no item ${noPowder}, foe's Bright Powder ${powder}` };
});

probe('ability', 'accuracyMod', 'Sand Veil makes the attacker miss a roll it would have hit, and only in sand', () => {
  const at = (ab, wx) => hitOnRoll(ACCSPS, 0.70, 'hydropump',
    { stage: (B) => { B.f1.ability = ab; B.S.field.weather = wx; } });
  /* 80 x 0.8 = 64, so roll 0.70 flips from hit to miss — and BOTH halves of the condition are
   * cleared: the ability without the sand must not fire, and the sand without the ability must not. */
  const clear = at('sandveil', ''), sand = at('sandveil', 'sand'), noAbil = at('none', 'sand');
  return { works: clear > 0 && noAbil > 0 && sand === 0,
           arms: { control: [clear, noAbil], test: [sand, 0] },
           detail: `Hydro Pump (80) at roll 0.70 into a Garchomp — Sand Veil, clear sky ${clear}; `
                 + `no ability, sand ${noAbil}; Sand Veil, SAND ${sand}` };
});

probe('ability', 'writesAccuracy', 'No Guard makes an 80% move land on a losing roll, in BOTH directions', () => {
  const at = (mine, theirs) => hitOnRoll(ACCSPS, 0.99, 'hydropump',
    { stage: (B) => { B.me.ability = mine; B.f1.ability = theirs; } });
  const control = at('none', 'none'), attacker = at('noguard', 'none'), defender = at('none', 'noguard');
  return { works: control === 0 && attacker > 0 && defender > 0,
           arms: { control, test: [attacker, defender] },
           detail: `Hydro Pump (80) at roll 0.99 — neither side ${control}; No Guard on the ATTACKER `
                 + `${attacker}; No Guard on the TARGET ${defender}` };
});

/* ---- WIRE 131 — WHAT THE BOT THINKS A CLICK IS WORTH, WHICH IS NOT WHETHER IT LANDS ---------------
 *
 * Every probe above this line reads DAMAGE ON THE BOARD, so all of them pass on an engine whose
 * VALUATION path is blind — and that is exactly the engine WIRE 129 shipped. The resolution sites
 * were converted to hitChance; the four valuation sites kept calling the bodiless
 * moveAccuracy(id, field) with a hand-written `att.ability === 'noguard'` beside it. The bot dodged
 * with Sand Veil and priced every click as if none of it existed.
 *
 * SO THIS PROBE MUST NOT MEASURE DAMAGE. It reads the two numbers a decision is actually made from:
 * `bestMoveVs(att,def,field).acc`, which the KO scan multiplies its score by, and the `acc` field on
 * the action object `playerAction` emits. The bodies come off a real staged board through battleInit
 * so that the ability, the item and the boost table are the ones a turn would see. */
const valuedAcc = (moveId, stage) => {
  const B = board('milotic', 'incineroar', 'garchomp', 'incineroar');
  if (stage) stage(B);
  B.me.moves = [moveId];
  const b = M.bestMoveVs(B.me, B.f1, B.S.field);
  const pa = M.playerAction(B.me, moveId, B.f1, B.S.field);
  return [b ? +b.acc.toFixed(4) : null, +pa.move.acc.toFixed(4)];
};

probe('ability', 'writesAccuracy', 'the bot VALUES a click into a No Guard body as certain, not at its printed 80', () => {
  /* No Guard is onAnyAccuracy — it works from either end. The attacker arm was the one clause the old
   * code had (and it had it in only ONE of the four sites); the DEFENDER arm is the half that was
   * missing everywhere, and it is the arm Will named. */
  const control = valuedAcc('hydropump', null);
  const onAtt = valuedAcc('hydropump', (B) => { B.me.ability = 'noguard'; });
  const onDef = valuedAcc('hydropump', (B) => { B.f1.ability = 'noguard'; });
  return { works: String(control) === '0.8,0.8' && String(onAtt) === '1,1' && String(onDef) === '1,1',
           arms: { control, test: onDef },
           detail: `[bestMoveVs.acc, playerAction.acc] for Hydro Pump (80 printed) — neither side `
                 + `${control}; No Guard on the ATTACKER ${onAtt}; No Guard on the TARGET ${onDef}` };
});

probe('ability', 'accuracyMod', 'the bot PRICES an evasive body, and not only dodges around it', () => {
  /* Three knobs the valuation path could not see, each with its own arithmetic so a single blanket
   * multiplier cannot pass all three: Bright Powder x0.9 -> 0.72, +6 evasion /3 -> 0.2667,
   * Wide Lens x1.1 -> 0.88. The control must sit at the printed 0.8. */
  const control = valuedAcc('hydropump', null);
  const bp = valuedAcc('hydropump', (B) => { B.f1.item = 'brightpowder'; });
  const eva = valuedAcc('hydropump', (B) => { B.f1.boosts.eva = 6; });
  const lens = valuedAcc('hydropump', (B) => { B.me.item = 'widelens'; });
  return { works: String(control) === '0.8,0.8' && String(bp) === '0.72,0.72'
                  && String(eva) === '0.2667,0.2667' && String(lens) === '0.88,0.88',
           arms: { control, test: [bp, eva, lens] },
           detail: `[bestMoveVs.acc, playerAction.acc] for Hydro Pump — bare ${control}; the foe's `
                 + `Bright Powder ${bp}; the foe at +6 evasion ${eva}; my Wide Lens ${lens}` };
});

/* ---- THE #51 BATCH, IN CORPUS-USAGE ORDER ------------------------------------------------------
 *
 * Every tag below was on tests/test-medicham-coverage.js's "(b) NO PROBE AT ALL" list -- a worse
 * state than unarmed, because nothing had ever asked whether the engine does the thing.
 * `boostsFromFallen` came off that same list on 2026-08-06 and WIRE 125 was underneath it,
 * undercounting for every body that entered after the first death. Each of these carries more corpus
 * usage than that one did, and the first one probed had WIRE 130 under it. */

/* ONE STAGING FOR THE WHOLE BATCH: a real setup turn for the body that needs one, then a real attack
 * turn, and the aimed foe's HP loss. Same shape as hitOnRoll above and for the same reason -- a probe
 * that hand-rolls its own turn loop is a second implementation of the thing being tested. */
const twoTurn = (sps, opt) => {
  const o = opt || {};
  const B = board(sps[0], sps[1], sps[2], sps[3]);
  if (o.big) unfaintable(B.f1);
  if (o.stage) o.stage(B);
  const rng = () => (o.roll == null ? 0.5 : o.roll);
  const mine = (mv) => new Map([[B.me, mv ? M.playerAction(B.me, mv, B.f1, B.S.field) : { kind: 'pass' }],
                                [B.ally, { kind: 'pass' }]]);
  const theirs = (mv) => new Map([[B.f1, mv ? M.playerAction(B.f1, mv, B.me, B.S.field) : { kind: 'pass' }],
                                  [B.f2, { kind: 'pass' }]]);
  let paid = 0;
  if (o.setupMe || o.setupFoe) {
    const h = B.f1.curHP;
    M.battleTurn(B.S, rng, mine(o.setupMe || null), theirs(o.setupFoe || null));
    paid = h - B.f1.curHP;
  }
  const before = B.f1.curHP;
  if (o.move || o.foeMove) M.battleTurn(B.S, rng, mine(o.move || null), theirs(o.foeMove || null));
  return { paid, dmg: before - B.f1.curHP, sub: B.f1._sub || 0, hp: B.f1.curHP,
           fainted: !!B.f1.fainted, status: B.f1.status || '-', B };
};
const SUBSPS = ['milotic', 'incineroar', 'garchomp', 'incineroar'];

probe('move', 'substitute', 'the doll absorbs the hit, a sound move goes through it, and a second click fails free', () => {
  /* THE CONTROL IS A SETUP CLICK THAT COSTS NOTHING AND DOES NOTHING TO THE INCOMING MOVE. Howl, not
   * "no setup turn at all" -- both arms then spend the same number of turns, which is the correction
   * the accuracy family above needed too. */
  const ctrl = twoTurn(SUBSPS, { setupFoe: 'howl', move: 'icebeam' });
  const sub = twoTurn(SUBSPS, { setupFoe: 'substitute', move: 'icebeam' });
  /* Hyper Voice is `bypasssub` in the real game, so it must reach the BODY while the doll still
   * stands. Without this arm "the substitute ate it" and "the engine stopped resolving moves" print
   * the same zero. */
  const sound = twoTurn(SUBSPS, { setupFoe: 'substitute', move: 'hypervoice' });
  /* A status move is refused by the doll -- and Will-O-Wisp is not on the bypass list, so it is the
   * honest half of that rule rather than the comfortable one. */
  const wisp = twoTurn(SUBSPS, { setupFoe: 'substitute', move: 'willowisp' });
  const wispNo = twoTurn(SUBSPS, { setupFoe: 'howl', move: 'willowisp' });
  /* A SECOND SUBSTITUTE MUST COST NOTHING. This is the arm that catches "pay first, ask later", which
   * is what the engine did on the FIRST click for its whole life. */
  const twice = twoTurn(SUBSPS, { setupFoe: 'substitute', foeMove: 'substitute' });
  return { works: ctrl.dmg > 0 && sub.dmg === 0 && sub.paid > 0
                  && sound.dmg > 0 && sound.sub > 0
                  && wisp.status === '-' && wispNo.status === 'brn'
                  && twice.dmg === 0,
           arms: { control: [ctrl.dmg, wispNo.status], test: [sub.dmg, wisp.status] },
           detail: `Ice Beam into a Garchomp -- after Howl ${ctrl.dmg}, after Substitute ${sub.dmg} `
                 + `(the doll cost ${sub.paid}); Hyper Voice (bypasssub) through the doll ${sound.dmg} `
                 + `with ${sound.sub} doll left; Will-O-Wisp -- with a sub ${wisp.status}, without `
                 + `${wispNo.status}; a SECOND Substitute costs ${twice.dmg}` };
});

probe('ability', 'ignoresScreensAndSubs', 'Infiltrator hits the body behind a substitute', () => {
  const blocked = twoTurn(SUBSPS, { setupFoe: 'substitute', move: 'icebeam' });
  const through = twoTurn(SUBSPS, { setupFoe: 'substitute', move: 'icebeam',
                                    stage: (B) => { B.me.ability = 'infiltrator'; } });
  return { works: blocked.dmg === 0 && through.dmg > 0 && through.sub > 0,
           arms: { control: blocked.dmg, test: through.dmg },
           detail: `Ice Beam into a substituted Garchomp -- no ability ${blocked.dmg}, Infiltrator `
                 + `${through.dmg} with the doll still standing at ${through.sub}` };
});

probe('move', 'swapsAbilities', 'Skill Swap exchanges the two abilities, and Good as Gold refuses it', () => {
  const run = (foeAb) => {
    const r = twoTurn(SUBSPS, { move: 'skillswap',
      stage: (B) => { B.me.ability = 'blaze'; B.f1.ability = foeAb; } });
    return [r.B.me.ability, r.B.f1.ability];
  };
  const swapped = run('intimidate');
  /* Good as Gold refuses a status move outright, so the abilities must be exactly where they started
   * -- which is a different assertion from "nothing happened", because the control arm proves the
   * click otherwise lands. */
  const refused = run('goodasgold');
  return { works: swapped[0] === 'intimidate' && swapped[1] === 'blaze'
                  && refused[0] === 'blaze' && refused[1] === 'goodasgold',
           arms: { control: refused, test: swapped },
           detail: `[attacker ability, target ability] after Skill Swap -- into Intimidate ${swapped}; `
                 + `into Good as Gold ${refused} (refused, unchanged)` };
});

probe('move', 'readsOwnItem', 'Acrobatics doubles when the user holds nothing', () => {
  const at = (item) => twoTurn(SUBSPS, { big: true, move: 'acrobatics',
                                         stage: (B) => { B.me.item = item; } }).dmg;
  const held = at('leftovers'), empty = at('');
  return { works: held > 0 && empty >= 2 * held - 2,
           arms: { control: held, test: empty },
           detail: `Acrobatics -- holding Leftovers ${held}, holding nothing ${empty} (the tag says x2)` };
});

probe('move', 'ohko', 'Fissure kills a body no damage roll could reach, and misses on a losing roll', () => {
  /* THE MECHANISM, NOT A LUCKY ROLL. The target is given EIGHT TIMES its max HP, so no damage
   * formula in this engine can take it down -- a faint here can only be the OHKO rule. `roll` is the
   * only random number the turn sees and Fissure prints 30, so 0.1 wins and 0.9 loses. */
  const hit = twoTurn(SUBSPS, { big: true, move: 'fissure', roll: 0.1 });
  const miss = twoTurn(SUBSPS, { big: true, move: 'fissure', roll: 0.9 });
  /* THE CONTROL IS A REAL ATTACK ON THE SAME WINNING ROLL. Without it "Fissure faints it" cannot be
   * told from "the staging faints it", and an 8x body is exactly the staging that makes that visible. */
  const normal = twoTurn(SUBSPS, { big: true, move: 'icebeam', roll: 0.1 });
  return { works: hit.fainted && !miss.fainted && miss.dmg === 0 && !normal.fainted && normal.dmg > 0,
           arms: { control: [normal.fainted, normal.dmg], test: [hit.fainted, miss.dmg] },
           detail: `into a Garchomp on 8x max HP -- Fissure at roll 0.1 fainted=${hit.fainted}; at `
                 + `roll 0.9 dealt ${miss.dmg}; Ice Beam at roll 0.1 fainted=${normal.fainted} `
                 + `dealing ${normal.dmg}` };
});

probe('ability', 'survivesFromFull', 'Sturdy holds at 1 HP from full and does not from chipped', () => {
  const at = (ab, frac) => twoTurn(SUBSPS, { move: 'icebeam', stage: (B) => {
    B.f1.ability = ab;
    B.me.st = Object.assign({}, B.me.st, { sa: 400 });        // a certain kill either way
    B.f1.curHP = Math.floor(B.f1.st.hp * frac);
  } });
  const full = at('sturdy', 1), chipped = at('sturdy', 0.9), none = at('none', 1);
  return { works: !full.fainted && full.hp === 1 && chipped.fainted && none.fainted,
           arms: { control: [none.fainted, chipped.fainted], test: [full.fainted, full.hp] },
           detail: `an overkill Ice Beam -- Sturdy at full HP fainted=${full.fainted} hp=${full.hp}; `
                 + `Sturdy at 90% fainted=${chipped.fainted}; no ability at full fainted=${none.fainted}` };
});

/* SUPREME OVERLORD IS THE REASON THIS WHOLE BATCH EXISTS. WIRE 125 found the death counter falling
 * back to zero one turn after every death, and it found it because `powerFromFallen` (Last Respects)
 * had a probe. `boostsFromFallen` did NOT, and it reads the same field.
 *
 * THE SNAPSHOT IS TAKEN AT SWITCH-IN, which the artifact says (`countedAt: "switch-in"`) and which
 * makes the staging three turns rather than one: the deaths are planted, a turn is spent so the
 * end-of-turn recount runs, the body switches IN, and only then does it click. A probe that put the
 * Kingambit on the field at battleInit reads 97 in every arm on a perfectly correct engine -- it was
 * written that way first, and it is the thirty-seventh time a probe here was wrong before the engine. */
probe('ability', 'boostsFromFallen', 'Supreme Overlord reads the dead at the moment its body walks in', () => {
  const run = (dead, ab) => {
    const lead = bare('milotic'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('incineroar');
    const king = bare('kingambit'); king.ability = ab;
    const d = [bare('milotic'), bare('milotic'), bare('milotic')];
    const S = M.battleInit([lead, ally, king].concat(d), [f1, f2], { seeded: true });
    unfaintable(f1);
    for (let i = 0; i < dead; i++) { d[i].fainted = true; d[i].curHP = 0; }
    M.battleTurn(S, rng5, PASS2(lead, ally), PASS2(f1, f2));
    M.battleTurn(S, rng5, new Map([[lead, { kind: 'switch', to: king }], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    const before = f1.curHP;
    M.battleTurn(S, rng5, new Map([[king, M.playerAction(king, 'ironhead', f1, S.field)], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    return before - f1.curHP;
  };
  /* THREE ARMS, because two of them separate hypotheses the pair cannot. `none/3` proves the extra
   * damage is the ABILITY and not the three deaths (a switch-in after losses could plausibly be
   * cheaper or dearer for a dozen other reasons), and `overlord/0` proves it is the DEATHS and not
   * the ability. The tag says +10% per fallen, capped at 5 -- three of them is x1.3. */
  const none3 = run(3, 'none'), zero = run(0, 'supremeoverlord'), three = run(3, 'supremeoverlord');
  return { works: zero > 0 && none3 === zero && three > zero
                  && Math.abs(three - Math.floor(zero * 1.3)) <= 2,
           arms: { control: [zero, none3], test: three },
           detail: `Iron Head from a Kingambit that switched in -- no ability with 3 fallen ${none3}; `
                 + `Supreme Overlord with 0 fallen ${zero}; Supreme Overlord with 3 fallen ${three} `
                 + `(the tag says +10% each, so x1.3)` };
});

/* ================= ROADMAP #81 WIRE 6 — DOES THE ENGINE ANNOUNCE THE ACTION IT TOOK ===============
 *
 * The whole-game differential's largest family (124 games / 106 causes, class `event missing from
 * medicham2`) has `|move|p2b: X|Trick Room` as its most-used cause. The mechanic underneath it is
 * ALREADY LIVE — `reversesSpeed` has a probe and it is green, Trick Room really does invert the turn.
 * What is missing is the ANNOUNCEMENT: the engine did the thing and never said so, and there was no
 * probe in this file that could tell those two apart, because every probe here reads state.
 *
 * A STREAM PROBE IS THE RIGHT INSTRUMENT AND IT NEEDS ITS CONTROL CLEARED LIKE ANY OTHER. The control
 * is NOT "an attack announces" — that would test whether `|move|` exists at all, which it plainly
 * does. It is the SAME body on the SAME board taking NO action, which must announce nothing. A body
 * that emits a move line when it passed would be an engine narrating moves it did not make, and that
 * failure is exactly as bad as the silent one. */
const moveLines = (mv) => {
  const me = bare('incineroar'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('milotic');
  const S = M.battleInit([me, ally, bare('clefable')], [f1, f2], { seeded: true });
  const trace = []; S._trace = trace;
  unfaintable(f1); unfaintable(me);
  M.battleTurn(S, rng5,
    new Map([[me, mv ? M.playerAction(me, mv, f1, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return trace.filter(l => l.startsWith('|move|p1a:'));
};

probe('move', 'reversesSpeed', 'Trick Room ANNOUNCES itself, and a passed turn announces nothing', () => {
  const test = moveLines('trickroom'), control = moveLines(null);
  return { works: test.length === 1 && test[0].split('|')[3] === 'trickroom' && control.length === 0,
           arms: { control: control.length, test: test.length },
           detail: `the same Incineroar on the same board, clicking Trick Room emitted `
                 + `${test.length} move line(s) [${test[0] || 'NONE'}]; passing emitted `
                 + `${control.length} [${control[0] || 'none'}]` };
});

/* AND THE ROOT, RATHER THAN THE ONE MOVE THE DIFFERENTIAL HAPPENED TO NAME.
 *
 * `playerAction` resolves a click to one of 27 action KINDS and the announcement was gated on
 * `actionMoveId`, which read a hand-written three-row map for the kinds that carried no id. Fixing
 * Trick Room would have left `pass` (46 moves, 803 of them Quick Guard) silent and would have left the
 * NEXT bare kind anybody adds silent too. So the probe sweeps every kind the engine can resolve, and
 * the representative move for each is DERIVED from playerAction rather than typed here — a kind added
 * tomorrow is swept without editing this file, which is the property the three-row map did not have.
 *
 * MEASURED RED BEFORE THE FIX: 25 of 27 kinds announced, `trickroom` and `pass` did not. */
probe('move', 'statusCategory', 'every action kind the engine can resolve announces its |move| line', () => {
  const reps = new Map(), threwHere = [];
  const me0 = bare('incineroar'), tgt0 = bare('garchomp');
  for (const id of Object.keys(MC.moves).sort()) {
    /* A THROW IS COUNTED AND NAMED, NEVER SKIPPED. `catch { continue }` would drop a kind out of the
     * sweep and the probe would then report full coverage of a smaller set — the silent default this
     * file exists to refuse, and tests/test-no-silent-failure.js caught the first version doing it. */
    let a;
    try { a = M.playerAction(me0, id, tgt0, fresh()); }
    catch (e) { threwHere.push(id + ': ' + e.message.slice(0, 40)); continue; }
    if (a && a.kind && !reps.has(a.kind)) reps.set(a.kind, id);
  }
  const silent = [];
  let announced = 0;
  for (const [kind, id] of reps) {
    const ls = moveLines(id);
    if (ls.length === 1 && ls[0].split('|')[3] === id) announced++; else silent.push(kind + ':' + id);
  }
  /* the control is the same sweep with the click withheld: no kind may announce */
  const narrated = moveLines(null).length;
  return { works: reps.size > 20 && silent.length === 0 && narrated === 0 && threwHere.length === 0,
           arms: { control: narrated, test: announced },
           detail: `${announced}/${reps.size} action kinds emitted exactly one |move| line naming the `
                 + `move clicked; ${threwHere.length} click(s) threw and were NOT swept `
                 + `[${threwHere.join('; ') || 'none'}]; silent: [${silent.join(', ') || 'none'}]; a passed turn narrated `
                 + `${narrated}` };
});

/* ================= ROADMAP #81 WIRE 7 — SEVEN ABSENT-OR-MISORDERED MECHANICS, ONE BATCH ===========
 *
 * Ranked off `data/wire-ladder.json`'s `what_remains_at_the_top_rung` — the causes still parting the
 * two streams after ten frozen releases — rather than off item usage. Two of the roadmap's seven
 * targets did not survive contact with the authority's source and are reported as such below, which
 * is the point of measuring before wiring.
 *
 * `entryLines(` and `turnTrace(` are DECLARED IN REALTURN, deliberately, exactly as `moveLines(` was:
 * both stage a real board through battleInit and spend a real turn through battleTurn, and both read
 * the EMITTED STREAM rather than HP. Three of the six claims below are stream defects with provably
 * identical state — a heal onto a full-HP body, an announcement Showdown does not write — and a
 * state-reading probe structurally cannot see any of them. The other three assert HP, the item slot
 * or the doll's size, and say so. */
const entryLines = (ab, allyHP) => {
  const me = bare('incineroar'), ally = bare('corviknight'), bench = bare('sinistcha');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  bench.ability = ab;
  ally.curHP = Math.max(1, Math.round(ally.st.hp * allyHP));
  const S = M.battleInit([me, ally, bench], [f1, f2], { seeded: true });
  const trace = []; S._trace = trace;
  M.battleTurn(S, rng5, new Map([[me, { kind: 'switch', to: bench }], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return { lines: trace.filter(l => /^\|-(heal|ability)\|/.test(l)), hp: ally.curHP, max: ally.st.hp };
};

/* 1. HOSPITALITY — 5,779 uses, and the single largest cause at the top rung of the release ladder
 *    (127 games across two divergence classes). `Battle.heal()` returns false BEFORE it announces
 *    when `target.hp >= target.maxhp`, and Hospitality's handler adds no `-ability` line at all.
 *    THE CONTROL IS THE SAME ABILITY WITH THE PARTNER DAMAGED, which must still write exactly one
 *    line — without it this would pass on an engine that had lost Hospitality altogether. */
probe('ability', 'healsAllyOnSwitchIn', 'Hospitality at a FULL-HP partner announces nothing at all', () => {
  const hurt = entryLines('hospitality', 1 / 3), full = entryLines('hospitality', 1);
  const off = entryLines('none', 1);
  return { works: hurt.lines.length === 1 && /^\|-heal\|/.test(hurt.lines[0])
                  && full.lines.length === 0 && off.lines.length === 0
                  && full.hp === full.max,
           arms: { control: hurt.lines.length, test: full.lines.length },
           detail: `entry lines emitted — partner on a third ${hurt.lines.length} `
                 + `[${hurt.lines[0] || 'NONE'}]; partner at FULL ${full.lines.length} `
                 + `[${full.lines[0] || 'none'}] and its hp did not move (${full.hp}/${full.max}); `
                 + `no ability at all ${off.lines.length}` };
});

/* 2. KNOCK OFF'S ORDER, ASSERTED AS A LIFE — ROADMAP #80's open half. Showdown strips from
 *    `onAfterHit`, so a lethal Knock Off into a FULL-HP Focus Sash holder resolves damage first, the
 *    Sash saves at 1, and there is nothing left to take. Measured in the authority:
 *        |move|p1a: Garchomp|Knock Off|p2a: Ralts
 *        |-enditem|p2a: Ralts|Focus Sash
 *        |-damage|p2a: Ralts|1/103
 *    Stripping first kills the body, which is why this claim is a probe about STATE and not about a
 *    line order. THE CONTROL IS THE SAME LETHAL CLICK WITH NO SASH — it must faint, or "survived" is
 *    measuring a weak attack. */
probe('move', 'removesItem', 'Knock Off cannot take the Focus Sash that just saved the target', () => {
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'gengar', 'garchomp');
    f1.item = item; f1.curHP = f1.st.hp;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { hp: f1.curHP, dead: !!f1.fainted, item: f1.item };
  };
  const none = run(''), sash = run('focussash');
  return { works: none.dead && !sash.dead && sash.hp === 1 && sash.item === '',
           arms: { control: none, test: sash },
           detail: `a lethal Knock Off into a full-HP Gengar — no item ${none.dead ? 'FAINTED' : none.hp + ' hp'}; `
                 + `Focus Sash ${sash.dead ? 'FAINTED (the item was stripped BEFORE the damage)' : sash.hp + ' hp, item "' + sash.item + '"'}` };
});

/* 3. AND IT CANNOT TAKE A MEGA STONE. The format has exactly 75 items declaring an `onTakeItem` and
 *    every one is a mega stone: `return !item.megaStone?.[source.baseSpecies.baseSpecies]`. This
 *    engine took a Gengarite off a Gengar, which costs that body its mega for the rest of the battle.
 *    THE CONTROL IS THE SAME STONE ON A BODY IT DOES NOT BELONG TO, which must still be knocked off —
 *    a refusal keyed on "is it a mega stone" rather than on "is it THIS body's" would pass without it,
 *    and that is the over-match the derivation was written to avoid. */
probe('move', 'takesTargetItem', 'a mega stone cannot be knocked off the body it belongs to', () => {
  const run = (sp) => {
    const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', sp, 'garchomp');
    unfaintable(f1); f1.item = 'gengarite';
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return f1.item;
  };
  const other = run('garchomp'), owner = run('gengar');
  return { works: other === '' && owner === 'gengarite',
           arms: { control: other, test: owner },
           detail: `Knock Off a Gengarite — off a GARCHOMP it leaves "${other}" (must be empty, it is `
                 + `not that body's stone); off a GENGAR it leaves "${owner}" (must still be there)` };
});

/* 4. THE PINCH BERRY IS AN `onUpdate`, NOT A RESIDUAL — 13,079 uses. `eachEvent('Update')` runs after
 *    every action and again inside `spreadMoveHit`, so the berry is eaten BETWEEN the two attackers of
 *    a double. Heal and damage commute, so a body that lives either way ends on the same HP and this
 *    reads as a missing `|-enditem|` and nothing more. The case that does not commute is a LIFE: two
 *    hits that together exceed the body's HP but not its HP plus a quarter.
 *    THE CONTROL IS THE SAME PAIR OF HITS WITH NO BERRY, which must kill. */
probe('item', 'healsAtThreshold', 'the Sitrus is eaten BETWEEN the two attackers, so the second hit is survived', () => {
  /* THE HP IS STAGED SO THAT ALL THREE THINGS ARE TRUE AT ONCE, and none of them is incidental: the
   * FIRST Scald must drop it below half (or the berry has no reason to fire), the two together must
   * exceed its HP (or it lives whatever the engine does), and the two together must NOT exceed its HP
   * plus the berry's quarter (or it dies whatever the engine does). A 173 HP Corviknight on 140
   * taking two 80s is the window; the arms print it. */
  const run = (item) => {
    const { me, ally, f1, f2, S } = board('milotic', 'milotic', 'corviknight', 'garchomp');
    f1.item = item; f1.curHP = Math.round(f1.st.hp * 0.81);
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'scald', f1, S.field)], [ally, M.playerAction(ally, 'scald', f1, S.field)]]),
      PASS2(f1, f2));
    return { hp: f1.curHP, dead: !!f1.fainted, item: f1.item };
  };
  const none = run(''), berry = run('sitrusberry');
  return { works: none.dead && !berry.dead && berry.item === '',
           arms: { control: none, test: berry },
           detail: `a Corviknight on 81% taking TWO Scalds in one turn — no item `
                 + `${none.dead ? 'FAINTED' : none.hp + ' hp'}; Sitrus `
                 + `${berry.dead ? 'FAINTED (eaten too late to matter)' : berry.hp + ' hp, berry spent'}` };
});

/* 5. THE DOLL AND THE COST ROUND DIFFERENTLY, AND THIS PROBE ASSERTED THE WRONG ONE.
 *
 * ROADMAP #81 WIRE 12 — INVERTED. WIRE 7 wrote this probe against a quoted source line reading
 * `this.effectState.hp = Math.ceil(target.maxhp / 4)`. **data/moves.ts:18328 says `Math.floor`.**
 * Staged against the authority and read straight out of the live volatile rather than inferred from
 * how many hits broke it: a 137 HP Heliolisk's Shed Tail doll is **34** and a 195 HP Farigiraf's
 * Substitute doll is **48** — floor in both, where ceil would give 35 and 49. So WIRE 7 moved a
 * mechanic that had been RIGHT, and this probe went green on the move because it asserted the same
 * misquote. Both roundings now come out of `tag_dex` (`substitute.rounds`, `costsUserHP.rounds`), so
 * a third reading of that line by hand cannot happen.
 *
 * THE TWO ARMS ARE STILL THE COST AND THE DOLL, and they still have to DIFFER — for Substitute they
 * are maxhp/4 and maxhp/4 under two different roundings, which agree on an even-quarter body. That is
 * why the arms are taken from SHED TAIL, whose cost is ceil(maxhp/2) and whose doll is
 * floor(maxhp/4): two genuinely different numbers, from two derivations, on one click.
 * THE CONTROL IS AN EVEN-QUARTER BODY, where the roundings agree and the probe must NOT fire. */
probe('move', 'substitute', 'the doll is a ROUNDED-DOWN quarter, and Shed Tail\'s cost is rounded UP', () => {
  /* ROADMAP #81 WIRE 12 -- the doll is read off WHOEVER HOLDS IT. Shed Tail hands it to the body
     that comes in, so reading `me._sub` would report 0 for one of the two members and look like the
     doll was never built. `board()` seeds a bench so the Shed Tail arm has somewhere to go. */
  const run = (sp, moveId) => {
    const me = bare(sp), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('garchomp');
    const benchA = bare('emolga');
    const S = M.battleInit([me, ally, benchA], [f1, f2], { seeded: true });
    const hp0 = me.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, moveId || 'substitute', f1, S.field)], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    const holder = S.actA[0];
    return { max: me.st.hp, sub: holder ? holder._sub : 0, paid: hp0 - me.curHP };
  };
  /* Garchomp is 183 in this format's SP block: 183/4 = 45.75, so ceil 46 and floor 45 DISAGREE and
     an engine that rounded the doll the other way is caught rather than tied. */
  const odd = run('garchomp');
  const okOdd = odd.sub === Math.floor(odd.max / 4) && odd.paid === Math.floor(odd.max / 4)
             && Math.ceil(odd.max / 4) !== Math.floor(odd.max / 4);
  /* SHED TAIL, whose two numbers are genuinely different: ceil(max/2) paid against floor(max/4) held.
     Heliolisk is 137 — 68.5 and 34.25, so both roundings bite and in OPPOSITE directions. */
  const shed = run('heliolisk', 'shedtail');
  const okShed = shed.paid === Math.ceil(shed.max / 2) && shed.sub === Math.floor(shed.max / 4)
              && Math.ceil(shed.max / 2) !== Math.floor(shed.max / 2);
  /* the control: a body whose max HP divides by four exactly, where the two roundings agree */
  const ev = { max: 200 };
  const evenAgrees = Math.ceil(ev.max / 4) === Math.floor(ev.max / 4);
  return { works: okOdd && okShed && evenAgrees,
           arms: { control: shed.paid, test: shed.sub },
           detail: `a ${odd.max} HP Garchomp clicking Substitute — PAID ${odd.paid} and the doll is `
                 + `${odd.sub} (floor is ${Math.floor(odd.max / 4)}, ceil ${Math.ceil(odd.max / 4)}; `
                 + `the authority builds the FLOOR). A ${shed.max} HP Heliolisk clicking Shed Tail — `
                 + `PAID ${shed.paid} (ceil(max/2) = ${Math.ceil(shed.max / 2)}) and the doll it `
                 + `leaves behind is ${shed.sub} (floor(max/4) = ${Math.floor(shed.max / 4)})` };
});

/* 6. PROTEAN CONVERTS BEFORE THE HIT, SO THE MOVE GETS THE NEW STAB. WIRE 54 placed the conversion
 *    after the move resolved and called that "the wrong order by a hair". Measured: no ability 123,
 *    Protean 123 — the ability's whole offensive half was worth EXACTLY ZERO. The defensive half was
 *    always right, which is why the existing `typeBecomesMoveType` probe (types after the turn) is
 *    green and cannot see this. THE CONTROL IS THE SAME BODY WITH NO ABILITY. */
probe('ability', 'typeBecomesMoveType', 'Protean gives the move it converts into its STAB', () => {
  const run = (ab) => {
    const { me, ally, f1, f2, S } = board('meowscarada', 'incineroar', 'ceruledge', 'garchomp');
    me.ability = ab; unfaintable(f1);
    const before = f1.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'earthquake', f1, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return before - f1.curHP;
  };
  const control = run('none'), test = run('protean');
  return { works: control > 0 && test > control * 1.4,
           arms: { control, test },
           detail: `Earthquake (Ground — a type Meowscarada does not have) into an unfaintable `
                 + `Ceruledge: no ability ${control}, Protean ${test} (must be ~x1.5, the STAB the `
                 + `conversion buys)` };
});

/* 7. A REDIRECT ANNOUNCES NOTHING, AND AN ABILITY REDIRECT ANNOUNCES AN `|-activate|`. Follow Me's and
 *    Rage Powder's conditions add exactly one line — `|-singleturn|X|move: Follow Me` on the turn the
 *    move is USED — and `onFoeRedirectTarget` adds none; Lightning Rod's `onAnyRedirectTarget` adds
 *    `|-activate|X|ability: Lightning Rod`. This engine had them exactly swapped.
 *    THE CONTROL IS THE SAME BOARD WITH NO REDIRECTOR: the attack must still announce itself, or this
 *    is watching "the trace is empty". */
probe('move', 'redirects', 'a Follow Me redirect adds no line, and a Lightning Rod redirect adds an -activate', () => {
  const run = (foeBAbility, foeBMove) => {
    /* THE AIMED BODY IS CORVIKNIGHT, WHICH TAKES ELECTRIC AT 2x — the same correction the
     * `redirectsType` probe next door already carries. Aiming at a Ground type would make the whole
     * turn a no-op and any announcement claim vacuous. */
    const { me, ally, f1, f2, S } = board('raichu', 'incineroar', 'corviknight', 'milotic');
    if (foeBAbility) f2.ability = foeBAbility;
    unfaintable(f1); unfaintable(f2);
    const trace = []; S._trace = trace;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'thunderbolt', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }],
               [f2, foeBMove ? M.playerAction(f2, foeBMove, f2, S.field) : { kind: 'pass' }]]));
    return trace.filter(l => /^\|-(activate|ability)\|/.test(l));
  };
  const plain = run(null, null);
  const drawn = run(null, 'followme');
  const rod = run('lightningrod', null);
  return { works: plain.length === 0 && drawn.length === 0
                  && rod.length === 1 && /^\|-activate\|/.test(rod[0]) && /lightningrod/.test(rod[0]),
           arms: { control: drawn.length, test: rod.length },
           detail: `announcement lines on a redirected Thunderbolt — no redirector ${plain.length}; `
                 + `Follow Me ${drawn.length} [${drawn[0] || 'none'}] (Showdown writes none); `
                 + `Lightning Rod ${rod.length} [${rod[0] || 'NONE'}]` };
});

/* ================= ROADMAP #81 WIRE 9 / ROADMAP #84 ================================================
 *
 * TWO CLAIMS, MEASURED APART, and the first one turned out not to be the claim the roadmap made.
 *
 * The roadmap read the release ladder's largest surviving cause — `|-miss|ATT|TGT <> |-fail|ATT`,
 * 114 games in four slot spellings — as an ANNOUNCEMENT defect: we collapse a miss into a fail and
 * drop the target. Staged in both engines it is a STATE defect and a much larger one.
 * `playerAction()` prices an attack with `dmgRange(me, target, ...)`, so its damaging branch is
 * gated on `target` being non-null — and a SPREAD move has no target to name. Showdown's own
 * request offers none (`allAdjacentFoes` / `allAdjacent` carry no target field), so every driver
 * that asks Showdown what is legal hands this engine a null, the click falls through the whole
 * status chain, and Heat Wave becomes `{kind:'affect'}` — a no-op turn that emits a bare `|-fail|`.
 * Earthquake becomes `{kind:'pass'}` and emits nothing at all.
 *
 * That is 56,524 corpus uses across 33 legal moves — 20% of every damaging click in the format —
 * dealing ZERO. The `-fail` the ladder saw is the residue of it, visible only because Mode A's pin
 * misses every sub-100-accuracy move on BOTH sides, so the 90-accuracy spread moves were the ones
 * that reached the stream as a divergence rather than as a damage hole.
 *
 * `spreadTargetless(` is DECLARED IN REALTURN, deliberately and with its reason, exactly as
 * `moveLines(` and `entryLines(` were: it stages a real doubles board through `battleInit`, spends a
 * real turn through `battleTurn` and reads BOTH foes' HP and the emitted stream. It cannot be a
 * direct call — the whole defect is in what `playerAction` builds and what the turn loop then does
 * with it, and no direct call to `dmgRange` can see either half. */
const spreadTargetless = (moveId, named, roll) => {
  const me = bare('gholdengo'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('milotic');
  unfaintable(f1); unfaintable(f2); unfaintable(ally);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const trace = []; S._trace = trace;
  const h1 = f1.curHP, h2 = f2.curHP;
  M.battleTurn(S, roll || rng5,
    new Map([[me, M.playerAction(me, moveId, named ? f1 : null, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return { a: h1 - f1.curHP, b: h2 - f2.curHP,
           miss: trace.filter(l => l.startsWith('|-miss|')),
           fail: trace.filter(l => l.startsWith('|-fail|')) };
};

/* THE CONTROL IS THE SAME CLICK WITH THE TARGET NAMED, on the same board, and it is not optional:
 * "both foes took damage" is also what an engine that ignores the target argument entirely prints,
 * and the assertion here is an EQUALITY between the two arms. So the arms are the two HP pairs, and
 * a third reading — a SINGLE-target move with the target withheld — is asserted to still be a no-op,
 * because Showdown rejects that choice and an engine that aimed it for you would be inventing a
 * decision nobody made. */
probe('move', 'spreadFoes', 'a spread move clicked with NO named target still hits both foes', () => {
  const named = spreadTargetless('makeitrain', true);
  const bare_ = spreadTargetless('makeitrain', false);
  const single = spreadTargetless('shadowball', false);
  return { works: named.a > 0 && named.b > 0 && bare_.a === named.a && bare_.b === named.b
                  && single.a === 0 && single.b === 0,
           /* THE ARMS ARE THE SINGLE-TARGET CLICK AGAINST THE SPREAD ONE, both with the target
            * withheld — not the two spread arms, which this probe asserts are EQUAL and which the
            * harness would rightly call hollow. What they clear is the wrong fix: an engine that
            * simply aimed every targetless click at the nearest foe would also make both foes take
            * damage, and would make the Shadow Ball arm non-zero. */
           arms: { control: [single.a, single.b], test: [bare_.a, bare_.b] },
           detail: `Make It Rain, target NAMED -> ${named.a}/${named.b}; target WITHHELD -> `
                 + `${bare_.a}/${bare_.b} (Showdown's request names no target for allAdjacentFoes); `
                 + `a single-target Shadow Ball with the target withheld stays a no-op `
                 + `${single.a}/${single.b}` };
});

/* AND THE ANNOUNCEMENT HALF, WHICH IS THE CLAIM THE ROADMAP ACTUALLY MADE. `hitStepAccuracy` writes
 * `this.battle.add('-miss', pokemon, target)` once PER TARGET (sim/battle-actions.ts:738), so a
 * spread move that misses two bodies writes two lines and each NAMES the body it missed. This engine
 * rolls once for the whole move — a declared divergence it keeps — and wrote one bare `|-miss|` with
 * an empty target field.
 *
 * THE CONTROL IS THE SAME CLICK ON A WINNING ROLL, which must emit NO `-miss` and real damage. A
 * probe asserting only "two -miss lines appear" passes on an engine that can no longer hit at all. */
probe('move', 'spreadFoes', 'a spread move that misses names every target it missed', () => {
  const missed = spreadTargetless('heatwave', false, rngLose);
  const hit = spreadTargetless('heatwave', false, () => 0);
  const named = spreadTargetless('heatwave', true, rngLose);
  /* THE SHAPE IS ASSERTED, NOT JUST THE COUNT: `|-miss|ATTACKER|TARGET` is four fields and the
   * fourth must NAME a foe slot. A bare `|-miss|p1a: X` is three, which is exactly what this engine
   * emitted, and a count-only assertion would have passed on it the moment a second roll appeared. */
  const ok = (r) => r.miss.length === 2
    && r.miss.every(l => l.split('|').length === 4 && /^p2[ab]: /.test(l.split('|')[3]));
  return { works: ok(missed) && ok(named)
                  && missed.a === 0 && missed.b === 0 && hit.miss.length === 0
                  && hit.a > 0 && hit.b > 0 && missed.fail.length === 0,
           arms: { control: hit.miss.length, test: missed.miss.length },
           detail: `Heat Wave on a LOSING roll emitted ${missed.miss.length} -miss line(s) `
                 + `[${missed.miss.join(' ') || 'NONE'}] and ${missed.fail.length} -fail, dealing `
                 + `${missed.a}/${missed.b}; on a WINNING roll ${hit.miss.length} -miss and `
                 + `${hit.a}/${hit.b} damage; with the target named ${named.miss.length}` };
});

/* AND THE CLASS THE FIX OPENED. Making the family resolve made it reach code it had never reached:
 * the ladder's WIRE 9 rung grew a whole new divergence class (`-activate: a different body`, 18
 * games) because Wide Guard's announcement named NOBODY — `|-activate||move: Wide Guard`, an empty
 * body field, because the engine emptied its target list before writing the line. Showdown's
 * `add('-activate', target, 'move: Wide Guard')` fires inside the per-target TryHit event, so there
 * is one line per shielded body and each names it.
 *
 * A STREAM PROBE, LABELLED AS ONE: the state is identical either way — both engines block the move
 * and both deal zero — so this cannot be read off HP, and the probe asserts the zero as well so
 * "no lines" cannot come to mean "no block". */
probe('move', 'oneTurnGuard', 'Wide Guard names each body it shielded, one line per body', () => {
  const run = (guard) => {
    const me = bare('charizard'), ally = bare('incineroar');
    const f1 = bare('garchomp'), f2 = bare('milotic');
    unfaintable(f1); unfaintable(f2);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    const h1 = f1.curHP, h2 = f2.curHP;
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, 'heatwave', null, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, guard ? M.playerAction(f1, 'wideguard', null, S.field) : { kind: 'pass' }],
               [f2, { kind: 'pass' }]]));
    return { lines: trace.filter(l => /^\|-activate\|.*Wide Guard/.test(l)),
             dealt: (h1 - f1.curHP) + (h2 - f2.curHP) };
  };
  const on = run(true), off = run(false);
  return { works: on.lines.length === 2 && on.dealt === 0
                  && on.lines.every(l => /^\|-activate\|p2[ab]: /.test(l))
                  && off.lines.length === 0 && off.dealt > 0,
           arms: { control: off.lines.length, test: on.lines.length },
           detail: `Heat Wave into a Wide Guard — ${on.lines.length} -activate line(s) `
                 + `[${on.lines.join(' ') || 'NONE'}] and ${on.dealt} damage dealt; with no Wide Guard `
                 + `${off.lines.length} line(s) and ${off.dealt} damage` };
});

/* AND THE OTHER THING THE FAMILY REACHED FOR THE FIRST TIME: WHO A QUAKE HITS FIRST.
 *
 * `Pokemon.getMoveTargets` (sim/pokemon.ts:809) builds an `allAdjacent` list allies-first and falls
 * through to the foes, so Showdown writes `[spread] p1b,p2a,p2b` — your own partner, then both
 * opponents. This engine appended the partner LAST. Measured in the authority before the line moved,
 * not inferred from the switch statement.
 *
 * A STREAM PROBE, LABELLED: the three bodies take the same damage either way, so the total is
 * asserted beside the order and "the right order" cannot come to mean "the quake stopped hitting
 * somebody". The CONTROL is a `spreadFoes` move on the same board, whose ally is not hit at all and
 * whose order must therefore be foes-only — without it this passes on an engine that simply reversed
 * every target list. */
probe('move', 'spreadAll', 'a quake resolves against your own partner FIRST, then the foes', () => {
  const run = (mv) => {
    const me = bare('garchomp'), ally = bare('incineroar');
    const f1 = bare('milotic'), f2 = bare('tyranitar');
    unfaintable(ally); unfaintable(f1); unfaintable(f2);
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
    const trace = []; S._trace = trace;
    const h = [ally.curHP, f1.curHP, f2.curHP];
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, mv, null, S.field)], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    return { order: trace.filter(l => /^\|-damage\|/.test(l)).map(l => l.split('|')[2].split(':')[0]),
             dealt: (h[0] - ally.curHP) + (h[1] - f1.curHP) + (h[2] - f2.curHP) };
  };
  const quake = run('earthquake'), slide = run('rockslide');
  return { works: JSON.stringify(quake.order) === JSON.stringify(['p1b', 'p2a', 'p2b'])
                  && JSON.stringify(slide.order) === JSON.stringify(['p2a', 'p2b'])
                  && quake.dealt > 0 && slide.dealt > 0,
           arms: { control: slide.order, test: quake.order },
           detail: `-damage order — Earthquake (spreadAll) [${quake.order.join(',')}] dealing `
                 + `${quake.dealt} in total; Rock Slide (spreadFoes, no ally packet) `
                 + `[${slide.order.join(',')}] dealing ${slide.dealt}` };
});

/* ---- ROADMAP #81 WIRE 10 — THE SHAPE OF A HIT, NOT A MECHANIC IN IT ------------------------------
 *
 * Showdown resolves a move in STEPS ACROSS THE WHOLE TARGET ARRAY. `trySpreadMoveHit`
 * (sim/battle-actions.ts:550-578) runs eight named steps and EACH ONE walks every target before the
 * next begins; inside the last of them `spreadMoveHit` (:1023) is itself numbered 0-6 — substitute,
 * getSpreadDamage, spreadDamage, runMoveEffects, selfDrops, secondaries, forceSwitch — and every one
 * of those is a loop over the array too. This engine resolved a move TARGET AT A TIME.
 *
 * STAGED IN THE AUTHORITY BEFORE A LINE MOVED, Gholdengo's Icy Wind into two Milotic:
 *     |-resisted|p2a: Milotic|1        <- every effectiveness line
 *     |-resisted|p2b: Milotic2|1
 *     |-damage|p2a: Milotic|160/170    <- then every damage line
 *     |-damage|p2b: Milotic2|161/170
 *     |-unboost|p2a: Milotic|spe|1     <- then every secondary
 *     |-unboost|p2b: Milotic2|spe|1
 * against this engine's `-resisted(a) -damage(a) -unboost(a) -resisted(b) -damage(b) -unboost(b)`.
 *
 * IT IS NOT ONLY A STREAM CLAIM, WHICH IS WHY THE FIRST PROBE BELOW READS HP. A per-target loop lets
 * everything that happens to target A land before target B's damage is even PRICED — so the first
 * probe measures a KO boost leaking forward, which is a number, not a line. */

/* 1. THE STATE HALF. `beastboost`/`eelevate` fire from `onSourceAfterFaint`, and `AfterFaint` is run
 *    by `faintMessages` (sim/battle.ts:2598) — which `hitStepMoveHitLoop` calls AFTER the whole hit
 *    loop (battle-actions.ts:972). So a spread move that kills its first target CANNOT be holding a
 *    +1 by the time it prices its second. This engine faints, boosts and then prices, and the second
 *    foe took 50 where it should take 33.
 *
 * THE ARMS ARE NOT THE TWO DAMAGE FIGURES — the probe asserts those are EQUAL, and the harness would
 * rightly call that hollow. They are [second foe's damage, KO boost that actually fired], so the
 * varied knob is shown to have MOVED something (0 -> +1 stage) while the damage it must not reach
 * stayed put. A third arm runs the same kill with NO ability, proving the faint alone is not what
 * this measures. */
const spreadKOLeak = (ability, killFirst) => {
  const me = bare('gholdengo'); me.ability = ability;
  const ally = bare('incineroar'); unfaintable(ally);
  const f1 = bare('milotic'), f2 = bare('milotic');
  unfaintable(f2);
  if (killFirst) f1.curHP = 1; else unfaintable(f1);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const trace = []; S._trace = trace;
  const h2 = f2.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'makeitrain', null, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  /* THE KO BOOST IS COUNTED OFF THE STREAM, NOT OFF `boosts`. Eelevate raises the HIGHEST raw stat,
   * which on Gholdengo is Special Attack — the same stat Make It Rain drops by two — so a stage read
   * off the body cannot tell "+1 fired and was cancelled" from "+1 never fired", and the first cut of
   * this probe reported 0 on the arm where the boost demonstrably happened. */
  return { b: h2 - f2.curHP, died: f1.fainted,
           ko: trace.filter(l => /^\|-boost\|.*eelevate/.test(l)).length };
};
probe('move', 'spreadFoes', 'a spread move prices every target before any of them faints', () => {
  const koBoost = spreadKOLeak('eelevate', true);
  const noKO = spreadKOLeak('eelevate', false);
  const plainKO = spreadKOLeak('none', true);
  return { works: noKO.b > 0 && koBoost.died && !noKO.died
                  && koBoost.ko === 1 && noKO.ko === 0
                  && koBoost.b === noKO.b && plainKO.b === noKO.b,
           arms: { control: [noKO.b, noKO.ko], test: [koBoost.b, koBoost.ko] },
           detail: `Make It Rain into two Milotic — first foe SURVIVES: second takes ${noKO.b}, KO `
                 + `boost ${noKO.ko}; first foe DIES: second takes ${koBoost.b}, KO boost `
                 + `${koBoost.ko} (the boost fired and must not have reached the second target); `
                 + `same kill with no ability: ${plainKO.b}` };
});

/* 2. THE STREAM HALF, AND IT IS THE WHOLE STEP LIST IN ONE READING. The control is the SAME click on
 *    a single target, whose shape must stay `eff,dmg,sec` — without it this passes on an engine that
 *    simply stopped emitting effectiveness lines, which satisfies "every eff precedes every dmg"
 *    vacuously. */
const stepShape = (moveId, twoFoes) => {
  const me = bare('gholdengo'), ally = bare('incineroar'); unfaintable(ally);
  const f1 = bare('garchomp'), f2 = bare('milotic');
  unfaintable(f1); unfaintable(f2);
  if (!twoFoes) { f2.fainted = true; f2.curHP = 0; }
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const trace = []; S._trace = trace;
  const h1 = f1.curHP, h2 = f2.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, null, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  const tagOf = (l) => /^\|-(supereffective|resisted)\|/.test(l) ? 'eff'
                     : /^\|-damage\|/.test(l) ? 'dmg'
                     : /^\|-unboost\|p2/.test(l) ? 'sec' : null;
  return { shape: trace.map(tagOf).filter(Boolean).join(','), a: h1 - f1.curHP, b: h2 - f2.curHP };
};
probe('move', 'spreadFoes', 'a spread move runs each step over every target before the next step', () => {
  const both = stepShape('icywind', true);
  const one = stepShape('icywind', false);
  return { works: both.shape === 'eff,eff,dmg,dmg,sec,sec' && one.shape === 'eff,dmg,sec'
                  && both.a > 0 && both.b > 0 && one.a > 0 && one.b === 0,
           arms: { control: one.shape, test: both.shape },
           detail: `Icy Wind into two foes emitted [${both.shape}] dealing ${both.a}/${both.b} — `
                 + `Showdown's own order is eff,eff,dmg,dmg,sec,sec; into ONE foe [${one.shape}] `
                 + `dealing ${one.a}` };
});

/* 3. AND THE SHARP ONE. A target that FAINTS to the first damage packet must not interrupt the
 *    remaining steps: `spreadDamage` writes every `-damage` line and the faint is only ANNOUNCED
 *    later, by `faintMessages` after the loop. A per-target engine writes `dmg,faint,dmg`.
 *    The control is the same click with the first foe healthy — the shape must lose the faint and
 *    NOTHING else, and the second foe's damage must be identical in both. */
const spreadFaintOrder = (killFirst) => {
  const me = bare('gholdengo'), ally = bare('incineroar'); unfaintable(ally);
  const f1 = bare('milotic'), f2 = bare('milotic');
  unfaintable(f2);
  if (killFirst) f1.curHP = 1; else unfaintable(f1);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const trace = []; S._trace = trace;
  const h2 = f2.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'dazzlinggleam', null, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  const tagOf = (l) => /^\|-damage\|p2/.test(l) ? 'dmg' : /^\|faint\|p2/.test(l) ? 'faint' : null;
  return { shape: trace.map(tagOf).filter(Boolean).join(','), b: h2 - f2.curHP };
};
probe('move', 'spreadFoes', 'a target that faints to a spread hit does not interrupt the other target', () => {
  const kill = spreadFaintOrder(true), live = spreadFaintOrder(false);
  return { works: kill.shape === 'dmg,dmg,faint' && live.shape === 'dmg,dmg'
                  && kill.b > 0 && kill.b === live.b,
           arms: { control: live.shape, test: kill.shape },
           detail: `Dazzling Gleam into a 1 HP Milotic beside a healthy one — [${kill.shape}], the `
                 + `survivor taking ${kill.b}; with both healthy [${live.shape}], the same body `
                 + `taking ${live.b}` };
});

/* ---- ROADMAP #84 — SHOWDOWN SPLITS "MY MOVE DID NOT HAPPEN" IN TWO, AND THIS ENGINE HAD NEITHER ---
 *
 * `sim/battle-actions.ts:255` says it in a comment that names the move it matters for:
 *     false indicates that this counts as a move failing for the purpose of calculating
 *       Stomping Tantrum's base power
 *     null indicates the opposite, as the Pokemon didn't have an option to choose anything
 * and `stompingtantrum`'s basePowerCallback tests `pokemon.moveLastTurnResult === false` — strictly
 * false, so `null` and `undefined` both leave it at 75.
 *
 * EACH MEMBER WAS CHECKED INDIVIDUALLY AGAINST THE SOURCE rather than grouped from memory, because
 * the two groups are NOT "things that stopped you" versus "things you chose":
 *     false  flinch (conditions.ts:205), full paralysis (:43), freeze (:104), sleep (:76),
 *            Taunt (moves.ts), Throat Chop, Disable, no PP, a beforeMoveCallback, A MISS, a type
 *            immunity — anything that reaches trySpreadMoveHit with an explicit failure
 *     null   recharge (conditions.ts:372) — and PROTECT, which is the counter-intuitive one:
 *            protect's onTryHit returns `this.NOT_FAIL` (''), which is falsy but not `false`, so
 *            `atLeastOneFailure` stays false and battle-actions.ts:616 writes null
 *
 * MEASURED BEFORE ANYTHING CHANGED: medicham2 stored NO move result at all — not one boolean, not a
 * field, nothing. `moveResult` appears in the file exactly once, inside a comment. So Stomping
 * Tantrum was wrong in ONE direction only (it never doubled, 3,545 corpus uses), and the split was
 * not representable rather than mis-represented. */
const tantrumAfter = (setup) => {
  const me = bare('mudsdale'), ally = bare('incineroar');
  const f1 = bare('milotic'), f2 = bare('milotic');
  unfaintable(f1); unfaintable(f2); unfaintable(me); unfaintable(ally);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  /* TURN 1 — the thing that did or did not count as a failure. */
  setup(S, me, ally, f1, f2);
  /* TURN 2 — Stomping Tantrum, aimed, and the HP loss is the base power made visible. */
  const h = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'stompingtantrum', f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return h - f1.curHP;
};

probe('move', 'variablePower', 'a FLINCHED Stomping Tantrum doubles next turn and a RECHARGING one does not', () => {
  /* CLEAN: the user acted normally last turn, so the result is `true` and the move stays at 75. */
  const clean = tantrumAfter((S, me, ally, f1, f2) => {
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'stompingtantrum', f1, S.field)], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
  });
  /* FALSE: Fake Out flinches it. conditions.ts:205 returns false, so this counts. */
  const flinched = tantrumAfter((S, me, ally, f1, f2) => {
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'stompingtantrum', f1, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'fakeout', me, S.field)], [f2, { kind: 'pass' }]]));
  });
  /* NULL: Hyper Beam lands, the NEXT turn is the recharge. conditions.ts:372 returns null, so the
   * turn after the recharge must still be 75 — the whole point of the split. */
  const recharged = tantrumAfter((S, me, ally, f1, f2) => {
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'hyperbeam', f1, S.field)], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
    M.battleTurn(S, rng5, new Map([[me, M.playerAction(me, 'stompingtantrum', f1, S.field)], [ally, { kind: 'pass' }]]),
      PASS2(f1, f2));
  });
  return { works: clean > 0 && flinched >= clean * 1.8 && flinched <= clean * 2.2 && recharged === clean,
           arms: { control: clean, test: flinched },
           detail: `Stomping Tantrum into the same Milotic — after a clean turn ${clean}; after a Fake `
                 + `Out FLINCH ${flinched} (BeforeMove returned false, so it counts); after a RECHARGE `
                 + `turn ${recharged} (BeforeMove returned null, so it must not)` };
});

/* ---- ROADMAP #81 WIRE 11 — FOUR DEFECTS WILL READ OFF REAL DIVERGENCES, 2026-08-07 ---------------
 *
 * Each of the four is read from the official source, not from a summary, and each probe asserts
 * STATE — HP, the item slot, a stat stage, the Speed that decided who moved first.
 *
 *   1. `move.spreadHit` is set from the array that ENTERS the hit steps
 *      (sim/battle-actions.ts:551, before any step filters it).
 *   2. White Herb does three things and this engine did none of them (data/items.ts whiteherb,
 *      data/abilities.ts unburden).
 *   3. `DamagingHit` runs AFTER `spreadDamage` (sim/battle-actions.ts:1079 then :1117), and
 *      Aftermath's own gate is `!target.hp` — the HP AFTER the Sash, not the raw damage.
 *   4. `moveHit.crit` sets `ignoreNegativeOffensive` and `ignorePositiveDefensive`
 *      (sim/battle-actions.ts:1683-1691) and a crit ignores screens. It does NOT ignore burn.
 */

/* 1a. THE PROTECTING PARTNER. Will's live case exactly: Dazzling Gleam into a Protecting Pelipper
 *     beside an Archaludon read 130/165 in the authority against 118/165 here — 35 against 47, a
 *     ratio of 0.745. The shielded body is still ALIVE and still in `targets` when `spreadHit` is
 *     set, so the survivor eats the 0.75 anyway.
 *
 * THREE ARMS, because two cannot separate "the modifier is right" from "there is no modifier".
 * `both` is the ordinary spread hit, `shield` is the same with the partner behind a Protect and must
 * EQUAL it, and `alone` (1b) is the partner already fainted, which must be BIGGER. */
const gleamAt = (partner) => {
  const me = bare('gholdengo'), ally = bare('incineroar'); unfaintable(ally);
  const f1 = bare('archaludon'), f2 = bare('pelipper');
  unfaintable(f1); unfaintable(f2);
  if (partner === 'fainted') { f2.fainted = true; f2.curHP = 0; }
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const h1 = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'dazzlinggleam', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }],
             [f2, partner === 'protect' ? { kind: 'protect', mv: 'protect' } : { kind: 'pass' }]]));
  return { d: h1 - f1.curHP, partnerHP: f2.curHP, protectHeld: !!f2.protect };
};
probe('move', 'spreadFoes', 'a PROTECTING partner still costs the survivor the spread 0.75', () => {
  const both = gleamAt('alive'), shield = gleamAt('protect'), alone = gleamAt('fainted');
  const r = alone.d ? shield.d / alone.d : 0;
  /* The shielded partner must have taken NOTHING — otherwise "the survivor still eats the 0.75"
   * could be satisfied by a Protect that stopped protecting. */
  const shieldHeld = shield.protectHeld && shield.partnerHP === bare('pelipper').st.hp * 8;
  return { works: both.d > 0 && shield.d === both.d && alone.d > both.d && shieldHeld
                  && r > 0.72 && r < 0.78,
           arms: { control: alone.d, test: shield.d },
           detail: `Dazzling Gleam into Archaludon — partner alive and hit ${both.d}; partner behind `
                 + `a PROTECT ${shield.d} (must be the same: it is still in the target array); `
                 + `partner already FAINTED ${alone.d} (must be bigger — it was filtered out before `
                 + `the array entered, so no modifier). shield/alone = ${r.toFixed(3)}, and 0.75 is `
                 + `the number` };
});

/* 1b. THE OTHER HALF OF THE SAME RULE, AND IT WAS ALREADY RIGHT. `Side#allies()` filters `!!hp`
 *     before `getMoveTargets` builds the array, so a partner that has ALREADY fainted never enters
 *     it and the survivor takes FULL damage. This engine's `live(foes)` did the same thing for the
 *     same reason. Probed anyway, because "already correct" is a claim the census should carry
 *     rather than a sentence in a report — and because fix 1a is one line away from breaking it. */
probe('move', 'spreadFoes', 'an ALREADY-FAINTED partner removes the spread modifier entirely', () => {
  const both = gleamAt('alive'), alone = gleamAt('fainted');
  const r = alone.d ? both.d / alone.d : 0;
  return { works: both.d > 0 && alone.d > both.d && r > 0.72 && r < 0.78,
           arms: { control: both.d, test: alone.d },
           detail: `Dazzling Gleam into Archaludon — partner alive ${both.d}, partner fainted `
                 + `${alone.d}; ratio ${r.toFixed(3)} (0.75 = the modifier applies with two bodies `
                 + `in the array and not with one)` };
});

/* 2a. THE HERB IS CONSUMED AND THE NEGATIVE STAGE GOES *ON THE SWITCH-IN*. Observed live: Incineroar
 *     Intimidates a Sneasler, the authority writes `|-enditem|Sneasler|White Herb` then
 *     `|-clearnegativeboost|Sneasler|[silent]`, and this engine wrote nothing.
 *
 * AND THE DIAGNOSIS THAT SURVIVED THE PROBE IS NOT THE ONE IT STARTED WITH. WIRE 56 had already
 * wired the herb — at the RESIDUAL, and only there. `data/items.ts` gives whiteherb FOUR triggers:
 * `onAnySwitchIn` (priority -2), `onAnyAfterMega`, `onAnyAfterMove` and `onResidual`. Three of the
 * four were missing, so the herb was a whole turn late: the Intimidate landed, the body played the
 * entire turn at -1, and only then did the item come off. 2b below is the residual path and is LIVE
 * on the engine as it stood; this one and 2c are the three missing triggers.
 *
 * REAL ENTRY EFFECTS — `seeded` is NOT passed, so battleInit runs the Intimidate, and NO turn is
 * spent, so the residual cannot supply the answer. The control holds LEFTOVERS rather than nothing,
 * so "the item slot emptied" is a real claim about this item and not about a body that never had
 * one. */
const herbIntim = (item) => {
  const me = bare('incineroar'); me.ability = 'intimidate';
  const ally = bare('corviknight');
  const f1 = bare('sneasler'); f1.item = item; f1.ability = 'none';
  const f2 = bare('garchomp');
  M.battleInit([me, ally], [f1, f2], {});
  return { at: f1.boosts.at, item: f1.item };
};
probe('item', 'restoresStats', 'White Herb clears the Intimidate drop and is consumed', () => {
  const control = herbIntim('leftovers'), test = herbIntim('whiteherb');
  return { works: control.at === -1 && control.item === 'leftovers'
                  && test.at === 0 && test.item === '',
           arms: { control: [control.at, control.item], test: [test.at, test.item] },
           detail: `Incineroar Intimidates Sneasler — with Leftovers atk ${control.at}, still `
                 + `holding "${control.item}"; with a White Herb atk ${test.at}, holding `
                 + `"${test.item}" (both halves: the stage AND the slot)` };
});

/* 2b. NEGATIVE ONLY, AND THIS ONE WAS ALREADY LIVE — it is WIRE 56's residual path and it is probed
 *     here so the census carries it while 2a and 2c move the timing underneath it. The handler walks
 *     `pokemon.boosts` and writes a zero for every entry `< 0`; a positive stage is not in the table
 *     it hands to `setBoost`. An implementation that cleared ALL boosts would pass 2a and would throw
 *     away a Swords Dance, so the positive arm is the whole point of this one. */
const herbMixed = (item) => {
  const { me, ally, f1, f2, S } = board('incineroar', 'corviknight', 'sneasler', 'garchomp');
  f1.item = item; f1.boosts.at = 2; f1.boosts.sp = -1; f1.boosts.df = -2;
  M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  return { at: f1.boosts.at, sp: f1.boosts.sp, df: f1.boosts.df, item: f1.item };
};
probe('item', 'restoresStats', 'White Herb restores NEGATIVE stages only and leaves a positive one', () => {
  const control = herbMixed('leftovers'), test = herbMixed('whiteherb');
  return { works: control.at === 2 && control.sp === -1 && control.df === -2
                  && test.at === 2 && test.sp === 0 && test.df === 0 && test.item === '',
           arms: { control: [control.at, control.sp, control.df],
                   test: [test.at, test.sp, test.df] },
           detail: `Sneasler staged at atk +2 / spe -1 / def -2 — with Leftovers ${control.at},`
                 + `${control.sp},${control.df}; with a White Herb ${test.at},${test.sp},${test.df} `
                 + `(the +2 must SURVIVE — clearing everything would pass the other probe)` };
});

/* 2c. THE DANGEROUS HALF, AND IT IS A SPEED TIER CHANGE MID-TURN. `unburden.onAfterUseItem` adds the
 *     volatile the moment the herb is spent, and the volatile is `onModifySpe -> chainModify(2)`. So
 *     an Intimidate can make the body it just weakened move FIRST. A herb that only comes off at the
 *     residual gets the Speed right for the NEXT turn and wrong for the turn that actually mattered.
 *
 * READ AS AN OUTCOME, not as a Speed number — the same shape the Choice Scarf probe uses and for the
 * same reason. The Intimidator is left on 1 HP: if Sneasler really got there first it dies before it
 * can act and Sneasler takes nothing back. Both arms are Sneasler with Unburden and an explicit
 * Speed; the ITEM is the one varied thing. */
const herbUnburden = (item) => {
  const me = bare('sneasler'); me.item = item; me.ability = 'unburden';
  me.st = Object.assign({}, me.st, { sp: 100 });
  const ally = bare('corviknight');
  const f1 = bare('incineroar'); f1.ability = 'intimidate';
  f1.st = Object.assign({}, f1.st, { sp: 150 }); f1.curHP = 1;
  const f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], {});
  const mine = me.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'closecombat', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, M.playerAction(f1, 'flareblitz', me, S.field)], [f2, { kind: 'pass' }]]));
  return { took: mine - me.curHP, foeDead: !!f1.fainted, at: me.boosts.at };
};
probe('ability', 'speedOnItemLoss', 'losing a White Herb to Intimidate procs Unburden in the same turn', () => {
  const control = herbUnburden('leftovers'), test = herbUnburden('whiteherb');
  return { works: control.took > 0 && test.took === 0 && test.foeDead && control.foeDead
                  && test.at === 0 && control.at === -1,
           arms: { control: control.took, test: test.took },
           detail: `Sneasler 100 Speed vs an Intimidating Incineroar on 1 HP at 150 — with Leftovers `
                 + `Sneasler took ${control.took} (it moved second) and sits at atk ${control.at}; `
                 + `with a White Herb it took ${test.took} (the herb went, Unburden doubled 100 to `
                 + `200, it moved first) and sits at atk ${test.at}` };
});

/* 3a. THE STATE HALF OF THE CONTACT-PUNISH ORDER, and it is not the announcement. Aftermath's gate
 *     is `if (!target.hp && ...)` — the HP AFTER the damage landed. This engine paid the punish
 *     BEFORE `tg.curHP -= dmg` and gated it on the RAW damage, so a Focus Sash holder that survives
 *     at 1 detonated anyway and cost the attacker a quarter of its maximum HP.
 *
 * Read on the ATTACKER's HP, which is the only body Aftermath touches. */
const aftermathHit = (item) => {
  const me = bare('tyranitar');
  const ally = bare('corviknight');
  const f1 = bare('milotic'); f1.ability = 'aftermath'; f1.item = item;
  f1.st = Object.assign({}, f1.st, { hp: 20 }); f1.curHP = 20;
  const f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const mine = me.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return { paid: mine - me.curHP, left: f1.curHP, dead: !!f1.fainted };
};
probe('ability', 'punishesAttacker', 'Aftermath reads the post-Sash HP, so a survivor does not detonate', () => {
  const control = aftermathHit(''), test = aftermathHit('focussash');
  const quarter = Math.floor(bare('tyranitar').st.hp / 4);
  return { works: control.dead && control.paid === quarter
                  && !test.dead && test.left === 1 && test.paid === 0,
           arms: { control: control.paid, test: test.paid },
           detail: `Tyranitar Knock Off into an Aftermath Milotic on 20 HP — no item: it DIES `
                 + `(${control.left} left) and Tyranitar pays ${control.paid} (a quarter is `
                 + `${quarter}); Focus Sash: it SURVIVES on ${test.left} and Tyranitar pays `
                 + `${test.paid}` };
});

/* 3b. THE ORDER ITSELF. `spreadDamage` (battle-actions.ts:1079) moves the HP; `runEvent('DamagingHit')`
 *     (:1117) is four numbered steps later. Observed live: Tyranitar Knock Offs a Garchomp and the
 *     authority writes `|-damage|Garchomp|78/183` and THEN Rough Skin's recoil onto Tyranitar; this
 *     engine wrote the recoil first, with no speed tie anywhere near it (106 against 161).
 *
 * A STREAM READING WITH THE HP ASSERTED BESIDE IT, which is the house rule for an order probe: both
 * bodies must have lost exactly what they lost before, so "the right order" cannot come to mean "the
 * toll stopped being paid". The control is the SAME click into a body with no punish ability, whose
 * stream must carry the target's damage and NO attacker damage at all. */
const punishOrder = (defAbility) => {
  const me = bare('tyranitar'), ally = bare('corviknight');
  const f1 = bare('garchomp'); f1.ability = defAbility; unfaintable(f1);
  const f2 = bare('milotic');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const trace = []; S._trace = trace;
  const h1 = f1.curHP, hm = me.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  const shape = trace.map(String)
    .map(l => /^\|-damage\|p2a/.test(l) ? 'target' : /^\|-damage\|p1a/.test(l) ? 'attacker' : null)
    .filter(Boolean).join(',');
  return { shape, d: h1 - f1.curHP, paid: hm - me.curHP };
};
probe('ability', 'punishesAttacker', 'the contact punish is paid AFTER the damage lands, not before', () => {
  const control = punishOrder('none'), test = punishOrder('roughskin');
  const eighth = Math.floor(bare('tyranitar').st.hp / 8);
  return { works: control.shape === 'target' && control.paid === 0 && control.d > 0
                  && test.shape === 'target,attacker' && test.paid === eighth
                  && test.d === control.d,
           arms: { control: control.shape, test: test.shape },
           detail: `Tyranitar Knock Off into Garchomp — no ability: damage lines [${control.shape}], `
                 + `Tyranitar paid ${control.paid}; Rough Skin: [${test.shape}], paid ${test.paid} `
                 + `(an eighth is ${eighth}); the target lost ${control.d} and ${test.d}, which must `
                 + `be equal` };
});

/* 4a. A CRIT IGNORES THE ATTACKER'S NEGATIVE OFFENSIVE STAGES — the expensive one, because
 *     Intimidate is on 31,129 observed sets. `ignoreOffensive = (ignoreNegativeOffensive &&
 *     atkBoosts < 0)`, so an Intimidated attacker landing a crit hits at FULL Attack.
 *
 * A REAL INTIMIDATE, not a hand-set stage: the foe slot holds an Incineroar in BOTH arms and only
 * its ability changes, and the probe asserts the stage actually moved so a silent no-op cannot pass.
 * Flower Trick is pCrit 1 and Knock Off is the plain physical control from the same body, so the two
 * differ in the crit and in nothing else. */
const critIntim = (moveId, intimidate) => {
  const me = bare('meowscarada'), ally = bare('corviknight');
  const f1 = bare('garchomp'); unfaintable(f1);
  const f2 = bare('incineroar'); f2.ability = intimidate ? 'intimidate' : 'none';
  const S = M.battleInit([me, ally], [f1, f2], {});
  const h1 = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return { d: h1 - f1.curHP, at: me.boosts.at };
};
probe('move', 'alwaysCrit', 'a crit ignores the ATTACKER\'s negative Attack stages', () => {
  const p0 = critIntim('knockoff', false), p1 = critIntim('knockoff', true);
  const c0 = critIntim('flowertrick', false), c1 = critIntim('flowertrick', true);
  return { works: p0.at === 0 && p1.at === -1 && c1.at === -1
                  && p1.d < p0.d && c0.d > 0 && c1.d === c0.d,
           arms: { control: [p0.d, p1.d], test: [c0.d, c1.d] },
           detail: `Meowscarada into Garchomp — Knock Off (no crit) ${p0.d} unintimidated / ${p1.d} `
                 + `Intimidated (the stage MUST cost it); Flower Trick (pCrit 1) ${c0.d} / ${c1.d} `
                 + `(the crit must ignore the same -1). Attack stage read back as ${p1.at}` };
});

/* 4b. A CRIT IGNORES THE DEFENDER'S POSITIVE DEFENSIVE STAGES — `ignoreDefensive =
 *     (ignorePositiveDefensive && defBoosts > 0)`. The NEGATIVE ones still count, which is why the
 *     stage is set to +2 and not to -2: an implementation that simply dropped the defender's boost
 *     multiplier for a crit would pass a -2 arm as well and be wrong in the other direction. */
const critDef = (moveId, dfStage) => {
  const { me, ally, f1, f2, S } = board('meowscarada', 'corviknight', 'garchomp', 'milotic');
  unfaintable(f1); f1.boosts.df = dfStage;
  const h1 = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return h1 - f1.curHP;
};
probe('move', 'alwaysCrit', 'a crit ignores the DEFENDER\'s positive Defense stages', () => {
  const p0 = critDef('knockoff', 0), p2 = critDef('knockoff', 2);
  const c0 = critDef('flowertrick', 0), c2 = critDef('flowertrick', 2);
  const n0 = critDef('flowertrick', 0), nn = critDef('flowertrick', -2);
  return { works: p2 < p0 && c0 > 0 && c2 === c0 && nn > n0,
           arms: { control: [p0, p2], test: [c0, c2] },
           detail: `Meowscarada into Garchomp — Knock Off ${p0} at def+0 / ${p2} at def+2; Flower `
                 + `Trick ${c0} / ${c2} (a crit must not see the +2). And a crit still DOES see a `
                 + `MINUS: Flower Trick ${n0} at def+0 / ${nn} at def-2` };
});

/* 4c. A CRIT IGNORES SCREENS. `getDamage` skips the `onAnyModifyDamage` chain a screen rides when
 *     the hit is critical; the engine's own DOUBLES_SCREEN comment has said "a critical hit ignores
 *     screens" and applied the reduction anyway since the constant was written.
 *
 * The screen is put up by the SIDE STATE rather than by a click, so the two arms differ in the screen
 * and in nothing else — a Reflect click would spend the partner's turn and change the turn order.
 * `sfB.sc` is keyed by the move that set it, which is WIRE 8's representation. */
const critScreen = (moveId, reflect) => {
  const { me, ally, f1, f2, S } = board('meowscarada', 'corviknight', 'garchomp', 'milotic');
  unfaintable(f1);
  if (reflect) S.sfB.sc.reflect = 5;
  const h1 = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return h1 - f1.curHP;
};
probe('move', 'alwaysCrit', 'a crit ignores Reflect', () => {
  const p0 = critScreen('knockoff', false), p1 = critScreen('knockoff', true);
  const c0 = critScreen('flowertrick', false), c1 = critScreen('flowertrick', true);
  return { works: p1 < p0 && c0 > 0 && c1 === c0,
           arms: { control: [p0, p1], test: [c0, c1] },
           detail: `Meowscarada into Garchomp — Knock Off ${p0} no screen / ${p1} under Reflect (the `
                 + `screen MUST cost it); Flower Trick ${c0} / ${c1} (a crit goes through)` };
});

/* 4d. AND THE ONE A CRIT DOES *NOT* IGNORE, probed so nobody "completes" the list by adding it.
 *     Will: "i dont think it ignores burn tho" — correct, and the reason is that the other three are
 *     BOOST STAGES while burn's halving is an `onModifyAtk` multiplier. Gen 2 ignored it; Gen 3
 *     onward does not. A crit under a burn must still be halved, and this probe goes RED on any
 *     future engine that folds burn into the crit's ignore list. */
const critBurn = (moveId, burn) => {
  const { me, ally, f1, f2, S } = board('meowscarada', 'corviknight', 'garchomp', 'milotic');
  unfaintable(f1); if (burn) me.status = 'brn';
  const h1 = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return h1 - f1.curHP;
};
probe('move', 'alwaysCrit', 'a crit does NOT ignore a burn', () => {
  const p0 = critBurn('knockoff', false), p1 = critBurn('knockoff', true);
  const c0 = critBurn('flowertrick', false), c1 = critBurn('flowertrick', true);
  return { works: p1 < p0 && c0 > 0 && c1 < c0,
           arms: { control: [p0, p1], test: [c0, c1] },
           detail: `Meowscarada into Garchomp — Knock Off ${p0} healthy / ${p1} burned; Flower Trick `
                 + `${c0} / ${c1} (the crit must STILL be halved — burn is a multiplier, not a stage)` };
});


/* ================================================================================================
 * ROADMAP #81 WIRE 12 — the four state defects the turn-1 board comparison named, plus the
 * substitute-doll regression that resolving one of them turned up.
 * ================================================================================================ */

/* 1a. FAIRY AURA ON THE ATTACKER. 5448/4096 on the BASE POWER, not 1.33 on the damage — the float
 *     truncs to 5447 and would have been one 4096th low on every Fairy move in the format.
 *     The CONTROL is the same body with the ability blanked, so "Floette hits hard" cannot pass this. */
const auraHit = (attAb, defAb, partnerAb, moveId, attSp, defSp) => {
  const me = bare(attSp || 'floette-mega'); me.ability = attAb;
  const ally = bare('corviknight');
  const f1 = bare(defSp || 'swampert'); f1.ability = defAb; unfaintable(f1);
  const f2 = bare('gengar'); f2.ability = partnerAb; unfaintable(f2);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const h1 = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return h1 - f1.curHP;
};
probe('ability', 'auraBoost', 'Fairy Aura raises the HOLDER own Fairy move by 5448/4096', () => {
  const off = auraHit('none', 'none', 'none', 'moonblast');
  const on = auraHit('fairyaura', 'none', 'none', 'moonblast');
  const r = off ? on / off : 0;
  return { works: off > 0 && on > off && r > 1.30 && r < 1.36,
           arms: { control: off, test: on },
           detail: `Floette-Mega Moonblast into an unfaintable Swampert — no ability ${off}, Fairy `
                 + `Aura ${on}, ratio ${r.toFixed(3)} (5448/4096 = 1.3301). Checked against the `
                 + `authority at pinned rolls: 111-132 -> 147-174, exact on both ends` };
});

/* 1b. AND THE HALF THAT HELPS THE OPPONENT, WHICH IS THE ONE A FLATTERING FIX WOULD DROP.
 *     `onAnyBasePower` fires for every move on the field regardless of whose body carries the
 *     ability, so a Fairy Aura standing on the FOE'S side raises MY Moonblast by the same 1.33. An
 *     implementation that boosted only the holder's moves passes 1a and fails this, and it would
 *     measure as an improvement — which is the dangerous kind of wrong. */
probe('ability', 'auraBoost', 'Fairy Aura on the FOE raises MY Fairy move by the same amount', () => {
  const off = auraHit('none', 'none', 'none', 'moonblast');
  const onMe = auraHit('fairyaura', 'none', 'none', 'moonblast');
  const onThem = auraHit('none', 'fairyaura', 'none', 'moonblast');
  return { works: off > 0 && onThem > off && onThem === onMe,
           arms: { control: off, test: onThem },
           detail: `Moonblast into Swampert — nobody has the aura ${off}; the AURA IS ON THE TARGET `
                 + `${onThem}; the aura is on the attacker ${onMe}. The last two must be EQUAL: the `
                 + `field does not care which side the carrier stands on` };
});

/* 1c. SCOPE. The aura names ONE type and must leave everything else alone — otherwise "the multiplier
 *     is wired" is satisfied by a multiplier applied to every move. Dark Aura is the second member
 *     and is staged on the same body, so this also shows the tag is read per-type rather than by a
 *     name that happens to be Fairy. */
probe('ability', 'auraBoost', 'an aura touches ONLY its own type, and Dark Aura is the second member', () => {
  const fairyPlain = auraHit('none', 'none', 'none', 'moonblast');
  const fairyUnderDark = auraHit('darkaura', 'none', 'none', 'moonblast');
  const darkPlain = auraHit('none', 'none', 'none', 'crunch', 'tyranitar', 'gholdengo');
  const darkUnderDark = auraHit('darkaura', 'none', 'none', 'crunch', 'tyranitar', 'gholdengo');
  const r = darkPlain ? darkUnderDark / darkPlain : 0;
  return { works: fairyPlain > 0 && fairyUnderDark === fairyPlain
                  && darkPlain > 0 && darkUnderDark > darkPlain && r > 1.30 && r < 1.36,
           arms: { control: [fairyPlain, fairyUnderDark], test: [darkPlain, darkUnderDark] },
           detail: `DARK Aura on the attacker — its Moonblast (Fairy) is ${fairyPlain} -> `
                 + `${fairyUnderDark} (must NOT move) and Tyranitar Crunch is ${darkPlain} -> `
                 + `${darkUnderDark}, ratio ${r.toFixed(3)}` };
});

/* 1d. AURA BREAK INVERTS RATHER THAN CANCELS, and the two are only distinguishable against the
 *     NO-AURA baseline — a probe that compared "aura" against "aura + break" would be satisfied by a
 *     break that merely turned the aura off. 3072/4096 = 0.75, so a Fairy move under BOTH is WEAKER
 *     than one under neither. `hasAuraBreak` is read off the aura's own handler, so the number is the
 *     artifact's. Zero legal carriers in this format (Zygarde is Past, Zygarde-Mega is Future), which
 *     is why it is staged on a body directly and stated here rather than left to look like coverage. */
probe('ability', 'auraBreak', 'Aura Break INVERTS the aura to 0.75 instead of cancelling it to 1.0', () => {
  const none = auraHit('none', 'none', 'none', 'moonblast');
  const aura = auraHit('fairyaura', 'none', 'none', 'moonblast');
  const both = auraHit('fairyaura', 'none', 'aurabreak', 'moonblast');
  const r = none ? both / none : 0;
  return { works: none > 0 && aura > none && both < none && r > 0.72 && r < 0.78,
           arms: { control: none, test: both },
           detail: `Moonblast into Swampert — no aura ${none}, Fairy Aura ${aura}, Fairy Aura WITH `
                 + `an Aura Break body on the foe side ${both}; ${both}/${none} = ${r.toFixed(3)}. `
                 + `Cancelling would give ${none}; the rule is 0.75, not 1.0` };
});

/* 2a. SHED TAIL ACTUALLY SWITCHES, AND ALL THREE OF ITS EFFECTS FIRE. Will: "SHED TAIL NEEDS A SUB"
 *     and "AND HP LOSS". Measured before the fix: Heliolisk paid 68 HP, built a doll, and STOOD
 *     THERE — the pivot half did not exist, because `passesState` had no consumer anywhere in the
 *     engine. The control is U-turn, which pivots and pays nothing and builds nothing, so "the slot
 *     changed" cannot be satisfied by the switch machinery alone. */
const passMove = (moveId, boostFirst) => {
  const me = bare('heliolisk'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('swampert');
  const benchA = bare('emolga');
  const S = M.battleInit([me, ally, benchA], [f1, f2], { seeded: true });
  if (boostFirst) me.boosts.at = 2;
  const hp0 = me.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  const now = S.actA[0];
  return { slot0: now && now.name, paid: hp0 - me.curHP, max: me.st.hp,
           incomingSub: now ? (now._sub || 0) : -1, incomingAtk: now ? now.boosts.at : -99 };
};
probe('move', 'passesState', 'Shed Tail pays HP, leaves a Substitute AND switches — all three', () => {
  const shed = passMove('shedtail', false), pivot = passMove('uturn', false);
  const wantPaid = Math.ceil(shed.max / 2), wantSub = Math.floor(shed.max / 4);
  return { works: shed.slot0 === 'emolga' && shed.paid === wantPaid && shed.incomingSub === wantSub
                  && pivot.slot0 === 'emolga' && pivot.paid === 0 && pivot.incomingSub === 0,
           arms: { control: [pivot.slot0, pivot.paid, pivot.incomingSub],
                   test: [shed.slot0, shed.paid, shed.incomingSub] },
           detail: `Heliolisk (${shed.max} max) — Shed Tail: slot 0 is now "${shed.slot0}", the user `
                 + `paid ${shed.paid} (ceil(max/2) = ${wantPaid}) and EMOLGA arrives holding a `
                 + `${shed.incomingSub} doll (floor(max/4) = ${wantSub}). U-turn control: slot 0 `
                 + `"${pivot.slot0}", paid ${pivot.paid}, doll ${pivot.incomingSub}` };
});

/* 2b. BATON PASS HANDS OVER THE BOOSTS AND SHED TAIL DOES NOT, which is the whole difference between
 *     the two and is `switchCause !== 'shedtail'` in `Pokemon#copyVolatileFrom`. Both arms are the
 *     same body at the same +2, so the only varied thing is which of the two moves is clicked — and
 *     "the incoming mon is at +2" and "the incoming mon is at 0" are the two answers a single-armed
 *     probe could not tell apart from the switch simply not happening. */
probe('move', 'passesState', 'Baton Pass carries the BOOSTS across and Shed Tail deliberately does not', () => {
  const bp = passMove('batonpass', true), shed = passMove('shedtail', true);
  return { works: bp.slot0 === 'emolga' && bp.incomingAtk === 2 && bp.paid === 0 && bp.incomingSub === 0
                  && shed.slot0 === 'emolga' && shed.incomingAtk === 0 && shed.incomingSub > 0,
           arms: { control: [shed.incomingAtk, shed.incomingSub], test: [bp.incomingAtk, bp.incomingSub] },
           detail: `Heliolisk at +2 Attack — Baton Pass: Emolga arrives at atk ${bp.incomingAtk} with `
                 + `a ${bp.incomingSub} doll and the user paid ${bp.paid}; Shed Tail: Emolga arrives `
                 + `at atk ${shed.incomingAtk} with a ${shed.incomingSub} doll. The authority passes `
                 + `boosts on one and explicitly not on the other` };
});

/* 3a. CURSE, THE NON-GHOST HALF. Will: "MOSTLY BY NON GHOST TYPES TO BOOST ATTACK AND DEFENSE AND
 *     LOWER SPEED." Measured before the fix: Farigiraf clicked Curse and finished the turn at
 *     0/0/0 having lost no HP, with the foe untouched — the move did NOTHING. The FOE'S HP is
 *     asserted too, because the branch also RETARGETS (`nonGhostTarget: 'self'`) and a version that
 *     kept the declared `normal` target would hand a foe the boosts. */
const curseTurn = (userSp) => {
  const me = bare(userSp), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('swampert');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const h0 = me.curHP, g0 = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'curse', f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  const out = { at: me.boosts.at, df: me.boosts.df, sp: me.boosts.sp,
                paid: h0 - me.curHP, foeLost: g0 - f1.curHP,
                foeAt: f1.boosts.at, max: me.st.hp, foeMax: f1.st.hp };
  const g1 = f1.curHP;
  M.battleTurn(S, rng5, new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
  out.foeLostNextTurn = g1 - f1.curHP;
  return out;
};
probe('move', 'typeSplitMove', 'a NON-Ghost Curse is +1 Atk / +1 Def / -1 Spe on ITSELF, free', () => {
  const nonGhost = curseTurn('farigiraf'), ghost = curseTurn('gengar');
  return { works: nonGhost.at === 1 && nonGhost.df === 1 && nonGhost.sp === -1
                  && nonGhost.paid === 0 && nonGhost.foeLost === 0 && nonGhost.foeAt === 0
                  && ghost.at === 0 && ghost.df === 0 && ghost.sp === 0,
           arms: { control: [ghost.at, ghost.df, ghost.sp], test: [nonGhost.at, nonGhost.df, nonGhost.sp] },
           detail: `Farigiraf (Normal/Psychic) clicks Curse — atk ${nonGhost.at}, def ${nonGhost.df}, `
                 + `spe ${nonGhost.sp}, paid ${nonGhost.paid} HP, foe lost ${nonGhost.foeLost} and is `
                 + `at atk ${nonGhost.foeAt} (the branch retargets to SELF). Gengar, the Ghost arm, `
                 + `takes NO stat change: ${ghost.at}/${ghost.df}/${ghost.sp}` };
});

/* 3b. AND THE GHOST HALF, WHICH IS THE ONE THAT PAYS. The chip (`perTurnHP`, 1/4 of the target's max
 *     per turn) was in the artifact all along with nothing reading it, and NOTHING took the user's
 *     half. Wired apart, Curse would have been a free permanent quarter-per-turn — strictly better
 *     than the real move, which is what a search learns to spam. Both numbers are asserted, and the
 *     chip is read on the FOLLOWING turn as well so "it happened once at the click" cannot pass. */
probe('move', 'typeSplitMove', 'a GHOST Curse costs the user half its max HP and chips the foe 1/4 a turn', () => {
  const ghost = curseTurn('gengar'), nonGhost = curseTurn('farigiraf');
  const wantPaid = Math.trunc(ghost.max / 2), wantChip = Math.trunc(ghost.foeMax / 4);
  return { works: ghost.paid === wantPaid && ghost.foeLost === wantChip
                  && ghost.foeLostNextTurn === wantChip
                  && nonGhost.paid === 0 && nonGhost.foeLostNextTurn === 0,
           arms: { control: [nonGhost.paid, nonGhost.foeLost, nonGhost.foeLostNextTurn],
                   test: [ghost.paid, ghost.foeLost, ghost.foeLostNextTurn] },
           detail: `Gengar (${ghost.max} max) clicks Curse at a ${ghost.foeMax} HP Garchomp — the `
                 + `user paid ${ghost.paid} (max/2 = ${wantPaid}) and the foe lost ${ghost.foeLost} `
                 + `on the click turn and ${ghost.foeLostNextTurn} on the NEXT one (max/4 = `
                 + `${wantChip}). Farigiraf non-Ghost arm pays ${nonGhost.paid} and chips `
                 + `${nonGhost.foeLostNextTurn}` };
});

/* 4a. THE PERISH COUNTER READS 3 / 2 / 1, NOT 2 / 1 / 0. `perishsong.condition.duration` is 4 and
 *     `residualEvent` decrements at the end of EVERY turn including the one it was set on, so the
 *     board reads 3 at the end of turn 1. This engine set 3 and ticked to 2 — one turn early, on
 *     both sides, on 1,141 corpus uses. Staged against the authority in a real doubles game:
 *     `|-start|...|perish3` / `perish2` / `perish1` / `perish0` + faint at the ends of turns 1..4.
 *     The FULL SEQUENCE is asserted, because setting 4 and skipping the first tick agrees on turn 1
 *     and drifts afterwards — which is a fix that would pass a one-turn probe. */
const perishRun = (turns, switchOnTurn, noClick) => {
  const me = bare('primarina'), ally = bare('corviknight');
  const f1 = bare('garchomp'), f2 = bare('swampert');
  const benchA = bare('emolga'), benchB = bare('pelipper');
  const S = M.battleInit([me, ally, benchA], [f1, f2, benchB], { seeded: true });
  const seq = [];
  for (let t = 1; t <= turns; t++) {
    const mine = (t === 1 && !noClick) ? M.playerAction(me, 'perishsong', f1, S.field)
      : (t === switchOnTurn) ? { kind: 'switch', to: benchA } : { kind: 'pass' };
    M.battleTurn(S, rng5, new Map([[me, mine], [ally, { kind: 'pass' }]]), PASS2(f1, f2));
    seq.push([me, ally, f1, f2].map(x => (x._perish == null ? 'x' : x._perish) + (x.fainted ? 'F' : '')).join(' '));
  }
  return { seq, me, ally, f1, f2, slot0: S.actA[0] && S.actA[0].name };
};
probe('move', 'perishClock', 'the perish counter reads 3 / 2 / 1 at the ends of turns 1, 2 and 3', () => {
  const r = perishRun(3);
  /* THE CONTROL IS A REAL ARM, NOT THE EXPECTED VALUE. Comparing the sequence against the string it
     is supposed to be makes both arms the same object when the probe passes, which the arms detector
     correctly calls hollow — and it would be satisfied by an engine that hard-coded the answer. The
     control is the SAME BOARD with the click withheld: no clock exists at all, so the varied knob is
     the click and the difference is the whole mechanic. */
  const none = perishRun(3, 0, true);
  const want = ['3 3 3 3', '2 2 2 2', '1 1 1 1'];
  const wantNone = ['x x x x', 'x x x x', 'x x x x'];
  const alive = !r.me.fainted && !r.ally.fainted && !r.f1.fainted && !r.f2.fainted;
  return { works: JSON.stringify(r.seq) === JSON.stringify(want)
                  && JSON.stringify(none.seq) === JSON.stringify(wantNone) && alive,
           arms: { control: none.seq, test: r.seq },
           detail: `Primarina clicks Perish Song on turn 1 — the four bodies read [${r.seq.join('] [')}] `
                 + `at the ends of turns 1, 2, 3, and NONE has fainted yet; withholding the click on `
                 + `the same board reads [${none.seq.join('] [')}]. The authority reads perish3 / `
                 + `perish2 / perish1 over the same three turns` };
});

/* 4b. AND THE KO AT THE END OF IT, WHICH IS THE WHOLE POINT OF THE MOVE AND WHICH NOTHING IN THIS
 *     REPO HAD EVER ASSERTED. Will: "MAKE A NOTE TO TEST THAT PERISH SONG ACTUALLY KOS AT THE END OF
 *     IT". Three claims in one, and the middle one is what an off-by-one breaks: everything is ALIVE
 *     at the end of turn 3, everything is DEAD at the end of turn 4, and it is SIMULTANEOUS across
 *     both sides — Perish Song hits the user's own team too, so a version that killed only the foes
 *     would be a win condition the move does not have. */
probe('move', 'perishClock', 'every affected body faints at the end of turn 4 — both sides, at once', () => {
  const three = perishRun(3), four = perishRun(4), five = perishRun(5);
  const dead = (r) => [r.me, r.ally, r.f1, r.f2].filter(x => x.fainted).length;
  return { works: dead(three) === 0 && dead(four) === 4 && dead(five) === 4,
           arms: { control: dead(three), test: dead(four) },
           detail: `bodies fainted to the perish clock — after 3 turns ${dead(three)}/4, after 4 turns `
                 + `${dead(four)}/4 (the user OWN side included), after 5 turns ${dead(five)}/4. `
                 + `Alive at 3 and dead at 4 is the pair; either alone is satisfied by an engine that `
                 + `is a turn out in one direction or the other` };
});

/* 4c. THE ESCAPE, WHICH IS THE MOVE'S ONLY COUNTER-PLAY. `perishsong` is an ordinary volatile, so
 *     `Pokemon#clearVolatile` takes it on the way out and a body that switches before zero never
 *     faints. Staged against the authority: a Primarina that clicks Perish Song on turn 1 and
 *     switches on turn 2 finishes at 105/155 alive while its partner, which stayed, keeps counting.
 *     This engine kept `_perish` on the benched body — invisible, because a benched mon does not
 *     tick, so the clock FROZE rather than resetting and only bit if the body came back. */
probe('move', 'perishClock', 'a body that switches out loses the clock and does NOT faint', () => {
  const stayed = perishRun(4), left = perishRun(4, 2);
  return { works: stayed.me.fainted && !left.me.fainted && left.me._perish == null
                  && left.ally.fainted && left.f1.fainted && left.f2.fainted,
           arms: { control: [stayed.me.fainted, stayed.me._perish],
                   test: [left.me.fainted, left.me._perish] },
           detail: `Primarina clicks Perish Song on turn 1 — staying in, it is fainted=${stayed.me.fainted} `
                 + `at the end of turn 4; switching out on turn 2 it is fainted=${left.me.fainted} `
                 + `with _perish=${left.me._perish}. Its PARTNER, which stayed, is `
                 + `fainted=${left.ally.fainted}, so the clock did not simply stop running` };
});


/* 5. ROADMAP #81 WIRE 12 — THE LIFE ORB TOLL IS PAID BY A MOVE THAT LANDED, AND WIRE 10 STOPPED
 *    CHECKING. This is that rung's board regression, found by staging the path it altered.
 *
 * WIRE 10 rewrote the hit loop into Showdown's `for (step) for (target)` shape and put the ACCURACY
 * roll inside the walk — correctly, `hitStepAccuracy` is step 5, below TryHit and the immunities.
 * What went with it was the `continue` the old whole-move roll carried, which had skipped everything
 * below the loop. The drain, the self-drop and the pivot all have their own `dealt`/`connected`
 * gates; the Life Orb line never had one, so from WIRE 10 onward a Life Orb holder paid a tenth of
 * its max HP for a move that MISSED. Life Orb is 12,804 corpus sheets.
 *
 * WHY WIRE 10's OWN CONTROL COULD NOT SEE IT: that rung validated itself on "36/36 single-target
 * clicks are byte-identical". Every one of the 36 LANDED, so none of them exercised the branch the
 * change deleted — and this is not a spread defect at all, it is every missed move.
 *
 * FOUR ARMS, and the two that are NOT the fix are what make it a probe rather than an assertion: the
 * toll must still be paid on a hit, and must still be refused on a type immunity (where it always
 * was, because `dmgRange` returns 0 and the old gate happened to hold). Measured against the
 * authority at the differential's own pin: Scald 13 / Hydro Pump 0 / Thunderbolt-into-Ground 0. */
const orbToll = (moveId, item, defSp) => {
  const me = bare('pelipper'); me.item = item;
  const ally = bare('corviknight');
  const f1 = bare(defSp || 'garchomp'), f2 = bare('milotic');
  unfaintable(f1); unfaintable(f2);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const h0 = me.curHP, a0 = f1.curHP;
  /* rngLose is the harness's own losing roll: every printed accuracy in this format below 100 misses
   * on it and nothing at 100 does, which is exactly the knob this probe varies. */
  M.battleTurn(S, rngLose,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return { paid: h0 - me.curHP, dealt: a0 - f1.curHP };
};
probe('item', 'damageMultAll', 'the Life Orb toll is refused by a move that MISSED', () => {
  const hit = orbToll('scald', 'lifeorb');            // 100 accuracy: lands on the losing roll
  const miss = orbToll('hydropump', 'lifeorb');       //  80 accuracy: misses on it
  const immune = orbToll('thunderbolt', 'lifeorb');   // Electric into a Ground type: reaches nobody
  const noItem = orbToll('scald', '');
  return { works: hit.dealt > 0 && hit.paid > 0 && miss.dealt === 0 && miss.paid === 0
                  && immune.dealt === 0 && immune.paid === 0 && noItem.paid === 0,
           arms: { control: [hit.dealt, hit.paid], test: [miss.dealt, miss.paid] },
           detail: `Pelipper holding a Life Orb — Scald LANDS (${hit.dealt} dealt) and it pays `
                 + `${hit.paid}; Hydro Pump MISSES (${miss.dealt} dealt) and it pays ${miss.paid}; `
                 + `Thunderbolt into a Ground type reaches nobody and pays ${immune.paid}; with no `
                 + `item at all a landed Scald costs ${noItem.paid}. The authority pays 13 / 0 / 0` };
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

/* ---- THE DIRECT-CALL RATCHET -------------------------------------------------------------------
 *
 * The number that actually tracks coverage. See the comment on probe(). Baseline out of the artifact,
 * never a literal — the same rule the arms ratchet learned. */
const directCall = results.filter(r => r.directCall).length;
let dcBase = null, dcBaseFail = '';
try {
  const prev = JSON.parse(fs.readFileSync(D('data', 'mechanics-census.json'), 'utf8'));
  dcBase = typeof prev.directCall === 'number' ? prev.directCall : null;
  if (dcBase == null) dcBaseFail = 'the census predates the directCall field';
} catch (e) { dcBaseFail = String(e.message).slice(0, 100); }
if (dcBase == null) console.log('  NOTE: the directCall RATCHET has no baseline this run — ' + dcBaseFail);
console.log('  probes that spend a REAL TURN or a real ENTRY: ' + (results.length - directCall)
  + ' of ' + results.length + '   (' + directCall + ' call the mechanic DIRECTLY — RATCHETED: '
  + 'it may fall and may never rise)');
if (dcBase != null && directCall > dcBase) {
  console.log('\n  FAILED: direct-call probes ' + dcBase + ' -> ' + directCall + '. A probe that calls '
    + 'the mechanic itself cannot catch a wiring bug — WIRE 123 was green under one. Route the probe '
    + 'through battleInit/battleTurn.');
  process.exitCode = 1;
}
for (const r of results) if (r.directCall) console.log('    direct  ' + r.kind.padEnd(8) + r.tag.padEnd(24) + r.label);

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
  /* THE DIRECT-CALL COUNT, computed structurally over each probe's own source and ratcheted DOWNWARD.
   * It is the number that tracks coverage; `unarmed` tracks paperwork. See probe(). */
  directCall,
  /* Counted apart from `missing`: a probe that threw has not shown the mechanic ABSENT, only that it
   * could not ask. Both are non-live; only one is evidence about the engine. */
  threw,
  /* Written to the artifact so a ratchet can hold it at zero without re-running the reasoning. */
  hollow: hollow.length,
  results: results.map(r => ({ kind: r.kind, tag: r.tag, label: r.label, live: r.works, detail: r.detail,
                               hollow: !!r.hollow, armed: !!r.armed, directCall: !!r.directCall })),
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
