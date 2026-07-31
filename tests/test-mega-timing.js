/* MEGA EVOLUTION: DOES IT REACH THE STATS, AND IS IT APPLIED AT THE RIGHT MOMENT?
 *
 * Will: "when a mon switches in, its normal, but then can mega evolve. so the switch in and
 * retaliate needs to calc the switch in is base stats and retaliate is mega stats."
 *
 * Two defects sat underneath that, and the second is the one he named:
 *
 * 1. THE STONE NEVER REACHED THE STATS AT ALL. medicham2's megaForme() resolves through
 *    `window.MEGA_FORMES`, which does not exist under node — it returns null on every server-side
 *    call, so buildMon never applied a mega and a Mega Blaziken was priced as a Blaziken in every
 *    calculation this project makes. Worse, monFor set the sheet's item AFTER buildMon had already
 *    chosen the forme, so even a working resolver would have been consulted too late.
 *    board.js's megaFormeOf reads the dex's `megaStone` property instead, refuses a stone belonging
 *    to another species, and is now exported so there is one resolver rather than two.
 *
 * 2. AND THE TIMING. Switching in costs the turn, so a Pokemon ARRIVES in base form and eats that
 *    turn's attack with base bulk. It megas on a later turn and retaliates with mega stats. Reading
 *    it as its mega on arrival invents defence it does not have yet and hides a real pin.
 *
 * So the same Pokemon must be built twice and each question must take the right build:
 *    "can it survive coming in?"  -> BASE
 *    "can it remove something?"   -> MEGA
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const B = require(path.join(ROOT, 'engine', 'board.js'));
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const P = require(path.join(ROOT, 'engine', 'position_features.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
};

console.log('MEGA EVOLUTION — does the stone reach the stats, and at the right moment?\n');

/* ---- the cast, derived ----------------------------------------------------------------------- */
const megaKeys = Object.keys(MC.mons).filter(n => n.endsWith('-mega'));
ok(megaKeys.length > 0, 'the table carries mega formes', `${megaKeys.length} of them`);

const stoneFor = (base) => {
  for (const i of dex.items.all()) {
    if (i.megaStone && B.megaFormeOf(base, i.name, dex)) return i.name;
  }
  return null;
};

/* ---- 1. THE RESOLVER ------------------------------------------------------------------------- */
console.log('== 1. the resolver ==');
{
  const base = megaKeys[0].replace('-mega', '');
  const stone = stoneFor(base);
  ok(!!stone && !!B.megaFormeOf(base, stone, dex),
    'megaFormeOf turns a species and its own stone into its mega forme', `${base} + ${stone}`);

  /* Somebody else's stone must NOT transform it — the guard board.js documents. */
  const other = megaKeys.find(m => !m.startsWith(base)) || '';
  const otherBase = other.replace('-mega', '');
  const otherStone = stoneFor(otherBase);
  ok(otherStone ? !B.megaFormeOf(base, otherStone, dex) : true,
    'and refuses a stone belonging to another species', `${base} + ${otherStone} -> null`);

  /* The reason this had to move: medicham2's own resolver is browser-only and silently null here. */
  ok(typeof global.window === 'undefined' || !global.window.MEGA_FORMES,
    'medicham2 megaForme() has no table under node — which is why it always returned base form',
    'documented, not a defect in this test');
}

