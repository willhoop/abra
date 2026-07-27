/* surprise.js — where MAG's expectations disagree with what the game actually did.
 *
 *   SHOWDOWN_PATH=... node engine/surprise.js            the ranked report
 *   SHOWDOWN_PATH=... node engine/surprise.js --examples show the worst offenders by name
 *
 * WHY THIS EXISTS
 * ---------------
 * Every mechanic MAG learned this session was found the same way: a person thought of it and asked.
 * Weather Ball retyping under rain, Earthquake hitting your own partner, Armor Tail refusing only
 * priority, Blizzard never missing in snow, Solar Beam firing at once in sun, Gale Wings needing full
 * health, Prankster failing into Dark. Every one was real, and every one was found by memory.
 *
 * That does not scale and it has an obvious bias: it finds the mechanics somebody happens to recall,
 * not the ones that cost the most games. The engine already knows all of them and it is willing to
 * say so — the protocol states outright whether a move missed, was immune, failed, was blocked by an
 * ability, or had to charge. So instead of guessing what MAG does not know, this asks it what it got
 * wrong, and ranks the answers.
 *
 * WHAT IT COMPARES
 *   predicted accuracy    vs  |-miss|
 *   predicted immunity    vs  |-immune|
 *   predicted dead move   vs  |-fail|
 *   predicted ability blk vs  |-activate| ability: X
 *   predicted charge turn vs  |-prepare|
 *   predicted kill        vs  |faint|
 *
 * READING IT. A high surprise rate is not automatically a bug — a 70% move missing 30% of the time is
 * the game working. What matters is a rate FAR from what the feature claimed, and the report prints
 * the claim beside the outcome so the two can be compared rather than the outcome read alone.
 */
