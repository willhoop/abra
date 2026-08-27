/* probe_stat_pick.js — THE RANDOM STAT PICK: DO THE TWO ENGINES CHOOSE THE SAME STAT?
 *
 *   SHOWDOWN_PATH=... node tests/probe_stat_pick.js          (read the exit code UNPIPED)
 *
 * ================= THE ROW THIS EXISTS FOR ======================================================
 *
 * `data/game-differential.json`, `state.first_board_divergences`, config `omit-weather`, turn 2:
 *
 *     p2.party.scovillain.boosts.atk   medicham  2   showdown -1
 *     p2.party.scovillain.boosts.def   medicham -1   showdown  0
 *     p2.party.scovillain.boosts.spa   medicham  0   showdown  2
 *
 * One stat up two stages and another down one IN BOTH ENGINES, on different stats. The SHAPE is
 * right on both sides; the CHOICE parted.
 *
 * ================= WHAT IT IS NOT ===============================================================
 *
 * It is NOT the handler. The ability's rule is implemented line for line — accuracy and evasion
 * excluded from both draws, the +2 taken from stats below +6, the -1 from stats above -6 EXCLUDING
 * the one just raised, both lists built before either boost lands. This file's CONTROL board proves
 * the two engines agree turn after turn when nothing else has drawn.
 *
 * It is NOT "there is no shared die" either, which is the answer this family of rows has produced
 * four times and which was wrong every time. There IS a shared die and both engines read it: the
 * `middle` arm addresses every draw `seed|turn|category|move|target|nth`, and on the CONTROL board
 * below the two sides' residual addresses match 6 of 6.
 *
 * ================= WHAT IT IS ===================================================================
 *
 * `nth` IS A FIELD OF THE ADDRESS AND THEREFORE AN INPUT TO THE HASH. A residual draw has no move
 * and no target in scope on either side, so EVERY non-action draw of a turn lands in ONE bucket —
 * `<seed>|<turn>|any|-|-|<nth>` — separated only by the repeat index. That bucket is a per-turn
 * SEQUENCE wearing an address, which is the exact object the event-addressed design replaced the
 * sequence design to get rid of, and `game_differential.js`'s ROADMAP #220 note says so in as many
 * words about a narrower case.
 *
 * So ANY draw either engine takes and the other does not, anywhere earlier in the same turn,
 * re-indexes the residual's draws and re-rolls the stat pick. This file stages exactly that: a
 * CONTROL board where the two sides' draw counts match, and a CONTAMINATED board where they do not.
 *
 * ================= THE FIXTURE MUST NOT BE FORCED ===============================================
 *
 * A stat already at +6 cannot be raised and one at -6 cannot be dropped, so a board whose eligible
 * list holds one entry proves nothing whichever way it comes out. The eligible count is DERIVED per
 * residual from the boosts standing at that instant — reconstructed by replaying the protocol's own
 * boost lines — and printed. A cell where either draw had fewer than two candidates is REFUSED.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const NL = String.fromCharCode(10);
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat('gen9championsvgc2026regmb');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPECIES = DEX.species.all().filter(legal).sort((a, b) => a.name.localeCompare(b.name));
const MOVES = DEX.moves.all().filter(legal).sort((a, b) => a.name.localeCompare(b.name));

/* ---- THE ABILITY, DERIVED: the one whose residual handler samples a stat ---------------------- */
const CANDS = DEX.abilities.all().filter(legal)
  .filter(a => /this\.sample\(/.test(String(a.onResidual || '')) && /boosts/.test(String(a.onResidual || '')));
if (CANDS.length !== 1) {
  console.log('NOT-STAGED — derived ' + CANDS.length + ' random-stat residual abilities: '
    + CANDS.map(a => a.name).join(', ') + '. This file addresses exactly one.');
  process.exit(1);
}
const AB = CANDS[0];
const SRC = String(AB.onResidual);
const DRAWS = (SRC.match(/this\.sample\(/g) || []).length;
/* the stat keys the handler walks, and the two it skips — read off the handler, never typed */
const SKIP = [...new Set((SRC.match(/["'](accuracy|evasion)["']/g) || []).map(s => s.replace(/["']/g, '')))];
const STATS = Object.keys({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 })
  .filter(k => !SKIP.includes(k));
const UP = Number((SRC.match(/=\s*(\d+);/) || [])[1] || 2);

const CARRIERS = SPECIES.filter(s => !/-Mega/.test(s.name)
  && Object.values(s.abilities || {}).some(a => norm(a) === norm(AB.name)));
if (!CARRIERS.length) { console.log('NOT-STAGED — no legal carrier for ' + AB.name + '.'); process.exit(1); }

console.log('DERIVED FROM THE FORMAT (nothing below is typed):');
console.log('  ability            ' + AB.name + '   onResidualOrder=' + AB.onResidualOrder
  + ' subOrder=' + AB.onResidualSubOrder + '   this.sample() calls: ' + DRAWS);
console.log('  the handler skips  ' + (SKIP.join(', ') || '(nothing)')
  + '   so the draw pool is  ' + STATS.join(', '));
console.log('  legal carriers     ' + CARRIERS.map(c => c.name).join(', '));
console.log('  the second draw excludes the first: '
  + (/statMinus\s*!==\s*randomStat/.test(SRC) ? 'YES (read off the handler)' : 'NO'));

const G = require(D('engine', 'game_differential.js'));
const ARM = G.ARM_BY_ID.get('middle');
const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });
function padTeam(actives) {
  const used = new Set(actives.map(m => norm(m.species)));
  const out = actives.slice();
  for (const s of SPECIES) {
    if (out.length >= 4) break;
    if (/-Mega/.test(s.name) || used.has(norm(s.name))) continue;
    used.add(norm(s.name)); out.push(mon(s.name, '', ['Protect']));
  }
  return out;
}
const buildSide = actives => G.buildPair(padTeam(actives));

