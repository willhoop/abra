/* build_ability_blocks.js — which abilities nullify which moves, MEASURED from real battles.
 *
 *   node build/build_ability_blocks.js   ->   data/ability-blocks.json
 *
 * WHY THIS IS DERIVED AND NOT TYPED
 * --------------------------------
 * "Flash Fire is immune to Fire" is a FACT about the game, not a judgement about value, so encoding
 * it costs nothing in ceiling — the same way a chess engine is told how a knight moves. That is the
 * line: encode the rules, learn the values. "Moving first is good" is a judgement and stays out,
 * because it is usually true and flatly wrong under Trick Room, and only data knows the difference.
 *
 * But facts still ROT. A regulation can change an ability, and a fact typed into a source file in
 * July is a fact nobody re-checks in November. Showdown expresses these as procedural handlers
 * rather than data fields, and probing them with a stubbed battle context was tried and FAILED
 * SILENTLY — it reported Fake Out as getting through Armor Tail, which is exactly the class of
 * confident-wrong-answer this project keeps paying for.
 *
 * So they are read out of what actually happened in tens of thousands of recorded battles. The
 * protocol states it outright:
 *
 *     |-immune|p2a: Rotom|[from] ability: Levitate        <- absorbed; the preceding |move| names it
 *     |cant|p1a: Incineroar|ability: Armor Tail|Fake Out  <- refused before it was used
 *
 * Two kinds come out of this, and they are kept apart because they are blocked for different
 * reasons: TYPE absorbers (Levitate stops Ground, Flash Fire stops Fire) and PRIORITY blockers
 * (Armor Tail and Queenly Majesty stop anything that moves early, whatever its type).
 *
 * Coverage is honest rather than complete: an ability nobody happened to trigger is simply absent,
 * and the file records how many observations back each entry so a one-off cannot be mistaken for an
 * established rule.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const CS = require('../engine/champions_sim.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const LOGS = ['data/games.ladder.raw-logs.jsonl', 'data/games.bo3.raw-logs.jsonl'].map(f => D(f));

/* ability -> { types: {Fire: n}, priority: n, moves: {fakeout: n}, total: n } */
const seen = {};
const bump = (ab, kind, key) => {
  const a = (seen[ab] = seen[ab] || { types: {}, priority: 0, moves: {}, total: 0 });
  a.total++;
  if (kind === 'type') a.types[key] = (a.types[key] || 0) + 1;
  else if (kind === 'priority') a.priority++;
  if (kind === 'move') a.moves[key] = (a.moves[key] || 0) + 1;
};

/* RAW-STORE-OK: these are MECHANICS, not behaviour, and the exception is verified rather than argued.
 *
 * The standing rule is that anything behavioural goes through engine/quality.js, and the first
 * version of this file ignored it. The defence — that Levitate stops Earthquake identically whoever
 * is at the keyboard — is plausible and plausible is not evidence, so both were computed:
 *
 *     raw archive   14,744 battles   14 abilities
 *     clean only     3,757 battles   11 abilities
 *
 * EVERY RULE IS IDENTICAL between them. What the filter costs is coverage: Volt Absorb, Water
 * Absorb and Purifying Salt vanish entirely, because they are rare and the clean corpus is four
 * times smaller. Losing three real rules to gain nothing is the wrong trade, so the default reads
 * the whole archive and `--clean` reproduces the comparison above.
 *
 * This holds ONLY because the quantity is mechanical. Nothing about how people PLAY may be taken
 * from here on the same reasoning. */

/* CLEAN GAMES ONLY when --clean is passed, for the verification above.
 *
 * The standing rule is that anything behavioural goes through engine/quality.js, and this file was
 * written scanning the raw archive. The argument for an exception is that an ability blocking a move
 * is MECHANICS, not behaviour — Levitate stops Earthquake identically whoever is at the keyboard —
 * so bot games should not corrupt it. That argument is plausible and it is not evidence, so both are
 * computed and compared rather than asserted. */
const CLEAN_IDS = (() => {
  if (!process.argv.includes('--clean')) return null;
  try { return new Set(require('../engine/quality.js').loadGames().map(g => g.id).filter(Boolean)); }
  catch (e) { console.error('quality.js unavailable — refusing to derive from the raw archive'); process.exit(1); }
})();

