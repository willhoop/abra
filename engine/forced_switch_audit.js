/* forced_switch_audit.js — when a human's Pokemon faints, what decides which one they send in?
 *
 *   SHOWDOWN_PATH=... node engine/forced_switch_audit.js
 *
 * READ ONLY. Writes no weights, no artifact, and changes no decision path. It exists to answer one
 * question before the forced-replacement lever is ever defaulted on: is there a LEARNABLE signal in
 * this decision at all, and do the features MAG now scores it with point the right way?
 *
 * WHY THIS IS NOT A FIT, AND WHY IT DOES NOT REUSE fit_policy's REPLAY
 * -------------------------------------------------------------------
 * fit_policy.js deliberately drops these decisions -- "a `t:'s'` covers two different acts, a player
 * deciding to pull something out, and a player being made to replace something that just fainted.
 * Only the first is a decision" (fit_policy.js:326). That is right for the MOVE choice and it means
 * the replacement choice has never been fitted by anything.
 *
 * Fitting it properly needs the board as it stands AFTER the turn's faints resolve, which is when
 * Showdown asks for replacements. fit_policy's replay applies faints in a separate pass from the one
 * that reads decisions, so getting that state right means interleaving two passes that its own
 * comment calls subtle ("a second copy of them would drift"). A subtly wrong fit is worse than no
 * fit -- it produces confident weights nobody can audit -- so this file does not attempt one.
 *
 * Instead it reads the sequence straight out of the protocol log, where a forced replacement is
 * unambiguous: `|faint|p1a: X` and then `|switch|p1a: Y` on the SAME slot. No board reconstruction,
 * so nothing subtle to get wrong. The candidates and the foes are read from the log; the Pokemon
 * themselves are built from the game's own team sheets, so item, ability and nature are the real
 * declared ones.
 *
 * THE CONDITION, AND ITS KNOWN BIAS. A replacement's alternatives are the brought four minus the
 * dead minus whoever is still out, so the four have to be identifiable -- which means only games
 * that revealed all four can be read. engine/bring_bias.js measures exactly this rule: it keeps
 * longer games (mean 8.09 turns kept vs 5.13 dropped, 26.0% of otherwise-clean games dropped, the
 * two bring distributions 5.8% apart in total variation). So these counts describe games that lasted
 * long enough to show their team, not all games, and the direction of that bias is toward positions
 * where more Pokemon have already died.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const B = require(path.join(ROOT, 'engine', 'board.js'));
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const FP = require(path.join(ROOT, 'engine', 'fit_policy.js'));
const norm = B.norm, base = B.baseSpecies;

/* ---- the clean corpus, through the same gate the fit uses ------------------------------------- */
process.stderr.write('loading clean open-sheet games...\n');
const { games, rejected } = FP.loadCorpus();
const byId = new Map();
for (const g of games) if (g.id) byId.set(String(g.id), g);
process.stderr.write(`  ${games.length.toLocaleString()} clean games, ${byId.size.toLocaleString()} with ids\n`);

/* Sheet -> a mon the damage engine can use. The sheet is public on this ladder, so item/ability/
 * nature are the declared ones rather than the dataset's assumed build. */
function buildFromSheet(sheetEntry) {
  if (!sheetEntry || !sheetEntry.species) return null;
  const key = MC.mons[norm(sheetEntry.species)] ? norm(sheetEntry.species) : base(sheetEntry.species);
  if (!MC.mons[key]) return null;
  const m = M.buildMon(key);
  if (!m) return null;
  if (sheetEntry.item) m.item = norm(sheetEntry.item);
  if (sheetEntry.ability) m.ability = norm(sheetEntry.ability);
  if (sheetEntry.moves && sheetEntry.moves.length) m.moves = sheetEntry.moves.map(norm).filter(id => MC.moves[id]);
  return m;
}
/* Best mean damage as a FRACTION of the defender's max HP.
 *
 * dmgRange(att, def, mv, field, spread) takes a MOVE OBJECT, not an id -- it gates on hasPower(mv)
 * and reads mv.t/mv.bp, so an id string silently returns {min:0,max:0} and every question built on it
 * reads "nothing damages anything". That is exactly what the first run of this file reported: n=0 on
 * both damage questions, which is why a zero denominator is printed as an em dash and not as 50%.
 *
 * field is a NEUTRAL sky, not null: dmgRange dereferences field.weather unguarded, so null throws.
 * Stated rather than hidden -- these numbers are the no-weather case, which means rain/sun damage
 * boosts and the weather Speed abilities are absent from them. */
const FIELD = { weather: '', terrain: '' };
const bestDmgFrac = (att, def) => {
  if (!att || !def || !def.st || !def.st.hp) return 0;
  let best = 0;
  for (const id of (att.moves || [])) {
    const mv = MC.moves[id];
    if (!mv || !mv.bp) continue;
    let r = null;
    try { r = M.dmgRange(att, def, mv, FIELD, false); } catch (e) { continue; }
    if (!r || typeof r.min !== 'number' || typeof r.max !== 'number') continue;
    const mean = ((r.min + r.max) / 2) / def.st.hp;
    if (mean > best) best = mean;
  }
  return best;
};
const speOf = m => (m && m.st && m.st.sp) || 0;

