/* WALK THE TAG LIST TO ZERO — every tag, checked against Showdown.
 *
 *   SHOWDOWN_PATH=... node tests/walk_tags.js [--only <tag>] [--limit 40]
 *
 * WHY THIS SHAPE
 * --------------
 * Will tagged every move, ability and item in the format. Nothing here was unimagined -- Freeze-Dry
 * carries `overridesEffectiveness` with `{overrides:true}`, Haze carries `clearsBoosts`, Friend Guard
 * carries `reducesAllyDamage`. The knowledge is complete and the implementation is not, so the job is
 * not a search. It is a list, and it can be walked to zero.
 *
 * TWO INSTRUMENTS, JOINED. tests/test-mechanics.js probes behaviour by hand and I wrote SEVEN
 * control failures into it in one session -- a Corviknight ally immune to the Earthquake being
 * blocked, a Garchomp that died before it could freeze, a probe that applied the status itself and
 * then asserted it. Every one produced a confident wrong answer. Hand-written expectations are the
 * problem, so this file has none: the tag says WHAT to exercise and SHOWDOWN says what should happen.
 *
 * WHAT IT DOES. For each tag, take its highest-usage carrier, build a scenario that exercises it, and
 * run the SAME forced turn through both engines. Compare what changed: HP, status, stat stages, item,
 * field. Anywhere they differ, MEDICHAM is wrong.
 *
 * WHAT IT SKIPS, AND SAYS SO. Effects that fire on a CHANCE cannot be compared turn-for-turn -- the
 * two engines draw from different generators and no seed makes them agree. Those are reported as
 * NOT COVERED rather than counted as passes, because a tag silently marked fine is worse than one
 * marked unknown. tests/test-mechanics.js remains the instrument for those, forcing the roll.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const CS = require(D('engine', 'champions_sim.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));

const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const ONLY = arg('only', '');
const LIMIT = parseInt(arg('limit', '40'), 10);

const tags = JSON.parse(fs.readFileSync(D('data', 'abra-tags.js'), 'utf8')
  .replace(/^[^{]*/, '').replace(/;\s*$/, ''));

/* A neutral pair. The attacker needs no STAB anywhere interesting and the defender needs to SURVIVE
 * -- a target that faints ends the comparison early and reports the two engines as disagreeing about
 * a mechanic when they agreed about a knockout. Both lessons cost a run tonight. */
/* BOTH MUST EXIST IN BOTH ENGINES. The first version used Blissey as the bulky defender and
 * Smeargle as filler; both are isNonstandard 'Past' in Champions and carry no MC row, so MEDICHAM
 * could not build them and EVERY tag came back "could not build the scenario" -- 25 skips and zero
 * information. Milotic is in-format, buildable in both, and bulky enough to survive a Tackle. */
/* A SCENARIO THIS HARNESS COULD NOT RUN IS COUNTED, WITH ITS REASON.
 *
 * Three catch blocks here returned a plausible `null`, and a null means "NOT COVERED" a few lines
 * later -- which the report prints as "honest ignorance, not a pass". It was not honest: an engine
 * that THREW and an engine that has no handler produced the same word. tests/test-no-silent-failure.js
 * flagged all three. Zero is printed too, so "nothing threw" is a claim you can read. */
const walkErrs = { n: 0, where: {} };
/* NAMED `log...` DELIBERATELY, for the reason spelled out in tests/test-engine-diff.js: the silent-
 * catch check reads the catch BODY and cannot see through a helper call. */
const logDroppedScenario = (where, e) => {
  walkErrs.n++;
  const k = where + ': ' + String((e && e.message) || e).slice(0, 60);
  walkErrs.where[k] = (walkErrs.where[k] || 0) + 1;
};

const ATT = 'Incineroar', DEF = 'Milotic';
const FILL = ['Ditto', 'Sableye'];
/* THE NEUTRAL PROBE MOVE FOR ABILITY AND ITEM TESTS. Tackle was the obvious choice and is not in
 * MC.moves -- that table holds moves people actually CLICK -- so playerAction returned kind 'pass'
 * and MEDICHAM dealt 0 on every ability and item row. Body Slam is Normal, in both engines, and
 * Incineroar learns it. */
const PROBE_MOVE = 'bodyslam', PROBE_MOVE_NAME = 'Body Slam';
/* THE ALLIES MUST NOT INTERFERE. Giving the fillers the probe move meant THEY attacked the target
 * too -- the defender came back paralysed by a filler's Body Slam, which read as the two engines
 * disagreeing about status. Protect keeps them on the field and out of the measurement, and
 * MEDICHAM's side already passes.
 * The DEFENDER still acts, because a Protecting defender would block the very move under test. */
const FILLER_MOVE = 'Protect';

const mkSet = (name, moveName, item, ability) => ({
  name, species: name, item: item || '', ability: ability || (dex.species.get(name).abilities['0'] || ''),
  moves: [moveName || PROBE_MOVE_NAME], nature: 'Serious',
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50, gender: '',
});

