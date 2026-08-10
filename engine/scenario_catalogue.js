/* THE SCENARIO CATALOGUE — one test SHAPE per mechanic, for every move, ability, item and species.
 *
 * Will, 2026-08-10: *"START DEVISING TESTS AND SCENARIOS FOR EACH MECHANIC (ITEM, ABILITY, MOVE, MON)
 * IN THE GAME THAT WE CAN RUN"*, and earlier the constraint that makes it tractable: *"I DONT CARE IF
 * THEY ARE GOOD PLAYS, JUST HAVE THE MOVES SUCEED"*.
 *
 * ONE SHAPE PER TAG, NOT PER ENTITY. There are 500 moves, 272 abilities and 148 items — 920 entities —
 * but only 216 distinct tags between them. Entities that share a tag share a test shape, so designing
 * 216 shapes covers all 920, and an entity added tomorrow inherits its shape for free. That is the
 * whole argument for matching on tag shape rather than on a name, and it is why this file is generated
 * from `data/tags.json` rather than typed.
 *
 * WHAT A SHAPE IS. Not a fixture — a SPECIFICATION. For each tag: what has to be true before the click
 * (the precondition), what is clicked, what must move, and what must NOT move (the controls). A shape
 * with no negative control cannot tell a working mechanic from a dead board, which is the single most
 * common way a probe in this repository has been wrong.
 *
 * THE ARCHETYPES. Every shape reduces to one of ten, and the archetype decides what instrument can
 * even ask the question:
 *
 *   damage        a multiplier or a power change     -> dmgRange, element-wise across 16 rolls
 *   status        a major status is applied          -> board read, immunity control
 *   stat          a stat stage moves                 -> board read, non-target control
 *   refusal       something is REFUSED (binary)      -> the authority's own refusal, not a board diff
 *   field         weather/terrain/screen/hazard      -> field read, and a leak control for private ones
 *   residual      end-of-turn HP or status           -> multi-turn, with a no-trigger control
 *   entry         fires on switch-in                 -> switch-in path, ordering matters
 *   timing        resolution order or priority       -> the ORDER of events, not the board
 *   chance        fires with probability p < 1       -> A RATE ARM over N trials. NOT a single board.
 *   structural    a fact about the body itself       -> compared against the format, no battle needed
 *
 * THE CHANCE ARCHETYPE IS THE ONE THAT BREAKS PEOPLE. A 30% effect that does not fire on one staged
 * turn has told you nothing, and a probe that "confirms" it on one hit is measuring luck. Those tags
 * need N seeded trials and a confidence interval, which is a different instrument from every other row
 * here — and it is why ROADMAP #133's million-game run exists. This file marks them so nobody builds a
 * one-board test for a coin.
 *
 * MON IS A POPULATION NOBODY TESTS. 357 legal species, and no instrument compares their base stats,
 * typing, weight or legal abilities against the format. That is `structural` — it needs no battle at
 * all, just a comparison against the authority — and it is the cheapest coverage in the whole
 * catalogue. It is also exactly where a mainline-versus-Champions error would hide, which is not
 * hypothetical: 21 move fields were found carrying mainline values on 2026-08-10.
 *
 *   node engine/scenario_catalogue.js              # write data/scenario-catalogue.json
 *   node engine/scenario_catalogue.js --unclassed  # only the tags that need bespoke design
 *
 * Read-only over tags and the format. Writes one artifact. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'scenario-catalogue.json');
const ONLY_UNCLASSED = process.argv.includes('--unclassed');

require('./showdown_path.js');
const CS = require('./champions_sim.js');
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat(CS.FORMAT);
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tags.json'), 'utf8'));
const CLICKS = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'click-counts.json'), 'utf8')); }
  catch (e) { return null; }
})();

/* ---- THE ARCHETYPE RULES ------------------------------------------------------------------------
 * Matched on the tag NAME's shape and on the params it carries — never on a hand list of tags, so a
 * tag added by tag_dex tomorrow is classified without editing this file. A tag that matches nothing is
 * reported as UNCLASSED, which is a request for design rather than a failure. */
