/* illusion.js - catch Zoroark-Hisui pretending to be a teammate.
 *
 * The mechanic: Illusion makes Zoroark appear as another Pokemon on its own team. You do not see a
 * Zoroark; you see what looks like a Basculegion, and you plan against a Basculegion. The disguise
 * only breaks when it takes a direct hit.
 *
 * The tell: the disguise copies the NAME, not the moveset. The moment that "Basculegion" uses a move
 * Basculegion cannot legally learn - but Zoroark-Hisui can - the illusion is proven, immediately and
 * with certainty. No probability needed; it is a legality contradiction.
 *
 * This matters for belief (XATU): on 1.4% of teams, a Pokemon you are looking at may not be the
 * Pokemon you are looking at, and the moment of the reveal is a large, sudden information gain.
 *
 * Legality source: https://play.pokemonshowdown.com/data/learnsets.json (Showdown's own data).
 * Detection is CONSERVATIVE:
 *   - only teams that actually brought a Zoroark line are considered;
 *   - a move must be absent from the apparent species' learnset AND present in Zoroark's;
 *   - species with no learnset entry are skipped rather than guessed at.
 * So a flag is a proof, and the count is a floor, never an estimate.
 *
 *   node engine/illusion.js
 * Writes data/illusion.json
 */
'use strict';
const fs = require('fs'), path = require('path');
const D = p => path.join(__dirname, '..', 'data', p);
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ZOROARKS = ['zoroarkhisui', 'zoroark'];

async function main() {
  const LS = await (await fetch('https://play.pokemonshowdown.com/data/learnsets.json')).json();

  // full learnset for a species, walking prevo/base chains so a mon is not penalised for
  // inheriting a move from its earlier stage
  const dex = await (await fetch('https://play.pokemonshowdown.com/data/pokedex.json')).json();
  const cache = {};
  function learns(sp) {
    if (cache[sp]) return cache[sp];
    const out = new Set();
    let cur = sp, guard = 0;
    while (cur && guard++ < 6) {
      const l = LS[cur] && LS[cur].learnset;
      if (l) Object.keys(l).forEach(mv => out.add(mv));
      const e = dex[cur];
      if (!e) break;
      const nxt = e.prevo ? norm(e.prevo) : (e.baseSpecies && norm(e.baseSpecies) !== cur ? norm(e.baseSpecies) : null);
      cur = nxt;
    }
    return (cache[sp] = out);
  }

  const zMoves = new Set();
  ZOROARKS.forEach(z => learns(z).forEach(m => zMoves.add(m)));

  const games = [];
  for (const line of fs.readFileSync(D('games.ladder.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { games.push(JSON.parse(line)); } catch { /* truncated line */ }
  }

  let teamsWithZ = 0, gamesChecked = 0, detections = [], byDisguise = {}, byMove = {};
  const noLearnset = new Set();

  for (const g of games) {
    for (const side of ['p1', 'p2']) {
      const six = (g.six && g.six[side]) || [];
      if (!six.length) continue;
      const zHere = six.filter(m => ZOROARKS.includes(m));
      if (!zHere.length) continue;
      teamsWithZ++;

      // which species did this side actually use moves with?
      const used = {};   // species -> Set(moves)
      for (const t of (g.turns || [])) {
        for (const e of (t.ev || [])) {
          if (e.t !== 'm' || !e.mv || !e.mon) continue;
          if (!String(e.s || '').startsWith(side)) continue;
          (used[e.mon] = used[e.mon] || new Set()).add(norm(e.mv));
        }
      }
      gamesChecked++;

      for (const [sp, moves] of Object.entries(used)) {
        if (ZOROARKS.includes(sp)) continue;          // the real thing, not a disguise
        const own = learns(sp);
        if (!own.size) { noLearnset.add(sp); continue; }
        for (const mv of moves) {
          if (!own.has(mv) && zMoves.has(mv)) {
            detections.push({ game: g.id, side, appeared_as: sp, move: mv, zoroark: zHere[0] });
            byDisguise[sp] = (byDisguise[sp] || 0) + 1;
            byMove[mv] = (byMove[mv] || 0) + 1;
          }
        }
      }
    }
  }

  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => ({ name: k, n: v }));
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    n_games: games.length,
    team_sides_with_a_zoroark: teamsWithZ,
    detections: detections.length,
    detection_rate_per_zoroark_side: teamsWithZ ? +(detections.length / teamsWithZ).toFixed(4) : 0,
    method: ('A flag requires a legality contradiction: the apparent species cannot learn the move '
      + 'and Zoroark can. Learnsets from Showdown, walked through prevo/base forms. Species with no '
      + 'learnset data are skipped, so this is a FLOOR on how often Illusion was used, not an estimate.'),
    caveat: ('Illusion is only caught when the disguise actually clicks a Zoroark-exclusive move. A '
      + 'Zoroark that only used shared coverage, or that was broken by a hit before moving, is '
      + 'invisible to this test.'),
    most_common_disguises: top(byDisguise),
    most_revealing_moves: top(byMove),
    species_without_learnset_data: [...noLearnset].slice(0, 20),
    examples: detections.slice(0, 15),
  };
  fs.writeFileSync(D('illusion.json'), JSON.stringify(out, null, 1));

  console.log(`illusion.js - ${games.length} games, ${teamsWithZ} team-sides brought a Zoroark line`);
  console.log(`  proven disguises: ${detections.length} (${out.detection_rate_per_zoroark_side} per Zoroark side)`);
  console.log('  most common disguises:', out.most_common_disguises.slice(0, 6).map(d => `${d.name}(${d.n})`).join(', ') || 'none');
  console.log('  moves that gave it away:', out.most_revealing_moves.slice(0, 6).map(d => `${d.name}(${d.n})`).join(', ') || 'none');
  if (noLearnset.size) console.log(`  (skipped ${noLearnset.size} species with no learnset data)`);
}
main();