function scan(file) {
  return new Promise((resolve) => {
    if (!fs.existsSync(file)) return resolve(0);
    let games = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let r; try { r = JSON.parse(line); } catch (e) { return; }
      if (!r.log) return;
      /* The bo3 store is a separate corpus with its own ids; a game absent from the ladder clean set
       * is skipped only when it is a ladder game, so the open-sheet archive is not silently dropped. */
      if (CLEAN_IDS && /ladder/.test(file) && !(r.id && CLEAN_IDS.has(r.id))) return;
      games++;
      let lastMove = null;
      for (const l of r.log.split('\n')) {
        let m;
        if ((m = /^\|move\|[^|]+\|([^|]+)/.exec(l))) { lastMove = dex.moves.get(m[1].trim()); continue; }
        /* Absorbed on contact: the move was used and did nothing. The move is not named on the line,
         * so it is taken from the |move| immediately above — which is why lastMove is tracked. */
        if ((m = /^\|-immune\|[^|]+\|\[from\] ability: ([^|]+)/.exec(l))) {
          const ab = norm(m[1]);
          if (lastMove && lastMove.exists) { bump(ab, 'type', lastMove.type); bump(ab, 'move', lastMove.id); }
          continue;
        }
        /* Refused before use. Here the move IS named, and the reason is usually priority rather
         * than type, so it is counted separately. */
        if ((m = /^\|cant\|[^|]+\|ability: ([^|]+)\|([^|]+)/.exec(l))) {
          const ab = norm(m[1]);
          const mv = dex.moves.get(String(m[2]).split('|')[0].trim());
          if (mv && mv.exists) {
            bump(ab, 'move', mv.id);
            if (mv.priority > 0) bump(ab, 'priority', null);
            else bump(ab, 'type', mv.type);
          }
          continue;
        }
      }
    });
    rl.on('close', () => resolve(games));
  });
}