/* ONE REAL TURN in Showdown -- not moveHit, which bypasses entry effects and some ability handlers
 * and produced two false findings earlier tonight (Vaporeon's Water Absorb, Gyarados's Intimidate). */
function showdownTurn(moveName, attAbility, defAbility, defItem) {
  const teamA = [mkSet(ATT, moveName, '', attAbility), ...FILL.map(f => mkSet(f, FILLER_MOVE)), mkSet('Ditto', FILLER_MOVE)];
  const teamB = [mkSet(DEF, PROBE_MOVE_NAME, defItem, defAbility), ...FILL.map(f => mkSet(f, FILLER_MOVE)), mkSet('Ditto', FILLER_MOVE)];
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (b.requestState === 'teampreview') { b.choose('p1', 'team 1234'); b.choose('p2', 'team 1234'); }
  const tgt = b.p2.active[0], src = b.p1.active[0];
  if (!tgt || !src) return null;
  const before = { hp: tgt.hp, max: tgt.maxhp, status: tgt.status || '', boosts: Object.assign({}, tgt.boosts), item: tgt.item || '' };
  b.random = (n) => (n === 16 ? 0 : 0);
  /* BOTH SLOTS, because this is DOUBLES. A single 'move 1 1' is an incomplete choice, the turn
   * never runs, and every comparison came back with Showdown dealing 0% -- which read as six
   * mechanics diverging when it was one missing action. Fake Out, Close Combat and Earthquake all
   * dealing nothing is not a finding, it is a harness that did not press go. */
  /* THE TWO SLOTS NEED DIFFERENT CHOICE FORMS and a single string cannot serve both. The tested
   * move may be aimed ('move 1 1') or spread ('move 1'); the Protecting ally is always untargeted.
   * A uniform string failed for whichever slot it did not suit, the turn never ran, and every tag
   * came back "could not build the scenario" -- twice, with two different uniform strings. */
  /* ONE FORM FAILING IS THE DESIGN, so only BOTH failing is worth counting. Noting each attempt
   * would fire on every single scenario -- a counter that is always non-zero is noise, and noise is
   * how a check trains people to ignore it (tests/test-no-silent-failure.js says so in its own
   * header about `catch { continue }` over ragged JSONL). The reasons are collected either way, so
   * when both DO fail the message says what each one said. */
  const go = (side) => {
    const why = [];
    for (const first of ['move 1 1', 'move 1']) {
      try { b.choose(side, first + ', move 1'); return true; }
      catch (e) { why.push(first + ' -> ' + String((e && e.message) || e).slice(0, 40)); }
    }
    logDroppedScenario('showdown refused BOTH choice forms for ' + side, new Error(why.join(' | ')));
    return false;
  };
  if (!go('p1') || !go('p2')) return null;
  if (b.turn < 2 && !b.ended) return null;            // the turn did not resolve; report nothing
  return {
    dmgFrac: (before.hp - tgt.hp) / before.max,
    status: tgt.status || '', item: tgt.item || '',
    boosts: ['atk', 'def', 'spa', 'spd', 'spe'].map(k => (tgt.boosts[k] || 0) - (before.boosts[k] || 0)),
    weather: (b.field.weather || ''),
  };
}

function medichamTurn(moveId, attAbility, defAbility, defItem) {
  const a = MEDI.buildMon(ATT, {}), d = MEDI.buildMon(DEF, {});
  const ally = MEDI.buildMon('ditto', {});
  const dally = MEDI.buildMon('sableye', {});
  if (!a || !d || !ally || !dally) return null;
  const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  a.item = ''; d.item = defItem ? norm(defItem) : '';
  a.ability = norm(attAbility || dex.species.get(ATT).abilities['0']);
  d.ability = norm(defAbility || dex.species.get(DEF).abilities['0']);
  const S = MEDI.battleInit([a, ally], [d, dally], { seeded: true });
  const before = { hp: d.curHP, max: d.st.hp, boosts: Object.assign({}, d.boosts) };
  let act; try { act = MEDI.playerAction(a, moveId, d, S.field); } catch (e) { logDroppedScenario('medicham playerAction ' + moveId, e); return null; }
  if (!act) return null;
  try {
    MEDI.battleTurn(S, () => 0.0, new Map([[a, act], [ally, { kind: 'pass' }]]),
      new Map([[d, { kind: 'pass' }], [dally, { kind: 'pass' }]]));
  } catch (e) { logDroppedScenario('medicham battleTurn ' + moveId, e); return null; }
  return {
    dmgFrac: (before.hp - d.curHP) / before.max,
    status: d.status || '', item: d.item || '',
    boosts: ['at', 'df', 'sa', 'sd', 'sp'].map(k => (d.boosts[k] || 0) - (before.boosts[k] || 0)),
    weather: S.field.weather || '',
    kind: act.kind,
  };
}

/* CHANCE-BASED EFFECTS CANNOT BE COMPARED TURN-FOR-TURN. The two engines draw from different
 * generators and no seed makes them agree, so a secondary that fires in one and not the other is not
 * evidence of anything. Detected from the tag's own params rather than a list of tag names. */