'use strict';
const CS = require('./champions_sim.js');
const B = require('./board.js');
const FP = require('./fit_policy.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;
const EXAMPLES = process.argv.includes('--examples');

if (!B.damageEngine()) {
  console.error('the damage engine did not load — every damage prediction would be zero. Refusing to report.');
  process.exit(1);
}

const { games } = FP.loadCorpus();

/* Each check is {what MAG predicted, what happened}. Kept as counts of four cells rather than a
 * single "wrong" tally, because a model that never predicts an event and a model that predicts it
 * constantly are wrong in opposite directions and need opposite fixes. */
const mk = () => ({ predYes_gotYes: 0, predYes_gotNo: 0, predNo_gotYes: 0, predNo_gotNo: 0, ex: [] });
const checks = {
  'move MISSED': mk(),
  'target IMMUNE': mk(),
  'move FAILED': mk(),
  'ability BLOCKED it': mk(),
  'move had to CHARGE': mk(),
  'target was KILLED': mk(),
};

function note(name, pred, got, ctx) {
  const c = checks[name];
  c[(pred ? 'predYes' : 'predNo') + '_' + (got ? 'gotYes' : 'gotNo')]++;
  if (pred !== got && c.ex.length < 4000) c.ex.push(ctx);
}

let scored = 0;
for (const g of games) {
  const bd = new B.Board();
  const sheet = {};
  for (const side of ['p1', 'p2']) {
    for (const m of (g.sheets && g.sheets[side]) || []) {
      if (m && m.species) {
        sheet[base(m.species)] = { side, moves: (m.moves || []).map(norm) };
        /* The sheet's nature reaches the board, so the damage estimate is computed against the
         * spreads consistent with it rather than all of them. Public information on this ladder. */
        bd.setSheet(side, m.species, { nature: m.nature || '', item: m.item || '' });
      }
    }
  }
  for (const side of ['p1', 'p2']) {
    const lead = (g.lead || {})[side] || [];
    if (lead[0]) bd.switchIn(side, 'a', lead[0]);
    if (lead[1]) bd.switchIn(side, 'b', lead[1]);
  }

  for (const t of g.turns || []) {
    const ev = t.ev || [];
    for (const e of ev) if (e.t === 'mega' && e.s) { const mn = bd.slot(e.s.slice(0, 2), e.s.slice(2)); if (mn) mn.species = norm(e.mon); }

    for (let k = 0; k < ev.length; k++) {
      const e = ev[k];
      if (e.t !== 'm' || !e.s || !e.mon || !e.mv) continue;
      const side = e.s.slice(0, 2), letter = e.s.slice(2);
      const user = bd.slot(side, letter);
      const sh = sheet[base(e.mon)];
      if (!user || user.fainted || !sh) continue;

      const cands = B.candidates(sh.moves, user, bd, side, dex);
      const mvId = norm((dex.moves.get(e.mv) && dex.moves.get(e.mv).id) || e.mv);
      const c = cands.find(x => norm(x.move.id) === mvId &&
        (e.tgt ? (x.targetMon && base(x.targetMon.species) === base(e.tgt)) : !x.targetMon));
      if (!c) continue;

      const x = B.featuresFor(c, user, bd, side, dex, FP.priorFor(user.species, c.move.id));
      const F = n => x[B.FEATURE_INDEX[n]];
      const ctx = { mv: c.move.name, user: user.species, tgt: e.tgt || '-', wx: bd.weather || '-' };
      scored++;

      /* A predicted probability has to become a yes/no to be compared with an event, and the cut is
       * the coin: "more likely than not". Stated rather than tuned — a threshold chosen to make the
       * numbers look better is the thing this whole file exists to avoid. */
      note('move MISSED', F('accuracy') < 0.5, !!e.miss, ctx);
      note('target IMMUNE', F('immune') >= 0.5, !!e.immune, ctx);
      note('move FAILED',
        Math.max(F('deadStatus'), F('deadSide'), F('deadField'), F('deadWeather'), F('deadStall'),
                 F('pranksterFailsDark')) >= 0.5, !!e.fail, ctx);
      note('ability BLOCKED it', F('abilityBlock') >= 0.5, !!e.blockedBy,
           { ...ctx, by: e.blockedBy || '-' });
      /* `|-prepare|` IS NOT "IT CHARGED", and this report found that out about itself on its first
       * run: Electro Shot appeared 229 times as a surprise. Showdown emits -prepare BEFORE it checks
       * the weather, so Solar Beam in sun and Electro Shot in rain announce a wind-up and then fire
       * on the same turn. The honest signal is a wind-up that produced NO damage. */
      note('move had to CHARGE', F('chargeTurn') >= 0.5, !!e.charging && !e.dmg, ctx);

      if (e.tgt) {
        let died = false;
        for (let j = k + 1; j < ev.length; j++) {
          const f = ev[j];
          if (f.t === 'f' && f.mon && base(f.mon) === base(e.tgt)) { died = true; break; }
        }
        note('target was KILLED', F('koTarget') >= 0.5, died, ctx);
      }
    }

    for (const e of ev) {
      const side = e.s ? e.s.slice(0, 2) : null, letter = e.s ? e.s.slice(2) : null;
      if (e.t === 's' && side) bd.switchIn(side, letter, e.mon);
      else if (e.t === 'm' && side) {
        const u = bd.slot(side, letter); if (u) B.noteMove(bd, side, u, dex.moves.get(e.mv), true);
        if (e.tgt && (e.tgthp != null || e.dmg)) {
          const foe = side === 'p1' ? 'p2' : 'p1';
          let done = false;
          for (const sd of [foe, side]) { for (const L of ['a', 'b']) {
            const m2 = bd.slot(sd, L);
            if (m2 && base(m2.species) === base(e.tgt) && !m2.fainted) {
              m2.hp = e.tgthp != null ? Math.max(0, e.tgthp / 100) : Math.max(0, m2.hp - e.dmg / 100);
              done = true; break;
            } } if (done) break; }
        }
      }
      else if (e.t === 'f' && side) { const u = bd.slot(side, letter); if (u) u.fainted = true; }
      else if (e.t === 'x' && side) { const u = bd.slot(side, letter); if (u) u.status = norm(e.st); }
      else if (e.t === 'hp' && side) { const u = bd.slot(side, letter); if (u && e.hp != null) u.hp = Math.max(0, e.hp / 100); }
      else if (e.t === 'b' && side) { const u = bd.slot(side, letter); if (u && e.b) u.boosts = { ...e.b }; }
      else if (e.t === 'w') bd.setWeather(e.field);
      else if (e.t === 'fs') bd.startField(e.field, 5);
    }
    bd.turn++;
  }
}

const pct = (a, b) => b ? (100 * a / b).toFixed(2) + '%' : '  n/a';
console.log(`WHAT SURPRISED MAG — ${games.length.toLocaleString()} clean games, ${scored.toLocaleString()} scored moves\n`);

const rows = Object.entries(checks).map(([name, c]) => {
  const n = c.predYes_gotYes + c.predYes_gotNo + c.predNo_gotYes + c.predNo_gotNo;
  const wrong = c.predYes_gotNo + c.predNo_gotYes;
  return { name, c, n, wrong, rate: n ? wrong / n : 0 };
}).sort((a, b) => b.wrong - a.wrong);

console.log('  what                    surprised  of        rate     MISSED IT   CRIED WOLF');
console.log('  ' + '-'.repeat(84));
for (const r of rows) {
  console.log('  ' + r.name.padEnd(24) +
    String(r.wrong).padStart(8) + '  ' + String(r.n).padStart(8) + '  ' +
    pct(r.wrong, r.n).padStart(7) + '   ' +
    String(r.c.predNo_gotYes).padStart(9) + '   ' + String(r.c.predYes_gotNo).padStart(10));
}
console.log(`
  MISSED IT  = it happened and MAG did not see it coming. A mechanic it does not know.
  CRIED WOLF = MAG expected it and it did not happen. Usually an over-confident estimate.`);

if (EXAMPLES) {
  for (const r of rows) {
    if (!r.c.ex.length) continue;
    /* Ranked by how often the same move surprises, because one move surprising 400 times is a
     * missing mechanic and 400 moves surprising once each is the game being random. */
    const byMove = {};
    for (const e of r.c.ex) { const k = e.mv + (e.by && e.by !== '-' ? ` [${e.by}]` : ''); byMove[k] = (byMove[k] || 0) + 1; }
    const top = Object.entries(byMove).sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`\n  ${r.name} — the moves that surprise most often`);
    for (const [mv, n] of top) console.log(`     ${String(n).padStart(5)}  ${mv}`);
  }
}
