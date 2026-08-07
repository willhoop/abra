/* explain_divergence.js — PUT THE BOARD AND THE DISAGREEMENT IN THE SAME PLACE.
 *
 *   node engine/explain_divergence.js              the 12 most-used divergences
 *   node engine/explain_divergence.js --all        every one in the artifact
 *   node engine/explain_divergence.js --n 30       how many
 *   node engine/explain_divergence.js --cls "-damage field 3"
 *
 * WHY THIS EXISTS. Will, 2026-08-07, on being offered a Showdown replay viewer for the divergent
 * games: *"What good would watching the showdown replay give? You would have to still give me the play
 * by play on what medicham is doing and i guess i could compare that to showdown?"* — correct, and the
 * replay-room idea was half-baked. Watching the authority alone shows what is RIGHT, not where WE went
 * wrong; it leaves a human holding a video in one hand and a protocol dump in the other.
 *
 * But the raw line is not enough either. `|-enditem|Whimsicott|Focus Sash` means nothing without
 * knowing Whimsicott was at full HP, what hit it, and whether it should have survived. THE BOARD IS
 * THE MISSING HALF, and a human who plays this format can read a board and a disagreement together in
 * about two seconds — five separate mechanic errors were caught that way on 2026-08-06/07, every one
 * of them by Will and none by a gate.
 *
 * So: reconstruct the state at the moment the streams part, from the authority's own stream, and print
 * it beside both engines' next few lines. No player, no iframe, no room. Text you can scan thirty of.
 *
 * THE STATE IS REBUILT FROM SHOWDOWN'S STREAM, NEVER FROM OURS. Ours is the stream with the missing
 * lines — that is the whole point — so reading the board out of it would show a board that never
 * existed. Where the two disagree about the board itself, that disagreement IS the finding and is
 * printed rather than resolved.
 */

'use strict';
require('./showdown_path.js');
if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — set SHOWDOWN_PATH to a built pokemon-showdown checkout. This is not a pass.');
  process.exit(2);
}

const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N_SHOW = +arg('--n', process.argv.includes('--all') ? 1e9 : 12);
const ONLY_CLS = arg('--cls', null);

const ART = JSON.parse(fs.readFileSync(D('data', 'game-differential.json'), 'utf8'));

/* ---- a small protocol reader: enough board to judge a line, and no more ------------------------- */

/* DELIBERATELY PARTIAL. This models what a human needs to answer "should that have happened" — who is
 * out, how hurt, what is up, what was clicked. It does NOT model the game. Anything it cannot read it
 * leaves blank rather than guessing, because a guessed board is worse than none: it would make a
 * correct engine look wrong. */
function boardAt(lines, upto) {
  const st = { active: {}, hp: {}, maxhp: {}, status: {}, boosts: {}, weather: null, terrain: null,
               side: {}, turn: 0, clicked: [], lastTurnIdx: 0 };
  const nm = (s) => String(s || '').split(':').slice(1).join(':').trim() || String(s || '');
  const slot = (s) => String(s || '').split(':')[0].trim();
  for (let i = 0; i < upto && i < lines.length; i++) {
    const p = String(lines[i]).split('|');
    const t = p[1];
    if (t === 'turn') { st.turn = +p[2] || st.turn; st.clicked = []; st.lastTurnIdx = i; }
    else if (t === 'switch' || t === 'drag' || t === 'replace') {
      const s = slot(p[2]); st.active[s] = nm(p[2]);
      const hp = String(p[4] || '').split(' ')[0];
      const [c, m] = hp.split('/').map(Number);
      if (!isNaN(c)) st.hp[s] = c; if (!isNaN(m)) st.maxhp[s] = m;
      st.boosts[s] = {}; st.status[s] = null;
    }
    else if (t === 'detailschange' || t === '-formechange') { const s = slot(p[2]); st.active[s] = nm(p[2]); }
    else if (t === 'move') { st.clicked.push(slot(p[2]) + ' ' + (p[3] || '') + (p[4] ? ' -> ' + slot(p[4]) : '')); }
    else if (t === '-damage' || t === '-heal' || t === '-sethp') {
      const s = slot(p[2]); const hp = String(p[3] || '').split(' ')[0];
      if (/fnt/i.test(p[3] || '')) { st.hp[s] = 0; }
      else { const [c, m] = hp.split('/').map(Number); if (!isNaN(c)) st.hp[s] = c; if (!isNaN(m)) st.maxhp[s] = m; }
    }
    else if (t === '-status') { st.status[slot(p[2])] = p[3]; }
    else if (t === '-curestatus') { st.status[slot(p[2])] = null; }
    else if (t === '-boost' || t === '-unboost') {
      const s = slot(p[2]); st.boosts[s] = st.boosts[s] || {};
      const d = (t === '-boost' ? 1 : -1) * (+p[4] || 0);
      st.boosts[s][p[3]] = (st.boosts[s][p[3]] || 0) + d;
    }
    else if (t === '-weather') { st.weather = (p[2] === 'none') ? null : p[2]; }
    else if (t === '-fieldstart') { st.terrain = p[2]; }
    else if (t === '-fieldend') { st.terrain = null; }
    else if (t === '-sidestart') { const s = slot(p[2]); st.side[s] = (st.side[s] || []).concat(p[3]); }
    else if (t === 'faint') { st.hp[slot(p[2])] = 0; }
  }
  return st;
}