const RULES = [
  { archetype: 'chance',     when: (t, p) => hasProbability(p),
    why: 'fires with probability below 1, so a single staged turn cannot distinguish "broken" from '
       + '"did not roll". Needs N seeded trials and an interval — the rate arm, not a board read.' },
  { archetype: 'damage',     when: (t) => /damage|power|recoil|drain|crit|stab|multiplier|resist|absorb|pinch|aura|filter|reduce|boost.*(dmg|damage)/i.test(t),
    why: 'changes a damage figure. Compare dmgRange element-wise across all 16 rolls against a control '
       + 'body; a played turn does not hold the roll constant and will lie.' },
  { archetype: 'status',     when: (t) => /status|burn|paralysis|poison|sleep|freeze|confus|inflict/i.test(t),
    why: 'applies or refuses a major status. Board read. The control is a body IMMUNE to it, so '
       + '"nothing happened" cannot pass for "correctly refused".' },
  { archetype: 'stat',       when: (t) => /stat|boost|lower|drop|swap.*stat/i.test(t),
    why: 'moves a stat stage. Board read on the stage itself, with a body that should NOT move as the '
       + 'negative arm.' },
  { archetype: 'refusal',    when: (t) => /prevent|block|refus|immun|protect|guard|traps|escapes|fails|cant|seals/i.test(t),
    why: 'REFUSES something — a switch, a move, a status. Binary, and read from the authority\'s own '
       + 'refusal rather than from a board difference. An over-refusal is a defect too.' },
  { archetype: 'field',      when: (t) => /weather|terrain|screen|hazard|room|tailwind|side|gravity|aura/i.test(t),
    why: 'sets or reads field state. Read the field, and for anything PRIVATE add a leak control — the '
       + 'foe must not see it.' },
  { archetype: 'residual',   when: (t) => /perTurn|residual|endOfTurn|heal|regen|leech|wish|chip/i.test(t),
    why: 'fires at end of turn. Multi-turn scenario, with a turn where the trigger is absent as the '
       + 'negative.' },
  { archetype: 'entry',      when: (t) => /onEntry|onSwitch|entry|switchIn|intimidate|trace|imposter|download/i.test(t),
    why: 'fires on switch-in. Needs the switch-in path, and ORDER matters when both sides arrive at '
       + 'once — a copy taken before or after an opposing Intimidate is a different copy.' },
  { archetype: 'timing',     when: (t) => /priority|speed|order|first|last|reorder|instruct|after|before/i.test(t),
    why: 'changes WHEN something resolves. Compare the resolution ORDER, not the board. A genuine speed '
       + 'tie must be REFUSED rather than scored — matching a coin is not evidence.' },
];
function hasProbability(p) {
  if (!p || typeof p !== 'object') return false;
  let found = false;
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || d > 3) return;
    for (const [k, v] of Object.entries(o)) {
      if (/chance|^p$|pFlinch|odds|probability/i.test(k) && typeof v === 'number' && v > 0 && v < 100 && v !== 100) found = true;
      if (typeof v === 'object') walk(v, d + 1);
    }
  };
  walk(p, 0);
  return found;
}

function classify(tag, params) {
  for (const r of RULES) if (r.when(tag, params)) return r;
  return null;
}