/* ---- walk the logs ---------------------------------------------------------------------------- */
const tally = {
  games: 0, replacements: 0, twoWay: 0, unusable: 0,
  survivesPicked: 0, survivesTotal: 0,
  fasterPicked: 0, fasterTotal: 0,
  koFastPicked: 0, koFastTotal: 0,
  bulkierPicked: 0,
  magAgrees: 0, magTotal: 0,
};
/* The shipped vector, and the dex featuresFor needs. Absent weights are not fatal: every other
 * question in this file still answers, and the MAG line reports as unavailable rather than as 50%. */
let W = null;
try { W = require(path.join(ROOT, 'engine', 'magnemite.js')).loadWeights().weights; }
catch (e) { process.stderr.write(`  (no usable weights, skipping the MAG-agreement line: ${String(e.message).split('\n')[0]})\n`); }
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const RAW = ['games.bo3.raw-logs.jsonl', 'games.ladder.raw-logs.jsonl'];

async function scan(file) {
  const p = path.join(ROOT, 'data', file);
  if (!fs.existsSync(p)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(p), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch (e) { continue; }
    const g = byId.get(String(o.id));
    if (!g) continue;                       // not in the clean set
    const sheets = {};
    for (const side of ['p1', 'p2']) for (const s of (g.sheets[side] || [])) {
      if (s && s.species) sheets[side + '|' + base(s.species)] = s;
    }
    const lines = String(o.log || '').split('\n');

    /* Who is out, who is dead, and who this side ever brought. */
    const active = { p1: {}, p2: {} };
    const dead = { p1: new Set(), p2: new Set() };
    const brought = { p1: new Set(), p2: new Set() };
    for (const x of lines) {
      const m = /^\|switch\|(p[12])([ab]): ([^|]+)\|/.exec(x);
      if (m) brought[m[1]].add(base(norm(m[3])));
    }
    /* All four identifiable, or the alternatives cannot be known. See the bias note in the header. */
    if (brought.p1.size !== 4 || brought.p2.size !== 4) { tally.unusable++; continue; }
    tally.games++;

    const pendingFaint = {};
    for (const x of lines) {
      let m = /^\|faint\|(p[12])([ab]): ([^|]+)/.exec(x);
      if (m) {
        const sp = base(norm(m[3]));
        dead[m[1]].add(sp);
        pendingFaint[m[1] + m[2]] = true;
        if (active[m[1]][m[2]] === sp) active[m[1]][m[2]] = null;
        continue;
      }
      m = /^\|switch\|(p[12])([ab]): ([^|]+)\|/.exec(x);
      if (!m) continue;
      const side = m[1], slot = m[2], chosen = base(norm(m[3]));
      const forced = !!pendingFaint[side + slot];
      if (!forced) { active[side][slot] = chosen; continue; }
      pendingFaint[side + slot] = false;
      tally.replacements++;

      /* The alternatives: brought, not dead, not currently out. */
      const partner = active[side][slot === 'a' ? 'b' : 'a'];
      const opts = [...brought[side]].filter(sp => !dead[side].has(sp) && sp !== partner);
      active[side][slot] = chosen;
      if (opts.length !== 2) continue;              // no decision, or unreadable
      if (!opts.includes(chosen)) continue;
      tally.twoWay++;

      /* The foes actually across from them right now. */
      const foeSide = side === 'p1' ? 'p2' : 'p1';
      const foes = ['a', 'b'].map(L => active[foeSide][L])
        .filter(sp => sp && !dead[foeSide].has(sp))
        .map(sp => buildFromSheet(sheets[foeSide + '|' + sp]))
        .filter(Boolean);
      if (!foes.length) continue;

      const cand = opts.map(sp => ({ sp, mon: buildFromSheet(sheets[side + '|' + sp]) }));
      if (cand.some(c => !c.mon)) continue;

      /* The three questions, per candidate, against every foe on the field. */
      for (const c of cand) {
        c.worstIn = Math.max(...foes.map(f => bestDmgFrac(f, c.mon)));
        c.survives = c.worstIn < 1;
        c.faster = foes.every(f => speOf(c.mon) > speOf(f));
        c.koFast = foes.some(f => speOf(c.mon) > speOf(f) && bestDmgFrac(c.mon, f) >= 1);
        c.bulk = (c.mon.st.hp || 0) * ((c.mon.st.df || 0) + (c.mon.st.sd || 0));
      }
      const [a, b] = cand;
      const pick = cand.find(c => c.sp === chosen);
      /* Only count a question when the two candidates DISAGREE on it -- when both survive, "did they
       * pick the survivor" has no content and averaging it in would drag every rate toward 50%. */
      if (a.survives !== b.survives) { tally.survivesTotal++; if (pick.survives) tally.survivesPicked++; }
      if (a.faster !== b.faster) { tally.fasterTotal++; if (pick.faster) tally.fasterPicked++; }
      if (a.koFast !== b.koFast) { tally.koFastTotal++; if (pick.koFast) tally.koFastPicked++; }
      if (a.bulk !== b.bulk && pick.bulk === Math.max(a.bulk, b.bulk)) tally.bulkierPicked++;

      /* ---- AND THE ONE THAT ACTUALLY MATTERS: does MAG's OWN scorer agree with the human? ------
       * Everything above asks whether a single hand-named property explains the pick. This asks the
       * shipped weight vector the same question the bot asks at the table, through the same
       * featuresFor path _scoreForcedPick uses, with forced:true so the entry hit is absent.
       *
       * A Board is built rather than replayed: p2's actives, my party, and the sheets. That is the
       * same construction tests/test-switch-features.js validates, so it is not a second replay of
       * the corpus -- there is no turn ordering here to get wrong, only a position. */
      if (W) {
        const bd = new B.Board();
        bd.turn = 3;
        const fAct = {};
        ['a', 'b'].forEach((L, i) => {
          const sp = active[foeSide][L];
          if (sp && !dead[foeSide].has(sp)) {
            const sh = sheets[foeSide + '|' + sp] || {};
            fAct[L] = { species: sp, hp: 1, boosts: {}, status: '', fainted: false,
              nature: sh.nature || '', item: norm(sh.item || ''), ability: norm(sh.ability || '') };
          }
        });
        bd.sides[foeSide].active = fAct;
        bd.sides[side].active = {};
        bd.party[side] = opts.slice();
        for (const sp of opts) {
          const sh = sheets[side + '|' + sp];
          if (sh) bd.setSheet(side, sp, { nature: sh.nature || '', item: sh.item || '', ability: sh.ability || '', moves: sh.moves || [] });
        }
        let bestSp = null, bestScore = -Infinity, scoredBoth = 0;
        for (const sp of opts) {
          const x = B.featuresFor({ raw: null, move: null, targetMon: null, switchTo: sp, forced: true },
            null, bd, side, dex, B.PRIOR_FLOOR);
          if (!x) continue;
          let s = 0; for (let k = 0; k < W.length; k++) s += W[k] * x[k];
          scoredBoth++;
          if (s > bestScore) { bestScore = s; bestSp = sp; }
        }
        if (scoredBoth === 2 && bestSp) {
          tally.magTotal++;
          if (bestSp === chosen) tally.magAgrees++;
        }
      }
    }
  }
}