function renderBoard(st) {
  const slots = ['p1a', 'p1b', 'p2a', 'p2b'];
  const cell = (s) => {
    if (!st.active[s]) return null;
    const cur = st.hp[s], mx = st.maxhp[s];
    const pct = (cur != null && mx) ? Math.round(100 * cur / mx) + '%' : '?';
    const b = st.boosts[s] || {};
    const bs = Object.entries(b).filter(([, v]) => v).map(([k, v]) => (v > 0 ? '+' : '') + v + k).join(' ');
    return '    ' + s + '  ' + String(st.active[s]).padEnd(18)
      + String((cur != null ? cur : '?') + (mx ? '/' + mx : '')).padStart(8) + '  ' + pct.padStart(4)
      + (st.status[s] ? '  ' + st.status[s].toUpperCase() : '')
      + (bs ? '  [' + bs + ']' : '');
  };
  const out = [];
  out.push('    ---- YOU (p1) ' + '-'.repeat(46));
  for (const s of ['p1a', 'p1b']) { const c = cell(s); if (c) out.push(c); }
  out.push('    ---- FOE (p2) ' + '-'.repeat(46));
  for (const s of ['p2a', 'p2b']) { const c = cell(s); if (c) out.push(c); }
  const field = [];
  if (st.weather) field.push('weather: ' + st.weather);
  if (st.terrain) field.push('terrain: ' + st.terrain);
  for (const [s, v] of Object.entries(st.side)) if (v && v.length) field.push(s + ' side: ' + v.join(', '));
  if (field.length) out.push('    field   ' + field.join('   |   '));
  return out.join('\n');
}

/* ---- the report -------------------------------------------------------------------------------- */

const fd = (ART.first_divergences || []).filter(d => !ONLY_CLS || d.cls === ONLY_CLS);

/* RANK BY REACHABILITY AND USAGE, NOT BY ORDER IN THE FILE. Every cause carries `mentions` with
 * legal/carriers/reachable/uses since 2026-08-07, and the reason is that three WIREs that night were
 * argued from mechanics that cannot occur in Champions. Reading the artifact top-down reproduces that
 * error by accident; sorting by usage does not. */
const byCause = new Map();
for (const c of (ART.classes || [])) for (const k of (c.causes || [])) byCause.set(k.cause, k);
const usesOf = (d) => { const k = byCause.get(d.cause); return (k && typeof k.max_uses === 'number') ? k.max_uses : -1; };
fd.sort((a, b) => usesOf(b) - usesOf(a));

console.log('');
console.log('WHERE THE ENGINES PART, WITH THE BOARD THAT MADE IT HAPPEN');
console.log('release ' + ART.engine_release + '   showdown ' + String(ART.showdown_commit || '').slice(0, 12)
            + '   ' + fd.length + ' divergences on file, showing ' + Math.min(N_SHOW, fd.length));
console.log('');
console.log('THE BOARD IS REBUILT FROM SHOWDOWN\'S STREAM. Ours is the one with lines missing — that is');
console.log('the finding — so reading the board out of it would show a board that never existed.');
console.log('');

let shown = 0;
for (const d of fd) {
  if (shown >= N_SHOW) break;
  const k = byCause.get(d.cause);
  const u = usesOf(d);
  console.log('='.repeat(96));
  console.log('#' + (++shown) + '   [' + d.cls + ']' + (u >= 0 ? '    heaviest entity: ' + u + ' uses' : '')
              + (k && k.cannot_occur_in_format ? '   *** CANNOT OCCUR IN THIS FORMAT ***' : ''));
  console.log('     ' + d.seed);
  console.log('');
  /* The artifact does not carry the stream, so the board is only available when a caller has replayed
   * the game. Printed as UNAVAILABLE rather than reconstructed from the cause string, which would be
   * a guess dressed as a measurement. */
  if (d.sd_context && d.sd_context.length) {
    console.log(renderBoard(boardAt(d.sd_context, d.sd_context.length)));
    console.log('');
    console.log('    they agreed for ' + d.agreed_lines + ' lines, then:');
  } else {
    console.log('    BOARD UNAVAILABLE — the artifact stores the divergent line, not the stream.');
    console.log('    Re-run the differential with --explain to capture context. Lines only:');
  }
  console.log('');
  console.log('    SHOWDOWN   ' + (d.showdown || '(nothing)'));
  console.log('    OURS       ' + (d.medicham || '(nothing)'));
  if (k && k.mentions && k.mentions.length) {
    console.log('');
    console.log('    entities   ' + k.mentions.map(m =>
      m.id + '(' + m.kind.slice(0, 4) + (m.uses != null ? ' ' + m.uses + 'u' : '')
      + (m.reachable === false ? ' UNREACHABLE' : '') + ')').join('  '));
  }
  console.log('');
}
console.log('='.repeat(96));
console.log('');
console.log('Sorted by the usage of the heaviest entity each line names, so the top of this list is');
console.log('what actually happens in games rather than what happens to be first in the file.');
console.log('');
