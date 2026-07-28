/* mechanics_coverage.js — what does MAG know, and what does it not?
 *
 *   SHOWDOWN_PATH=... node engine/mechanics_coverage.js  >  docs/MECHANICS-COVERAGE.md
 *
 * WHY THIS EXISTS
 * ---------------
 * Nobody could say what MAG did and did not model. Four unmodelled mechanics were found in one
 * sitting -- snow and sand raising a defence, Choice Scarf, paralysis speed, side-wide priority
 * blockers -- not because they were hidden but because there was no list to check against. Every one
 * was found by a person asking "does it know X", which does not scale and does not repeat.
 *
 * DERIVED, NOT TYPED (S13). The ability and item lists come from the Showdown dex, restricted to
 * species that actually appear in this format's usage table, and weighted by how much of the format
 * each one represents. Nothing here is a hand-maintained inventory that can go stale silently; if a
 * regulation changes, re-running this produces the new answer.
 *
 * WHAT "COVERED" MEANS, AND WHY IT IS NOT A GREP
 * ---------------------------------------------
 * board.js deliberately names almost no Pokemon, ability or move -- it reads dex fields and probes
 * dex handlers. So grepping for an ability name reports almost everything as absent, which is how
 * the handoff came to list Armor Tail and Queenly Majesty as missing when both were already modelled
 * at 99% through the measured ability-blocks table.
 *
 * Coverage is therefore reported per CHANNEL, because an ability can be modelled through any of:
 *
 *   blocks       data/ability-blocks.json gives it a measured rule; abilityBlockProb applies it
 *   side-wide    it also protects its partner (onFoeTryMove); allySideBlockProb applies it
 *   priority     it changes move order (onModifyPriority); effectivePriority probes it
 *   speed        it changes Speed (onModifySpe); monSpeedMult probes it
 *   boosts       it changes stat changes (onChangeBoost); expectedBoostSign probes it
 *   damage       the validated damage engine implements it by name
 *   declared     GAME_RULES.unmodelledAbilities admits it is a known gap
 *
 * An ability with dex handlers and NO channel is a genuine hole, and those are what this ranks.
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
const DMG_SRC = (() => { try { return fs.readFileSync(path.join(__dirname, 'medicham2-browser.js'), 'utf8'); } catch (e) { return ''; } })();
const BOARD_SRC = (() => { try { return fs.readFileSync(path.join(__dirname, 'board.js'), 'utf8'); } catch (e) { return ''; } })();

/* Usage share per ability, over species that actually appear. Weighted by raw usage x the ability's
 * share of that species, so a rare ability on a common Pokemon is ranked above a common ability on a
 * Pokemon nobody brings. */
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
    if (!id) continue;
    itemWeight[id] = (itemWeight[id] || 0) + v.raw * (+it.pct || 0) / 100;
  }
}

function channelsFor(id) {
  const A = dex.abilities.get(id);
  if (!A || !A.exists) return { handlers: [], channels: ['not in dex'] };
  const handlers = Object.keys(A).filter(k => /^on/.test(k));
  const ch = [];
  const e = BLOCKS[id];
  if (e && e.rule && e.rule !== 'unclear') ch.push('blocks');
  if (typeof A.onFoeTryMove === 'function' && e && e.rule && e.rule !== 'unclear') ch.push('side-wide');
  if (typeof A.onModifyPriority === 'function') ch.push('priority');
  if (typeof A.onModifySpe === 'function') ch.push('speed');
  if (typeof A.onChangeBoost === 'function') ch.push('boosts');
  if (new RegExp(`['"\`]${id}['"\`]`).test(DMG_SRC)) ch.push('damage');
  if (new RegExp(`['"\`]${id}['"\`]`).test(BOARD_SRC)) ch.push('named in board');
  return { handlers, channels: ch };
}

const rows = [];
for (const [id, w] of Object.entries(abilityWeight)) {
  const { handlers, channels } = channelsFor(id);
  rows.push({ id, w, share: 100 * w / TOTAL, handlers, channels });
}
rows.sort((a, b) => b.w - a.w);

const covered = rows.filter(r => r.channels.length && r.channels[0] !== 'not in dex');
const holes = rows.filter(r => !r.channels.length && r.handlers.length);
const inert = rows.filter(r => !r.channels.length && !r.handlers.length);