const pct = (k, n) => (n ? (100 * k / n).toFixed(1) + '%' : '—');
/* Wilson, so a small denominator reads as small rather than as a confident number. */
function wilson(k, n) {
  if (!n) return '';
  const p = k / n, z = 1.96, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return `[${(100 * (c - h)).toFixed(1)}, ${(100 * (c + h)).toFixed(1)}]`;
}

(async () => {
  for (const f of RAW) { process.stderr.write(`scanning ${f}...\n`); await scan(f); }
  console.log('\nWHAT DECIDES A HUMAN\'S POST-KO REPLACEMENT\n');
  console.log(`  clean games with all four brought identifiable   ${tally.games.toLocaleString()}`);
  console.log(`  games dropped (bring not fully revealed)         ${tally.unusable.toLocaleString()}`);
  console.log(`  forced replacements seen                         ${tally.replacements.toLocaleString()}`);
  console.log(`  of those, a REAL two-way choice                  ${tally.twoWay.toLocaleString()}` +
    (tally.games ? `   (${(tally.twoWay / tally.games).toFixed(2)} per game)` : ''));
  console.log('\n  Counted only where the two candidates DISAGREE on the question. 50% = no signal.\n');
  console.log(`  picked the one that SURVIVES the hardest hit   ${pct(tally.survivesPicked, tally.survivesTotal)}  ${wilson(tally.survivesPicked, tally.survivesTotal)}   n=${tally.survivesTotal}`);
  console.log(`  picked the FASTER one                          ${pct(tally.fasterPicked, tally.fasterTotal)}  ${wilson(tally.fasterPicked, tally.fasterTotal)}   n=${tally.fasterTotal}`);
  console.log(`  picked the one with a FAST KO                  ${pct(tally.koFastPicked, tally.koFastTotal)}  ${wilson(tally.koFastPicked, tally.koFastTotal)}   n=${tally.koFastTotal}`);
  console.log(`  picked the BULKIER one                         ${pct(tally.bulkierPicked, tally.twoWay)}  ${wilson(tally.bulkierPicked, tally.twoWay)}   n=${tally.twoWay}`);
  console.log('\n  AND THE ONE THAT MATTERS — MAG\'s own shipped scorer, same featuresFor path it uses at\n' +
    '  the table, forced:true so no entry hit. 50% here means the lever is a coin flip in a coat.\n');
  console.log(`  MAG's argmax agreed with the human              ${pct(tally.magAgrees, tally.magTotal)}  ${wilson(tally.magAgrees, tally.magTotal)}   n=${tally.magTotal}`);
  console.log('\n  An interval containing 50 means humans are NOT using that property to choose, and a\n' +
    '  weight MAG carries for it is not learnable from this corpus however confident it looks.');
})();
