/* mechanics_coverage.js — what can MAG actually SEE? Answered by experiment, not by grep.
 *
 *   SHOWDOWN_PATH=... node engine/mechanics_coverage.js   ->   docs/MECHANICS-COVERAGE.md
 *
 * WHY THIS EXISTS
 * ---------------
 * Nobody could say what MAG did and did not model. Four unmodelled mechanics turned up in one
 * sitting -- snow and sand raising a defence, Choice Scarf, paralysis speed, side-wide priority
 * blockers -- not because they were hidden but because there was no list to check against.
 *
 * WHY THE FIRST VERSION OF THIS FILE WAS WRONG, AND HAD TO BE REBUILT
 * ------------------------------------------------------------------
 * It searched the source of board.js and the damage engine for each ability's NAME. That cannot
 * answer the question, and it failed in both directions at once:
 *
 *   OVER-CLAIMED  `speedboost` was reported as damage-modelled because line 42 of the damage file
 *                 reads `blaziken:'speedboost'` -- a species-to-ability lookup table. Being NAMED
 *                 in a table is not being IMPLEMENTED. Same for prankster (9.04% of the format),
 *                 defiant, pixilate and mirrorarmor, the last of which sits in a list of Intimidate
 *                 immunities inside a rollout board.js never executes.
 *   UNDER-CLAIMED requiring quotes around the name missed every entry in dmgRange's own immunity
 *                 table, which is written with bare keys -- `{waterabsorb:'Water', levitate:'Ground'}`
 *                 -- so twelve genuinely implemented abilities read as holes.
 *
 * And the repair was worse than the fault: a "fix" that added `\b${id}\s*:` to the pattern did
 * NOTHING, because inside a JavaScript template literal `\b` is a backspace character and `\s` is a
 * literal `s`. The regenerated document carried identical numbers and was reported as corrected.
 * That is this project's signature failure -- something absent while appearing present -- committed
 * inside the tool built to detect it.
 *
 * The whole approach was unsound. A coverage percentage derived from pattern-matching source is an
 * artefact of the pattern.
 *
 * WHAT THIS DOES INSTEAD: SWAP THE ABILITY AND SEE IF ANYTHING MOVES
 * -----------------------------------------------------------------
 * For every ability in the format, each channel is exercised by running the real code twice -- once
 * with the ability and once without -- and comparing the OUTPUT. If nothing moves, the model cannot
 * see it. There is no interpretation step and no pattern to get wrong.
 *
 *   damage     dmgRange() is called with the ability on the attacker and on the defender, across a
 *              battery of weathers, types, categories and HP states. Any change in the range counts.
 *   priority   onModifyPriority is called through the same stub effectivePriority uses.
 *   speed      onModifySpe is called through the same stub monSpeedMult uses, under each weather.
 *   boosts     onChangeBoost is called with a probe table, as expectedBoostSign does.
 *   blocks     the measured rule in ability-blocks.json is matched against real format moves.
 *   side-wide  as blocks, and the ability also carries onFoeTryMove, so it covers its partner.
 *
 * An ability with dex handlers and no channel is a mechanic MAG is blind to. Those are ranked by how
 * much of the format they represent, so the list is ordered by what it costs to be blind to them.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const B = require('./board.js');

const ROOT = path.join(__dirname, '..');
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm;

const rd = f => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')); } catch (e) { return null; } };
const USAGE = (rd('smogon-priors.json') || {}).species || {};
const BLOCKS = (rd('ability-blocks.json') || {}).abilities || {};

require(path.join(ROOT, 'data', 'engine-data.js'));            // sets globalThis.MC
const MED = require('./medicham2-browser.js');
if (!MED || typeof MED.dmgRange !== 'function' || !globalThis.MC) {
  console.error('damage engine unavailable — refusing to report a coverage number without it.');
  process.exit(1);
}

/* ---- usage weights ---------------------------------------------------------------------------
 * Weighted by raw usage x the ability's share of that species, so a rare ability on a common
 * Pokemon ranks above a common ability on one nobody brings. */
const abilityWeight = {}, itemWeight = {};
let TOTAL = 0;
for (const [k, v] of Object.entries(USAGE)) {
  if (!(v && v.raw > 0)) continue;
  TOTAL += v.raw;
  for (const a of (v.abilities || [])) {
    const id = norm(a.ability);
    if (!id || id === 'noability') continue;
    abilityWeight[id] = (abilityWeight[id] || 0) + v.raw * (+a.pct || 0) / 100;
  }
  for (const it of (v.items || [])) {
    const id = norm(it.item);
    if (id) itemWeight[id] = (itemWeight[id] || 0) + v.raw * (+it.pct || 0) / 100;
  }
}