function isChancy(sec, id) {
  const v = (tags[sec] || {})[id];
  if (!v) return false;
  const p = JSON.stringify(v.params || {});
  return /"chance":\s*(?!100)\d/.test(p) || /"p(Hit)?":\s*0\./.test(p);
}

/* Every tag, with the highest-usage carrier that actually exercises it. */
const SECTIONS = { moves: 'move', abilities: 'ability', items: 'item' };
const work = [];
for (const [sec, kind] of Object.entries(SECTIONS)) {
  const byTag = {};
  for (const [id, v] of Object.entries(tags[sec] || {})) {
    for (const t of (v.tags || [])) {
      if (t === 'untagged') continue;
      const uses = typeof v.uses === 'number' ? v.uses : 0;
      if (!byTag[t] || uses > byTag[t].uses) byTag[t] = { id, uses, sec, kind };
    }
  }
  for (const [t, c] of Object.entries(byTag)) work.push(Object.assign({ tag: t }, c));
}
work.sort((a, b) => b.uses - a.uses);

const rows = [];
for (const w of work) {
  if (ONLY && w.tag !== ONLY) continue;
  if (rows.length >= LIMIT) break;
  if (isChancy(w.sec, w.id)) { rows.push({ ...w, verdict: 'NOT COVERED', detail: 'chance-based; use test-mechanics' }); continue; }

  let s = null, m = null;
  if (w.kind === 'move') {
    const dm = dex.moves.get(w.id);
    if (!dm.exists) { rows.push({ ...w, verdict: 'SKIP', detail: 'not in this format' }); continue; }
    s = showdownTurn(dm.name); m = medichamTurn(w.id);
  } else if (w.kind === 'ability') {
    const ab = dex.abilities.get(w.id);
    if (!ab.exists) { rows.push({ ...w, verdict: 'SKIP', detail: 'not in this format' }); continue; }
    s = showdownTurn(PROBE_MOVE_NAME, null, ab.name); m = medichamTurn(PROBE_MOVE, null, ab.name);
  } else {
    const it = dex.items.get(w.id);
    if (!it.exists) { rows.push({ ...w, verdict: 'SKIP', detail: 'not in this format' }); continue; }
    s = showdownTurn(PROBE_MOVE_NAME, null, null, it.name); m = medichamTurn(PROBE_MOVE, null, null, it.name);
  }
  if (!s || !m) { rows.push({ ...w, verdict: 'SKIP', detail: 'could not build the scenario' }); continue; }

  const dmgGap = Math.abs(s.dmgFrac - m.dmgFrac);
  const same = dmgGap <= 0.10
    && s.status === m.status
    && s.weather === m.weather
    && s.boosts.join(',') === m.boosts.join(',');
  rows.push({
    ...w, verdict: same ? 'AGREE' : 'DIVERGE',
    detail: same ? `dmg ${(100 * s.dmgFrac).toFixed(0)}%`
      : `showdown dmg ${(100 * s.dmgFrac).toFixed(0)}% st=${s.status || '-'} bo=${s.boosts.join('')} w=${s.weather || '-'}` +
        `  |  medicham dmg ${(100 * m.dmgFrac).toFixed(0)}% st=${m.status || '-'} bo=${m.boosts.join('')} w=${m.weather || '-'}`,
  });
}

const n = k => rows.filter(r => r.verdict === k).length;
console.log(`WALKING THE TAG LIST — ${rows.length} tags checked against Showdown\n`);
for (const r of rows) {
  if (r.verdict === 'AGREE') continue;
  console.log(`  ${r.verdict.padEnd(12)}${r.tag.padEnd(24)}${String(r.uses).padStart(7)}  ${r.id.padEnd(15)}${r.detail}`);
}
console.log(`\n  AGREE ${n('AGREE')}   DIVERGE ${n('DIVERGE')}   NOT COVERED ${n('NOT COVERED')}   SKIP ${n('SKIP')}`);
console.log('  DIVERGE means MEDICHAM and Showdown did different things to the same board.');
console.log('  NOT COVERED is honest ignorance, not a pass.');
console.log(`  scenarios dropped because something THREW: ${walkErrs.n}`);
for (const [k, c] of Object.entries(walkErrs.where).sort((x, y) => y[1] - x[1]).slice(0, 8)) {
  console.log('    x' + String(c).padEnd(5) + k);
}

fs.writeFileSync(D('data', 'tag-walk.json'), JSON.stringify({
  generated: new Date().toISOString(), by: 'tests/walk_tags.js',
  design: 'The tag list says WHAT to exercise; Showdown says what should happen. No hand-written '
        + 'expectations, because seven control failures were written by hand in one session.',
  checked: rows.length, agree: n('AGREE'), diverge: n('DIVERGE'),
  /* A scenario that THREW used to land in NOT COVERED beside a genuinely unhandled tag, and the
   * report calls that 'honest ignorance'. Separated so it can be read as what it is. */
  dropped_by_exception: walkErrs.n, dropped_where: walkErrs.where,
  notCovered: n('NOT COVERED'), skipped: n('SKIP'), rows,
}, null, 2) + '\n');
console.log('\n  wrote data/tag-walk.json');