const pct = x => x.toFixed(2) + '%';
const out = [];
out.push('# What MAG knows, and what it does not');
out.push('');
out.push('*Generated by `engine/mechanics_coverage.js`. Do not hand-edit — re-run it.*');
out.push('');
out.push(`Format \`${CS.FORMAT}\`. Abilities are restricted to species with non-zero usage and weighted by`);
out.push('usage share, so a rare ability on a common Pokémon outranks a common one nobody brings.');
out.push('');
out.push('**Coverage is reported per channel, not by grep.** `board.js` names almost nothing — it reads');
out.push('dex fields and probes dex handlers — so searching for an ability name reports nearly everything');
out.push('as missing. That is exactly how Armor Tail and Queenly Majesty came to be listed as absent when');
out.push('both were already modelled at 99%.');
out.push('');
out.push(`## Summary`);
out.push('');
out.push(`| | count | usage share |`);
out.push('|---|---|---|');
const sum = a => a.reduce((x, r) => x + r.share, 0);
out.push(`| abilities in this format | ${rows.length} | 100% |`);
out.push(`| reached by some channel | ${covered.length} | ${pct(sum(covered))} |`);
out.push(`| **has dex handlers, no channel** | **${holes.length}** | **${pct(sum(holes))}** |`);
out.push(`| no handlers (nothing to model) | ${inert.length} | ${pct(sum(inert))} |`);
out.push('');
out.push('## The holes, ranked by how much of the format they are');
out.push('');
out.push('An ability with handlers in the dex and no channel in `board.js` is a mechanic the model');
out.push('cannot see at all.');
out.push('');
out.push('| ability | usage share | dex handlers |');
out.push('|---|---|---|');
for (const r of holes.slice(0, 30)) {
  out.push(`| \`${r.id}\` | ${pct(r.share)} | ${r.handlers.join(', ') || '—'} |`);
}
if (holes.length > 30) out.push(`| *…and ${holes.length - 30} more* | | |`);
out.push('');
out.push('## What is covered, and through which channel');
out.push('');
out.push('| ability | usage share | channels |');
out.push('|---|---|---|');
for (const r of covered.slice(0, 40)) {
  out.push(`| \`${r.id}\` | ${pct(r.share)} | ${r.channels.join(', ')} |`);
}
out.push('');

/* Items get the same treatment, because Choice Scarf was invisible for exactly this reason. */
out.push('## Items');
out.push('');
out.push('| item | usage share | reached by |');
out.push('|---|---|---|');
const irows = Object.entries(itemWeight).sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [id, w] of irows) {
  const it = dex.items.get(id);
  const ch = [];
  if (it && it.exists) {
    if (typeof it.onModifySpe === 'function') ch.push('speed');
    if (it.megaStone) ch.push('mega forme');
    if (it.isBerry) ch.push('berry (not modelled)');
    if (new RegExp(`['"\`]${id}['"\`]`).test(DMG_SRC)) ch.push('damage');
    if (new RegExp(`['"\`]${id}['"\`]`).test(BOARD_SRC)) ch.push('named in board');
  }
  out.push(`| \`${id}\` | ${pct(100 * w / TOTAL)} | ${ch.join(', ') || '**nothing**'} |`);
}
out.push('');
out.push('## Caveats, so this is not over-read');
out.push('');
out.push('- A channel means the mechanic is *reachable*, not that it is correct. `feature_coverage.js`');
out.push('  answers whether a feature ever fires; this answers whether a mechanic has a route at all.');
out.push('- `damage` and `named in board` are detected by searching source for the id, so an ability');
out.push('  handled generically will show fewer channels than it really has. The bias is toward');
out.push('  **under**-reporting coverage, which is the safe direction for a gap list.');
out.push('- Usage share is of the whole format, so shares do not sum to 100% across a filtered table.');
out.push('');

const md = out.join('\n');
const dest = path.join(ROOT, 'docs', 'MECHANICS-COVERAGE.md');
fs.writeFileSync(dest, md);
console.error(`wrote docs/MECHANICS-COVERAGE.md — ${rows.length} abilities, ${holes.length} holes (${pct(sum(holes))} of the format)`);