/* ---- THE TWO CLICKS, DERIVED BY TARGET CLASS --------------------------------------------------
 * A single-target move needs no random target. A SPREAD move is used with no chosen target, so the
 * authority resolves one with `Battle#getRandomTarget` -> `Side#randomFoe` -> `this.sample(actives)`
 * and DRAWS, up to three times per click (queue resolution, the speed sort, and `runMove`). Which
 * move goes in which arm is read off `move.target`, never named. */
const SINGLE = MOVES.find(m => m.target === 'self' && m.category === 'Status' && !m.isZ && !m.isMax
  && !m.boosts && !(m.self && m.self.boosts));
const SPREAD = MOVES.find(m => m.target === 'allAdjacentFoes' && !m.isZ && !m.isMax);
if (!SINGLE || !SPREAD) { console.log('NOT-STAGED — no self-target / spread pair in the format.'); process.exit(1); }
console.log('  control click      ' + SINGLE.name + '   [target ' + SINGLE.target
  + ' — `getRandomTarget` returns the user for this class and takes NO draw]');
console.log('  contaminating click ' + SPREAD.name + '  [target ' + SPREAD.target
  + ' — used with no chosen target, so the authority samples one]');

/* ---- READING THE PICKS. The two engines SPELL the same event differently and that is declared:
 * the authority announces `|-ability|<who>|<Ability>|boost` and then emits bare `|-boost|`/
 * `|-unboost|` lines; this engine attributes each line with `[from] ability: <id>`. Both are folded
 * to (direction, stat, stages), which is the state change and the only thing compared. ----------- */
function picksFrom(lines, attributed) {
  const out = []; let armed = 0;
  for (const raw of lines) {
    const l = Array.isArray(raw) ? '|' + raw.join('|') : String(raw);
    const p = l.split('|');
    /* THE ANNOUNCE ARMS EXACTLY `DRAWS` LINES AND NO MORE. Without the counter a boost this ability
     * did not cause — the control click's own stat move — is swallowed into the pick and the
     * comparison silently stops being about this ability. That happened first. */
    if (!attributed && p[1] === '-ability' && norm(p[3]) === norm(AB.name)) { armed = DRAWS; continue; }
    if (p[1] !== '-boost' && p[1] !== '-unboost') continue;
    if (attributed) { if (!new RegExp('ability:\\s*' + norm(AB.name), 'i').test(l.replace(/\s/g, ''))) continue; }
    else { if (!armed) continue; armed--; }
    out.push({ dir: p[1] === '-boost' ? 1 : -1, who: p[2], stat: p[3], n: Number(p[4]) });
  }
  return out;
}
const fold = ps => ps.map(p => (p.dir > 0 ? '+' : '-') + p.stat + p.n).join(' ');

/* ---- THE ELIGIBLE COUNT, REBUILT FROM THE BOOSTS STANDING AT EACH RESIDUAL --------------------
 * Replays the stream's own boost lines in order and, at each pair of picks belonging to this
 * ability, reports how many stats were legally choosable. A pair with fewer than two on either draw
 * is a FORCED cell and this file refuses to grade it. */
function eligibility(lines) {
  const boosts = new Map(); const out = [];
  const get = w => { if (!boosts.has(w)) boosts.set(w, Object.fromEntries(STATS.map(s => [s, 0]))); return boosts.get(w); };
  let pend = null, armed = 0;
  for (const raw of lines) {
    const l = Array.isArray(raw) ? '|' + raw.join('|') : String(raw);
    const p = l.split('|');
    if (p[1] === '-ability' && norm(p[3]) === norm(AB.name)) { armed = DRAWS; continue; }
    if (p[1] !== '-boost' && p[1] !== '-unboost') continue;
    const mine = armed > 0 || new RegExp('ability:\\s*' + norm(AB.name), 'i').test(l.replace(/\s/g, ''));
    const b = get(p[2]), st = p[3], n = Number(p[4]);
    if (mine && !pend) {
      pend = { who: p[2], up: st, upEligible: STATS.filter(s => b[s] < 6).length };
    } else if (mine && pend) {
      pend.down = st;
      pend.downEligible = STATS.filter(s => b[s] > -6 && s !== pend.up).length;
      out.push(pend); pend = null; armed = 0;
    }
    b[st] = Math.max(-6, Math.min(6, b[st] + (p[1] === '-boost' ? n : -n)));
  }
  return out;
}