/* ---- WHAT THE SUBJECT MUST BE FACING, WHICH IS NOT THE SAME AS ITS PRECONDITION ------------------
 *
 * Will, 2026-08-10: *"IE WIDE GUARD NEEDS A SPREAD MOVE AGAINST IT, ITS POINTLESS TO TEST IF IT
 * DOESNT FACE THAT"*. That is the half this catalogue was missing and it is the half that decides
 * whether a green means anything.
 *
 * A PRECONDITION is about the SUBJECT'S OWN STATE — Blaze needs the holder under a third, Spit Up
 * needs a Stockpile, a heal needs prior damage. `faces` is about the ADVERSARY'S ACTION, and a shape
 * that omits it produces a test the subject passes by doing nothing:
 *
 *   Wide Guard clicked into a SINGLE-TARGET attack     -> "succeeds", proves nothing
 *   Filter on a body hit NEUTRALLY                     -> no reduction expected, so no reduction seen
 *   Rage Powder with nobody aiming at the ally         -> nothing to redirect
 *   Counter against a special attacker                 -> returns zero, correctly, and tests nothing
 *   a trap with nobody trying to leave                 -> the refusal never fires
 *
 * Every one of those is a VACUOUS PASS: the row goes green while the mechanic was never exercised.
 * That is the same defect as "A CLICK IS NOT A TEST" one level up — the click happened, the CONDITION
 * did not. It is also, on inspection, why so much of the roster reports COULD-NOT-STAGE: the harness
 * did not know what the subject had to be facing.
 *
 * Derived from the tag's own params wherever the params say it, so a mechanic added later carries its
 * own requirement. Where it cannot be derived, that is stated — an unknown `faces` is a design task,
 * and a shape with `faces: null` and an adversarial archetype MUST NOT be trusted green. */
function facesOf(tag, params) {
  const p = params || {};
  const say = (need, why) => ({ need, why });

  if (/oneTurnGuard|wideguard|spreadGuard/i.test(tag) || (p.blocks && /spread/i.test(String(p.blocks))))
    return say('a SPREAD move aimed at the protected side',
      'a single-target attack is refused by nothing here, so the arm would be vacuous');
  if (/quickGuard/i.test(tag))
    return say('a PRIORITY move from the foe', 'it blocks priority only; a normal move proves nothing');
  if (/redirect/i.test(tag))
    return say('a SINGLE-TARGET move aimed at the ALLY, from a body that is not powder-immune',
      'nothing to redirect otherwise, and a spread move is not redirected at all');
  if (/preventsSwitch|traps/i.test(tag))
    return say('an attempted voluntary SWITCH by the trapped body',
      'the refusal cannot fire if nobody tries to leave');
  if (/typeImmunity|absorb/i.test(tag))
    return say('a move of the ABSORBED type', 'any other type tests nothing');
  if (/damageReduce/i.test(tag) && p.onlyWhen)
    return say('a move that is ' + String(p.onlyWhen), 'the reduction is conditional and does not apply otherwise');
  if (/fixedDamage|counter|comeuppance|metalburst/i.test(tag))
    return say('a DAMAGING hit of the category it reflects, taken before it moves',
      'it returns nothing when it has not been hit, which reads as a working zero');
  if (/punishesAttacker|buffsHolderOnHit|onFlinch|boostsOnFlinch/i.test(tag))
    return say('a HIT that satisfies the trigger (contact where the tag says contact)',
      'the reaction has nothing to react to');
  if (/piercesProtect|ignoresProtect/i.test(tag))
    return say('a target that IS protecting', 'bypassing a guard nobody raised is not a bypass');
  if (/protect|stalling/i.test(tag))
    return say('a damaging move it can actually block',
      'a Protect nobody attacks into is a spent turn, not a test');
  if (/thawsTarget|cures|heals.*status/i.test(tag))
    return say('a target already carrying the status it removes', 'nothing to cure otherwise');
  if (/weatherScaled|terrainScaled/i.test(tag))
    return say('the SKY or TERRAIN the tag names, set by something else first',
      'the scaling branch is dead without it, and the control is the same click with it absent');
  if (/spreadFoes|spreadAll/i.test(tag))
    return say('TWO live foes, so the spread reduction is observable',
      'a single live target cannot distinguish spread damage from single-target damage');
  return null;
}

/* ---- BUILD ------------------------------------------------------------------------------------- */
const byTag = {};
const SINGULAR = { moves: 'move', abilities: 'ability', items: 'item' };
for (const kind of ['moves', 'abilities', 'items']) {
  for (const [id, e] of Object.entries(TAGS[kind] || {})) {
    for (const t of (e.tags || [])) {
      byTag[t] = byTag[t] || { tag: t, carriers: { move: [], ability: [], item: [] }, clicks: 0, params: null };
      byTag[t].carriers[SINGULAR[kind]].push(id);
      if (kind === 'moves' && CLICKS) byTag[t].clicks += (CLICKS.moves[id] || 0);
      if (!byTag[t].params && e.params && e.params[t]) byTag[t].params = e.params[t];
    }
  }
}