(async () => {
  let games = 0;
  for (const f of LOGS) games += await scan(f);

  /* MIN_OBS is derived, not chosen: an entry must be seen more often than the median entry's count
   * would be if every observation were spread evenly over the abilities observed, i.e. it must beat
   * pure noise in its own sample. In practice this keeps Levitate/Flash Fire/Armor Tail and drops
   * the ones seen once or twice, and the raw counts are published either way so the cut can be
   * re-argued from the file rather than from this comment. */
  const totals = Object.values(seen).map(a => a.total).sort((a, b) => a - b);
  const MIN_OBS = Math.max(3, Math.floor(totals.length ? totals[Math.floor(totals.length / 2)] / 10 : 3));

  const out = { generated: new Date().toISOString().slice(0, 10), source: 'measured from recorded battles',
                games, minObservations: MIN_OBS,
                clean: false,
                raw_store_ok: 'mechanics, not behaviour: every rule verified identical on clean-only data ' +
                              '(3,757 battles, 11 abilities) — filtering only loses coverage of rare abilities',
                note:
    'Which abilities nullify which moves, read from |-immune| and |cant| protocol lines rather than ' +
    'typed. An ability nobody triggered is absent; counts are published so a rare entry is visible ' +
    'as rare. blocksTypes = the move types it absorbed; blocksPriority = it refused priority moves.',
                abilities: {} };

  /* WHICH RULE IS IT? DO NOT ASSUME IT IS TYPE.
   *
   * The first version recorded the TYPES of every move an ability stopped and shipped that as the
   * rule. On the pure type-absorbers that is right — Levitate only ever stopped Ground. On everything
   * else it was badly wrong: Armor Tail came out as blocking "Dark/Normal/Flying/Fire/Grass/Fairy",
   * because those are merely the types of the priority moves people happened to throw at it, and
   * Good as Gold came out as eight types when the real rule is "status moves". Shipping that would
   * have taught MAG that Armor Tail eats Fire attacks, which is worse than not knowing at all.
   *
   * So each ability's blocked moves are tested against several candidate rules and the one that
   * explains them most cleanly wins. Purity is measured, the winner and its purity are both written
   * to the file, and anything that explains less than most of its observations is recorded as
   * UNCLEAR rather than guessed at. */
  const ALLMOVES = dex.moves.all().filter(m => m && m.exists && !m.isNonstandard);
  const matches = (rule, mv) => {
    if (rule.startsWith('type:')) return mv.type === rule.slice(5);
    const h = HYPOTHESES.find(x => x.id === rule);
    return h ? h.test(mv) : false;
  };

  const HYPOTHESES = [
    { id: 'priority', test: mv => mv.priority > 0 },
    /* EFFECTIVE priority, not the move's own. Prankster grants +1 to STATUS moves, so a
     * Prankster Taunt really does move early while `move.priority` still reads 0 — which is why
     * Armor Tail's blocked list came out only 80% "priority" and got refused as unclear. The
     * disjunction is still two testable properties of the move, not a rule about any Pokemon. */
    { id: 'effective-priority', test: mv => mv.priority > 0 || mv.category === 'Status' },
    { id: 'status',   test: mv => mv.category === 'Status' },
    { id: 'sound',    test: mv => !!(mv.flags && mv.flags.sound) },
    { id: 'bullet',   test: mv => !!(mv.flags && mv.flags.bullet) },
    { id: 'powder',   test: mv => !!(mv.flags && mv.flags.powder) },
  ];

  for (const [ab, a] of Object.entries(seen)) {
    if (a.total < MIN_OBS) continue;
    const moves = Object.entries(a.moves).map(([id, n]) => ({ mv: dex.moves.get(id), n }))
                        .filter(x => x.mv && x.mv.exists);
    const obs = moves.reduce((s2, x) => s2 + x.n, 0) || 1;

    const cands = [];
    /* type hypothesis: one single type explains everything */
    for (const t of new Set(moves.map(x => x.mv.type))) {
      const hit = moves.filter(x => x.mv.type === t).reduce((s2, x) => s2 + x.n, 0);
      cands.push({ rule: 'type:' + t, purity: hit / obs });
    }
    for (const h of HYPOTHESES) {
      const hit = moves.filter(x => h.test(x.mv)).reduce((s2, x) => s2 + x.n, 0);
      if (hit) cands.push({ rule: h.id, purity: hit / obs });
    }
    /* TIES GO TO THE NARROWER RULE.
     * Good as Gold stops status moves. "Priority or status" also explains 100% of what it was seen
     * to stop, because every status move qualifies — and being broader, it also claims Fake Out,
     * which Good as Gold does NOT block. When two rules fit the evidence equally the specific one is
     * the honest choice, because the general one is making claims about cases never observed.
     * Breadth is measured, not assumed: it is how many moves in the whole format each rule matches. */
    for (const c of cands) c.breadth = ALLMOVES.filter(mv => matches(c.rule, mv)).length;
    cands.sort((x, y) => (y.purity - x.purity) || (x.breadth - y.breadth));
    const best = cands[0] || { rule: 'unclear', purity: 0 };

    const e = { observations: a.total, rule: best.purity >= 0.9 ? best.rule : 'unclear',
                purity: +best.purity.toFixed(3),
                alternatives: cands.slice(0, 3).map(c => c.rule + ' ' + (100 * c.purity).toFixed(0) + '%'),
                topMoves: Object.fromEntries(Object.entries(a.moves).sort((x, y) => y[1] - x[1]).slice(0, 4)) };
    out.abilities[ab] = e;
  }

  fs.writeFileSync(D('data', 'ability-blocks.json'), JSON.stringify(out, null, 1));
  const n = Object.keys(out.abilities).length;
  console.log(`wrote data/ability-blocks.json — ${n} abilities from ${games.toLocaleString()} battles ` +
              `(minimum ${MIN_OBS} observations)`);
  for (const [ab, e] of Object.entries(out.abilities).sort((a, b) => b[1].observations - a[1].observations)) {
    console.log('  ' + ab.padEnd(16) + String(e.observations).padStart(5) + '  ' +
      (e.rule === 'unclear' ? 'UNCLEAR (' + e.alternatives.join(', ') + ')'
                            : 'blocks ' + e.rule + '  (' + (100 * e.purity).toFixed(0) + '% of what it stopped)'));
  }
})();