const anyResid = list => list.filter(a => { const p = String(a).split('|'); return p[2] === 'any' && p[3] === '-' && p[4] === '-'; });

function play(carrier, click, label) {
  const ally = SPECIES.find(s => !/-Mega/.test(s.name) && norm(s.name) !== norm(carrier.name));
  const pb = buildSide([mon(carrier.name, AB.name, ['Protect', SINGLE.name]),
                        mon(ally.name, '', ['Protect', SINGLE.name])]);
  const foes = SPECIES.filter(s => !/-Mega/.test(s.name) && norm(s.name) !== norm(carrier.name)
                                   && norm(s.name) !== norm(ally.name)).slice(0, 2);
  const pa = buildSide(foes.map(s => mon(s.name, '', ['Protect', click.name, SINGLE.name])));
  if (!pa || !pb) return { unbuildable: true };
  const step = { p1: [{ m: click.id }, { m: click.id }], p2: [{ m: SINGLE.id }, { m: SINGLE.id }] };
  G.midResetAddresses();
  let r;
  try { r = G.playGame(pa, pb, 'directed', 'probe_stat_pick/' + label, { script: [step, step, step], arm: ARM }); }
  catch (e) { return { threw: String((e && e.message) || e).split(NL)[0] }; }
  if (r.err) return { notPlayed: r.err };
  const sdLines = G.sdStream(G.lastSdLog());
  const A = G.midAddresses();
  return { r, sd: picksFrom(sdLines, false), me: picksFrom(r.mediTrace || [], true),
           elig: eligibility(sdLines), sdA: anyResid(A.sd), meA: anyResid(A.me) };
}

let bad = 0, graded = 0;
for (const C of CARRIERS) {
  for (const [armName, click] of [['CONTROL      ', SINGLE], ['CONTAMINATED ', SPREAD]]) {
    const R = play(C, click, norm(C.name) + '/' + click.id);
    if (R.unbuildable || R.threw || R.notPlayed) {
      console.log(NL + armName + C.name + '   NOT STAGED: '
        + (R.threw || R.notPlayed || 'unbuildable')); bad++; continue;
    }
    console.log(NL + armName + C.name + ' + ' + click.name + '   turns=' + R.r.turns);
    /* THE FIXTURE FIRST. A cell that could only come out one way is refused before it is graded. */
    if (!R.elig.length) {
      console.log('    REFUSED — the residual never fired, so there was no choice to get wrong.');
      bad++; continue;
    }
    let forced = 0;
    for (const e of R.elig) {
      const ok = e.upEligible >= 2 && e.downEligible >= 2;
      if (!ok) forced++;
      console.log('    eligible: +' + UP + ' from ' + e.upEligible + ' of ' + STATS.length
        + ', -1 from ' + e.downEligible + ' of ' + (STATS.length - 1)
        + '   ' + (ok ? '' : '<-- FORCED, refused'));
    }
    if (forced) { console.log('    REFUSED — ' + forced + ' of ' + R.elig.length
      + ' residual(s) offered fewer than two candidates on a draw.'); bad++; continue; }
    graded++;
    console.log('    authority  ' + (fold(R.sd) || '(none)'));
    console.log('    medicham   ' + (fold(R.me) || '(none)'));
    console.log('    residual-bucket draws `<seed>|<turn>|any|-|-|n`:  authority ' + R.sdA.length
      + '   medicham ' + R.meA.length
      + (R.sdA.length === R.meA.length ? '   (matched)' : '   <-- COUNT ASYMMETRY, so `nth` is shifted'));
    const meSet = new Set(R.meA), sdSet = new Set(R.sdA);
    const sdOnly = R.sdA.filter(a => !meSet.has(a)), meOnly = R.meA.filter(a => !sdSet.has(a));
    if (sdOnly.length) console.log('      authority only: ' + sdOnly.join(' '));
    if (meOnly.length) console.log('      medicham only:  ' + meOnly.join(' '));
    if (fold(R.sd) !== fold(R.me)) { console.log('    DIFFERS'); bad++; }
    else console.log('    AGREE');
  }
}

console.log(NL + 'graded ' + graded + ' board(s).');
if (bad) {
  console.log(bad + ' FAILING CLAUSE(S) — the two engines chose different stats, or a board could'
    + ' not be graded. The handler is not what parted: read the residual-bucket draw counts above.');
}
process.exit(bad ? 1 : 0);