const shapes = [];
for (const v of Object.values(byTag)) {
  const r = classify(v.tag, v.params);
  const f = facesOf(v.tag, v.params);
  const n = v.carriers.move.length + v.carriers.ability.length + v.carriers.item.length;
  shapes.push({
    tag: v.tag, archetype: r ? r.archetype : 'UNCLASSED',
    why: r ? r.why : 'NO ARCHETYPE MATCHED — this tag needs a scenario designed by hand. That is a '
           + 'request for design, not a defect.',
    faces: f ? f.need : null,
    faces_why: f ? f.why : null,
    entities: n, moves: v.carriers.move.length, abilities: v.carriers.ability.length,
    items: v.carriers.item.length, clicks: v.clicks,
    example_carriers: [].concat(v.carriers.move, v.carriers.ability, v.carriers.item).slice(0, 4),
  });
}
shapes.sort((a, b) => b.clicks - a.clicks || b.entities - a.entities);

/* ---- THE MON POPULATION, WHICH HAS NO TAGS AT ALL ---------------------------------------------- */
const legal = D.species.all().filter(s => !s.isNonstandard);
const monShape = {
  tag: '(species)', archetype: 'structural', entities: legal.length,
  why: 'A SPECIES IS NOT A MECHANIC AND NEEDS NO BATTLE. Its base stats, typing, weight, legal '
     + 'abilities and learnset are FACTS, and the only honest test is a direct comparison against the '
     + 'format — not against mainline gen 9, which is where 21 move fields were found to have come '
     + 'from on 2026-08-10. This is the cheapest coverage in the catalogue and nothing does it today.',
  checks: ['base stats match the format', 'typing matches', 'weight matches (Heavy Slam, Grass Knot)',
           'the legal ability set matches', 'every move on a generated set is in the learnset',
           'no forme is absent that the format allows, and none present that it forbids'],
};

const counts = {};
for (const s of shapes) counts[s.archetype] = (counts[s.archetype] || 0) + 1;

const art = {
  generated: new Date().toISOString(),
  by: 'engine/scenario_catalogue.js',
  what: 'One test SHAPE per mechanic. 920 entities across 500 moves, 272 abilities and 148 items share '
      + String(shapes.length) + ' distinct tags, so this many shapes cover all of them — and an entity '
      + 'added tomorrow inherits its shape without editing anything.',
  principle: 'A shape is a SPECIFICATION, not a fixture: the precondition, the click, what must move, '
           + 'and what must NOT. A shape with no negative control cannot tell a working mechanic from a '
           + 'dead board, which is the commonest way a probe in this repository has been wrong.',
  archetype_counts: counts,
  chance_warning: 'Tags marked `chance` CANNOT be tested on a single staged turn. A 30% effect that '
                + 'does not fire has told you nothing. They need N seeded trials and a confidence '
                + 'interval — a different instrument, and the reason the million-game run exists.',
  species: monShape,
  shapes,
};

if (ONLY_UNCLASSED) {
  const u = shapes.filter(s => s.archetype === 'UNCLASSED');
  console.log('  UNCLASSED tags — each needs a scenario designed by hand: ' + u.length + ' of ' + shapes.length);
  for (const s of u) console.log('    ' + s.tag.padEnd(28) + String(s.entities).padStart(4) + ' carriers  '
    + String(s.clicks).padStart(8) + ' clicks   e.g. ' + s.example_carriers.join(', '));
} else {
  fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
  console.log('  ' + shapes.length + ' tags -> ' + shapes.length + ' scenario shapes, covering 920 entities');
  console.log('  plus ' + legal.length + ' legal species as one structural shape\n');
  console.log('  archetype        shapes');
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1]))
    console.log('    ' + k.padEnd(16) + String(v).padStart(4));
  console.log('\n  wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
}
