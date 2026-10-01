/* solver/tournaments/archetypes.js — how much a tournament team counts, and which teams are "the same team". Pre-stated.
 *
 * THE WEIGHT of one team (Will, 2026-10-01: weight by placing and event size, bigger events more):
 *   w = TIER_W[tier] x SIZE(players) x PLACE(placing)
 *   TIER_W   worlds 4, international 2, national 1.5, regional 1, special 1, community 0.5, online 0.5 — an
 *            International draws the strongest field below Worlds and pays the most CP; a national circuit (Japan,
 *            Korea, the Asia-Pacific leagues) is the top domestic level there. Judgement, stated here, not fitted.
 *   SIZE     log10(max(players, 10)) / 3 — 1,000 Masters is 1.0; a 330-player regional 0.84; a 55-player online
 *            community event 0.58. Logarithmic: a bigger field is a deeper Swiss, not a proportionally better result.
 *   PLACE    1 / sqrt(placing) — 1st 1.0, 4th 0.5, 16th 0.25, 100th 0.1. Every published team counts a little; the
 *            top cut counts most.
 *
 * THE ARCHETYPE (variety): leader clustering on the six species. Teams in descending weight; a team joins the first
 * cluster whose LEADER shares at least SHARE (4) of its six species, else it leads a new one. So every leader shares at
 * most 3 species with every other leader — two rotation teams can never be near-mirrors — and the leader of a cluster is
 * its best result. A cluster's weight is the sum of its members' weights: how much of the published top field it is.
 * Species identity is the dex species id of the sheet (a mega stone does not change it; the label names the megas).
 */
'use strict';
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const TIER_W = { worlds: 4, international: 2, national: 1.5, regional: 1, special: 1, community: 0.5, online: 0.5 };
const SHARE = 4;
const size = players => Math.log10(Math.max(+players || 0, 10)) / 3;
const place = placing => 1 / Math.sqrt(Math.max(1, +placing || 1));
function weight(team, ev) { return (TIER_W[ev.tier] != null ? TIER_W[ev.tier] : TIER_W.community) * size(ev.players) * place(team.placing); }

/* sixOf(team, X?) -> sorted dex species ids */
function sixOf(t, X) { return t.sets.map(s => (X ? X.D.species.get(s.species).id : '') || toID(s.species)).sort(); }
/* the mega formes a team can make: a held stone that evolves that species (read from the dex) */
function megasOf(t, X) {
  if (!X) return t.sets.filter(s => s.mega).map(s => s.mega);
  const out = [];
  for (const s of t.sets) {
    const sp = X.D.species.get(s.species), it = X.D.items.get(s.item || '');
    if (!it.exists || !it.megaStone) continue;
    const m = typeof it.megaStone === 'object' ? it.megaStone[sp.name] : (it.megaEvolves === sp.name ? it.megaStone : null);
    if (m) out.push(m);
  }
  return out;
}

/* teams [{team, ev}] -> clusters [{ leader, members:[{team, ev, w}], weight, label, core }] in descending weight */
function cluster(items, X) {
  const xs = items.map(x => Object.assign({}, x, { w: weight(x.team, x.ev), six: sixOf(x.team, X) }))
    .sort((a, b) => b.w - a.w || (a.team.team_id < b.team.team_id ? -1 : 1));
  const cl = [];
  for (const x of xs) {
    const s = new Set(x.six);
    const c = cl.find(c => c.leader.six.filter(z => s.has(z)).length >= SHARE);
    if (c) c.members.push(x); else cl.push({ leader: x, members: [x] });
  }
  for (const c of cl) {
    c.weight = c.members.reduce((a, m) => a + m.w, 0);
    const freq = {}; for (const m of c.members) for (const sp of m.six) freq[sp] = (freq[sp] || 0) + m.w;
    c.core = Object.entries(freq).map(([sp, w]) => [sp, +(w / c.weight).toFixed(3)]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const megas = megasOf(c.leader.team, X);
    const megaBase = new Set(megas.map(m => toID(X ? X.D.species.get(m).baseSpecies : m)));
    const rest = c.core.filter(([sp]) => !megaBase.has(sp)).slice(0, 2).map(([sp]) => X ? X.D.species.get(sp).name : sp);
    c.label = (megas.length ? megas.join(' + ') : 'no mega') + ' / ' + rest.join(', ');
  }
  return cl.sort((a, b) => b.weight - a.weight || (a.leader.team.team_id < b.leader.team.team_id ? -1 : 1));
}

module.exports = { TIER_W, SHARE, size, place, weight, sixOf, megasOf, cluster };