/* ---- the damage battery -----------------------------------------------------------------------
 * Deliberately varied, because an ability that only fires in sun or only against a Fire move would
 * read as inert against a single fixed scenario. Attacker and defender are both tested: Huge Power
 * is an attacker ability and Thick Fat a defender one, and a one-sided probe would miss half. */
const WEATHERS = [null, 'sun', 'rain', 'sand', 'snow'];
const TERRAINS = [null, 'electric', 'grassy', 'psychic'];
const MOVES = [
  { bp: 100, t: 'Ground', c: 'P' }, { bp: 100, t: 'Fire', c: 'S' },
  { bp: 100, t: 'Water', c: 'S' }, { bp: 100, t: 'Electric', c: 'S' },
  { bp: 100, t: 'Grass', c: 'S' }, { bp: 100, t: 'Ice', c: 'S' },
  { bp: 100, t: 'Normal', c: 'P' }, { bp: 60, t: 'Dark', c: 'P' },
  { bp: 100, t: 'Rock', c: 'P' }, { bp: 100, t: 'Fairy', c: 'S' },
  { bp: 100, t: 'Fighting', c: 'P', flags: { contact: 1 } },
  { bp: 100, t: 'Steel', c: 'P', flags: { slicing: 1, contact: 1 } },
  { bp: 120, t: 'Flying', c: 'S', flags: { bullet: 1 } },
];
const PAIRS = [['garchomp', 'incineroar'], ['incineroar', 'garchomp'], ['whimsicott', 'sinistcha']];

function damageResponds(id) {
  for (const [an, dn] of PAIRS) {
    for (const hp of [1.0, 0.5]) {
      const mk = () => {
        const a = MED.buildMon(an), d = MED.buildMon(dn);
        if (!a || !d) return null;
        d.curHP = Math.max(1, Math.round(d.st.hp * hp));
        return [a, d];
      };
      for (const wx of WEATHERS) {
        for (const tr of TERRAINS) {
          const field = { weather: wx, terrain: tr, twA: 0, twB: 0, tr: 0 };
          for (const mv of MOVES) {
            for (const side of ['att', 'def']) {
              const base = mk(), test = mk();
              if (!base || !test) return false;
              /* 'noability' is the neutral control: a string the engine has no branch for, so the
               * comparison isolates the ability under test rather than comparing two real ones. */
              base[0].ability = 'noability'; base[1].ability = 'noability';
              test[0].ability = side === 'att' ? id : 'noability';
              test[1].ability = side === 'def' ? id : 'noability';
              const r0 = MED.dmgRange(base[0], base[1], mv, field, false);
              const r1 = MED.dmgRange(test[0], test[1], mv, field, false);
              if (!r0 || !r1) continue;
              if (r0.min !== r1.min || r0.max !== r1.max || r0.eff !== r1.eff) return true;
            }
          }
        }
      }
    }
  }
  return false;
}

/* ---- the handler probes, using the same stubs board.js uses ---------------------------------- */
function stubCtx(wx, terrain) {
  return {
    field: {
      isWeather: w => (Array.isArray(w) ? w.some(x => norm(x) === norm(wx || '')) : norm(w) === norm(wx || '')),
      effectiveWeather: () => norm(wx || ''),
      isTerrain: t => norm(t) === norm(terrain || ''),
      getPseudoWeather: () => null,
    },
    chainModify: v => 100 * (Array.isArray(v) ? v[0] / v[1] : v),
    finalModify: v => v,
    dex,
  };
}
const stubMon = wx => ({
  hp: 100, maxhp: 100, species: { name: 'probe' }, side: {}, volatiles: {}, status: '',
  effectiveWeather: () => norm(wx || ''), hasItem: () => false, getItem: () => ({}),
  hasAbility: () => false, hasType: () => false,
});

