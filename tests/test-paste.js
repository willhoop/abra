/* test-paste.js — the PokePaste import must agree with the engine that DEFINED the stat math.
 *
 *   node tests/test-paste.js
 *
 * medicham2's parsePaste/buildMonFromSet mirror CHOMP/engine/champ-model.js, whose statL50/hpL50
 * are the project's VALIDATED math — and whose EVs are FLAT stat points, not the mainline EV/4
 * (a from-memory implementation would have silently mis-built every imported team). This test is
 * the pin: both implementations parse Will's own myteam.txt and every computed stat must be EQUAL.
 * If CHOMP is not checked out beside ABRA the cross-check is SKIPPED LOUDLY, never silently.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); c ? pass++ : fail++; };

console.log('POKEPASTE — imported teams must be built with the validated math\n');

const paste = fs.readFileSync(path.join(ROOT, 'myteam.txt'), 'utf8');
const sets = M.parsePaste(paste);
ok(sets.length >= 4, `myteam.txt parses into ${sets.length} sets`);

const mons = sets.map(s => M.buildMonFromSet(s)).filter(Boolean);
ok(mons.length === sets.length || mons.length >= 4,
  `${mons.length}/${sets.length} sets build into battle-ready mons (misses mean a species outside the 289)`);

/* the declared pieces override the dataset's assumed build — EXCEPT the ability of a mega */
{
  const geng = mons.find(m => /gengar/.test(m.name));
  ok(!!geng, 'Gengar is in the team');
  if (geng) {
    ok(geng.item === 'gengarite', `its item is the declared Gengarite (${geng.item})`);
    ok(geng.moves.includes('shadowball') && geng.moves.includes('protect'),
      `its moves are the declared ones (${geng.moves.join(', ')})`);
    /* THIS ASSERTION WAS INVERTED ON 2026-08-04, AND IT USED TO ASSERT THE BUG.
     *
     * It read `geng.ability === 'cursedbody'` — the ability myteam.txt declares. But the paste also
     * declares a GENGARITE, and the body this builds is `gengar-mega`, whose ability is SHADOW TAG.
     * A team sheet lists the PRE-mega ability; the thing on the field does not have it. That exact
     * pair is the worked example in the header of tests/test-effective-identity.js, and it is the
     * CLAUDE.md rule "mega evolution overwrites the ability".
     *
     * board.js had already fixed its half (board.js:964, effAbility) and medicham2 had not, so the
     * two engines disagreed about a FACT — the failure mode CLAUDE.md says has cost this project the
     * most. Confirmed three ways before this line was touched: Showdown's dex gives Gengar-Mega
     * exactly one ability, Shadow Tag; board.js effAbility returns 'shadowtag' for this same sheet;
     * and buildMonFromSet now agrees.
     *
     * The DECLARED-pieces rule is untouched for everything else, and for a non-mega ability too —
     * only the branch that swapped the species to a mega row overrides the sheet. */
    ok(geng.ability === 'shadowtag',
      `its ability is the MEGA's Shadow Tag, not the sheet's pre-mega Cursed Body (${geng.ability})`);
  }
}

/* THE CONTRACT: every stat equals champ-model's own buildMon for the same paste */
{
  let CM = null;
  try { CM = require(path.join(ROOT, '..', 'CHOMP', 'engine', 'champ-model.js')); } catch (e) {}
  if (!CM || typeof CM.parsePaste !== 'function' || typeof CM.buildMon !== 'function') {
    console.log('  SKIP  CHOMP not checked out beside ABRA — the cross-engine stat contract DID NOT RUN');
  } else {
    const theirs = CM.parsePaste(paste).map(s => CM.buildMon(s));
    let compared = 0, agree = true, detail = '';
    for (const th of theirs) {
      /* ABRA resolves a stone-holder to its own -mega entry; champ-model keeps the base key.
       * Strip the suffix for matching — the megas are exactly the mons this contract must cover. */
      const strip = s => String(s).replace(/-mega(-[xy])?$/, '').replace(/-/g, '');
      const mine = mons.find(m => strip(m.name) === strip(th.key));
      if (!mine) continue;
      compared++;
      const pairs = [['hp', 'hp'], ['at', 'atk'], ['df', 'def'], ['sa', 'spa'], ['sd', 'spd'], ['sp', 'spe']];
      for (const [a, b] of pairs) {
        if (mine.st[a] !== th.st[b]) { agree = false; detail += ` ${th.key}.${b}: ${mine.st[a]} vs ${th.st[b]};`; }
      }
    }
    ok(compared >= 4, `${compared} mons compared against champ-model`);
    ok(agree, 'every stat is EQUAL to champ-model\'s validated math' + (detail ? ' —' + detail : ''));
  }
}

/* flat-EV sanity, reconstructable by hand: Incineroar 32 HP EVs = +32 flat on the L50 HP */
{
  const inc0 = M.buildMonFromSet({ species: 'Incineroar', item: null, ability: null, nature: null,
    sp: { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 }, moves: [] });
  const inc32 = M.buildMonFromSet({ species: 'Incineroar', item: null, ability: null, nature: null,
    sp: { hp: 32, at: 0, df: 0, sa: 0, sd: 0, sp: 0 }, moves: [] });
  ok(inc0 && inc32 && inc32.st.hp - inc0.st.hp === 32,
    `Champions EVs are FLAT points: 32 HP EVs = +32 HP (${inc0 && inc0.st.hp} -> ${inc32 && inc32.st.hp}), not EV/4`);
  const adam = M.buildMonFromSet({ species: 'Incineroar', item: null, ability: null, nature: 'Adamant',
    sp: { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 }, moves: [] });
  ok(adam && adam.st.at === Math.floor(inc0.st.at * 1.1) && adam.st.sa === Math.floor(inc0.st.sa * 0.9),
    `Adamant is +10% Attack / -10% SpA (${inc0 && inc0.st.at}->${adam && adam.st.at}, ${inc0 && inc0.st.sa}->${adam && adam.st.sa})`);
}

console.log('');
if (fail) { console.log(`${fail} check(s) failed — imported teams would be silently mis-built.`); process.exit(1); }
console.log(`${pass} checks passed. A pasted team is built with the engine's own validated math.`);