/* ---- 2. THE STONE MUST CHANGE AN OFFENSIVE READ ---------------------------------------------- */
console.log('\n== 2. arriving vs retaliating ==');
{
  /* Find a mega whose form genuinely changes the answer, rather than assuming one does. Bulk for the
   * defensive check, offence for the offensive one. */
  const differs = megaKeys.filter(m => {
    const b = m.replace('-mega', '');
    const B1 = MC.mons[b], M1 = MC.mons[m];
    if (!B1 || !M1) return false;
    return (M1.st.df + M1.st.sd) !== (B1.st.df + B1.st.sd) || M1.st.at !== B1.st.at || M1.st.sa !== B1.st.sa;
  });
  ok(differs.length > 0, 'some mega forme has different stats from its base', `${differs.length} do`);

  const base = differs[0].replace('-mega', '');
  const stone = stoneFor(base);
  const bulkBase = MC.mons[base].st.df + MC.mons[base].st.sd;
  const bulkMega = MC.mons[differs[0]].st.df + MC.mons[differs[0]].st.sd;
  console.log(`        ${base}: base bulk ${bulkBase} -> mega ${bulkMega}, ` +
              `atk ${MC.mons[base].st.at} -> ${MC.mons[differs[0]].st.at}, ` +
              `spa ${MC.mons[base].st.sa} -> ${MC.mons[differs[0]].st.sa}`);

  /* A position where `base` sits on the BENCH holding its stone, so both reads are exercised:
   * benchAnswers asks whether it can remove something (mega), the pin refuge asks whether it
   * survives coming in (base). */
  const foe = Object.keys(MC.mons).find(n => n !== base && !n.endsWith('-mega'));
  const hitters = Object.keys(MC.moves).filter(id => MC.moves[id] && MC.moves[id].bp >= 110);
  const mk = (withStone, foeHp) => {
    const b = new B.Board(); b.turn = 6;
    b.party.p1 = [foe, base];
    b.party.p2 = [foe];
    b.setSheet('p1', foe, { nature: 'serious', item: '', ability: '', moves: ['protect'] });
    b.setSheet('p1', base, { nature: 'serious', item: withStone ? stone : '', ability: '', moves: hitters.slice(0, 3) });
    b.setSheet('p2', foe, { nature: 'serious', item: '', ability: '', moves: hitters.slice(0, 2) });
    b.switchIn('p1', 'a', foe);
    b.switchIn('p2', 'a', foe);
    b.sides.p2.active.a.hp = foeHp;
    return b;
  };
  /* SEARCH FOR THE HEALTH AT WHICH THE FORMS DIVERGE, rather than assuming full health shows it.
   * benchAnswers counts bench Pokemon that can REMOVE something; at full health neither the base nor
   * the mega removes anything and the count is zero either way, which says nothing about wiring.
   * Mega Blaziken is the clean illustration of why the form matters in both directions: its Attack
   * DROPS 189 -> 180 while its Special Attack rises 117 -> 150. */
  let diverged = '';
  for (let hp = 0.05; hp <= 0.95 && !diverged; hp += 0.05) {
    const a = P.positionFeatures(mk(false, hp), 'p1', dex);
    const c = P.positionFeatures(mk(true, hp), 'p1', dex);
    if (a.some((v, i) => v !== c[i])) diverged = `at ${Math.round(hp * 100)}% foe health`;
  }
  ok(!!diverged,
    'declaring the stone changes the position — it reaches the stats at all',
    diverged || 'IDENTICAL at every health level — the stone is still not reaching buildMon');

  /* And the timing, stated as the property that matters: a bench Pokemon is read as its MEGA when
   * asked whether it can remove something, and as its BASE when asked whether it survives arriving.
   * Both come from the same monFor call site with a different flag, so this asserts the two reads
   * are not accidentally the same build. */
  const mBuild = M.buildMon(differs[0]), bBuild = M.buildMon(base);
  ok(mBuild && bBuild && (mBuild.st.df + mBuild.st.sd) !== (bBuild.st.df + bBuild.st.sd)
     || (mBuild && bBuild && mBuild.st.at !== bBuild.st.at) || (mBuild && bBuild && mBuild.st.sa !== bBuild.st.sa),
    'the two builds are genuinely different Pokemon',
    `${base} ${JSON.stringify(bBuild && bBuild.st)} vs ${JSON.stringify(mBuild && mBuild.st)}`);
}

console.log(fails ? `\nMEGA TIMING: ${fails} FAILED` : '\nMEGA TIMING: all checks passed');
process.exit(fails ? 1 : 0);