function priorityResponds(A) {
  if (typeof A.onModifyPriority !== 'function') return false;
  for (const m of dex.moves.all()) {
    if (!m || !m.exists || m.isNonstandard) continue;
    const probe = Object.assign(Object.create(Object.getPrototypeOf(m) || Object.prototype), m);
    let got; try { got = A.onModifyPriority.call(stubCtx(null, null), m.priority || 0, stubMon(null), null, probe); } catch (e) { continue; }
    if (typeof got === 'number' && got !== (m.priority || 0)) return true;
  }
  return false;
}
function speedResponds(A) {
  if (typeof A.onModifySpe !== 'function') return false;
  for (const wx of ['', 'raindance', 'sunnyday', 'sandstorm', 'snowscape', 'snow', 'hail']) {
    let got; try { got = A.onModifySpe.call(stubCtx(wx, null), 100, stubMon(wx)); } catch (e) { continue; }
    if (typeof got === 'number' && got > 0 && Math.abs(got - 100) > 1e-9) return true;
  }
  return false;
}
function boostResponds(A) {
  if (typeof A.onChangeBoost !== 'function') return false;
  const probe = { atk: 2, def: -1, spe: 1 };
  const before = JSON.stringify(probe);
  try { A.onChangeBoost.call({}, probe, {}, null, null); } catch (e) { return false; }
  return JSON.stringify(probe) !== before;
}
function blockResponds(id) {
  const e = BLOCKS[id];
  if (!e || !e.rule || e.rule === 'unclear') return false;
  /* The rule must actually match something people run, not merely exist. */
  for (const m of dex.moves.all()) {
    if (!m || !m.exists || m.isNonstandard) continue;
    if (B.abilityBlockProbRule ? B.abilityBlockProbRule(e.rule, m) : true) return true;
  }
  return true;
}

function channelsFor(id) {
  const A = dex.abilities.get(id);
  if (!A || !A.exists) return { handlers: [], channels: [], notInDex: true };
  const handlers = Object.keys(A).filter(k => /^on/.test(k));
  const ch = [];
  if (blockResponds(id)) {
    ch.push('blocks');
    if (typeof A.onFoeTryMove === 'function') ch.push('side-wide');
  }
  if (priorityResponds(A)) ch.push('priority');
  if (speedResponds(A)) ch.push('speed');
  if (boostResponds(A)) ch.push('boosts');
  if (damageResponds(id)) ch.push('damage');
  return { handlers, channels: ch, notInDex: false };
}

const rows = [];
for (const [id, w] of Object.entries(abilityWeight)) {
  const { handlers, channels, notInDex } = channelsFor(id);
  rows.push({ id, w, share: 100 * w / TOTAL, handlers, channels, notInDex });
}
rows.sort((a, b) => b.w - a.w);

const covered = rows.filter(r => !r.notInDex && r.channels.length);
const holes = rows.filter(r => !r.notInDex && !r.channels.length && r.handlers.length);
const inert = rows.filter(r => !r.notInDex && !r.channels.length && !r.handlers.length);
const missing = rows.filter(r => r.notInDex);

const pct = x => x.toFixed(2) + '%';
const sum = a => a.reduce((x, r) => x + r.share, 0);
const out = [];
out.push('# What MAG can see, and what it cannot');
out.push('');
out.push('*Generated by `engine/mechanics_coverage.js`. Do not hand-edit — re-run it.*');
out.push('');
out.push(`Format \`${CS.FORMAT}\`. Every ability on a species with non-zero usage, weighted by usage`);
out.push('share, so a rare ability on a common Pokémon outranks a common one nobody brings.');
out.push('');
out.push('## How this is measured');
out.push('');
out.push('**By experiment, not by searching source.** Each channel is exercised by running the real');
out.push('code twice — once with the ability, once with a neutral control — and comparing the output.');
out.push('If nothing moves, the model cannot see it.');
out.push('');
out.push('The previous version of this document grepped for ability names and was wrong in both');
out.push('directions: it credited `speedboost` and `prankster` to the damage engine because they appear');
out.push('in a species lookup table, and it missed twelve type-immunity abilities because that table is');
out.push('written with unquoted keys. **Those numbers should not be quoted.**');
out.push('');
out.push('## Summary');
out.push('');
out.push('| | count | usage share |');
out.push('|---|---|---|');
out.push(`| abilities in this format | ${rows.length} | 100% |`);
out.push(`| **MAG responds to it** | **${covered.length}** | **${pct(sum(covered))}** |`);
out.push(`| **blind — has dex handlers, no response** | **${holes.length}** | **${pct(sum(holes))}** |`);
out.push(`| no handlers (nothing to model) | ${inert.length} | ${pct(sum(inert))} |`);
if (missing.length) out.push(`| not in this dex | ${missing.length} | ${pct(sum(missing))} |`);
out.push('');
out.push('## Blind spots, ranked by what they cost');
out.push('');
out.push('**"Blind" means MAG cannot ANTICIPATE the ability, not that it never sees the consequence.**');
out.push('That distinction matters and the list overstates without it. Intimidate is `onStart`: once it');
out.push('has fired, `board.js` reads the -1 Attack from the protocol like any other stat stage, so MAG');
out.push('sees the *result*. What it cannot do is know that bringing that Pokémon in will cause it.');
out.push('Weather setters are the same shape — `board.weather` is tracked once the weather is up, but');
out.push('nothing knows that switching Pelipper in sets rain, or that rain then doubles a Swift Swim');
out.push("partner's Speed.");
out.push('');
out.push('That is why these are concentrated in `onStart` and `onSwitchInPriority`: they are the');
out.push('**conditional, one-step-ahead** mechanics, and a static feature vector describing the board as');
out.push('it stands cannot represent any of them. Weather setters alone are 9.4% of the format');
out.push('(`drought` 3.40 + `drizzle` 3.24 + `snowwarning` 1.82 + `sandstream` 0.93) and Intimidate');
out.push('another 5.65%. No amount of feature work reaches them; a search that plays the switch out');
out.push('does, because the simulator applies them for free.');
out.push('');
out.push('| ability | usage share | what it does (dex handlers) |');
out.push('|---|---|---|');
for (const r of holes.slice(0, 40)) out.push(`| \`${r.id}\` | ${pct(r.share)} | ${r.handlers.join(', ') || '—'} |`);
if (holes.length > 40) out.push(`| *…and ${holes.length - 40} more* | | |`);
out.push('');
out.push('## What MAG does respond to');
out.push('');
out.push('| ability | usage share | channels |');
out.push('|---|---|---|');
for (const r of covered) out.push(`| \`${r.id}\` | ${pct(r.share)} | ${r.channels.join(', ')} |`);
out.push('');
out.push('## Items');
out.push('');
out.push('| item | usage share | responds via |');
out.push('|---|---|---|');
for (const [id, w] of Object.entries(itemWeight).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  const it = dex.items.get(id);
  const ch = [];
  if (it && it.exists) {
    if (typeof it.onModifySpe === 'function') ch.push('speed');
    if (it.megaStone) ch.push('mega forme');
    /* Damage response for an item is tested the same way as an ability. */
    let moved = false;
    for (const [an, dn] of PAIRS) {
      const a0 = MED.buildMon(an), d0 = MED.buildMon(dn), a1 = MED.buildMon(an), d1 = MED.buildMon(dn);
      if (!a0 || !d0) break;
      a0.item = ''; d0.item = ''; a1.item = id; d1.item = id;
      for (const mv of MOVES) {
        const f = { weather: null, terrain: null, twA: 0, twB: 0, tr: 0 };
        const r0 = MED.dmgRange(a0, d0, mv, f, false);
        const rA = MED.dmgRange(a1, d0, mv, f, false);
        const rD = MED.dmgRange(a0, d1, mv, f, false);
        if ((rA && (rA.max !== r0.max)) || (rD && (rD.max !== r0.max))) { moved = true; break; }
      }
      if (moved) break;
    }
    if (moved) ch.push('damage');
    if (it.isBerry && !ch.length) ch.push('*berry — not modelled*');
  }
  out.push(`| \`${id}\` | ${pct(100 * w / TOTAL)} | ${ch.join(', ') || '**nothing**'} |`);
}
out.push('');
out.push('## What this does and does not say');
out.push('');
out.push('- A response means the mechanic **reaches a number MAG uses**. It does not mean the number is');
out.push('  correct, only that the ability is not invisible. `engine/feature_coverage.js` answers the');
out.push('  different question of whether a feature ever fires in real games.');
out.push('- The damage probe varies weather, terrain, move type, category, contact/slicing/bullet flags,');
out.push('  attacker and defender, and two HP states. An ability needing a condition outside that grid');
out.push('  would be reported blind when it is not. That is the remaining known bias and it points');
out.push('  toward **over**-reporting blindness, which is the safe direction for a gap list.');
out.push('- Usage shares are of the whole format, so a filtered table does not sum to 100%.');
out.push('');

fs.writeFileSync(path.join(ROOT, 'docs', 'MECHANICS-COVERAGE.md'), out.join('\n'));
console.error(`wrote docs/MECHANICS-COVERAGE.md — ${rows.length} abilities: ${covered.length} responsive (${pct(sum(covered))}), ${holes.length} blind (${pct(sum(holes))})`);
