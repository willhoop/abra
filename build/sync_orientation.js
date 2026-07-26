/* sync_orientation.js — regenerate the measured figures inside docs/ORIENTATION.md.
 *
 * WHY THIS EXISTS
 * ---------------
 * ORIENTATION is the entry point, and it carried its most important numbers as typed text:
 * "Of 8,356 games collected, 1,061 are usable — 12.7%", a six-row quality funnel, and "33 model
 * engines still read the store raw". By 2026-07-26 the store held 14,794 games with 1,865 usable and
 * 24 unfiltered engines. Every one of those figures was wrong, and wrong in the direction that
 * understates the corpus and overstates the problem.
 *
 * It is the same defect as the hand-maintained site counts, and the document itself argues against
 * it: S8 says measured, never asserted; S13 says anything derivable is generated. A figure derived
 * once and typed in is a hardcode with a longer half-life.
 *
 * So the numbers now live between markers and are rewritten from the store. The prose around them is
 * untouched — this only ever replaces what is between a BEGIN and END pair, so editing the argument
 * is safe and editing the numbers by hand is pointless.
 *
 *   node build/sync_orientation.js          # rewrite in place
 *   node build/sync_orientation.js --check  # exit 1 if stale (for CI)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOC = path.join(ROOT, 'docs', 'ORIENTATION.md');
const Q = require(path.join(ROOT, 'engine', 'quality.js'));

/* The funnel, computed with the SAME rules the engines use, in the order quality.js applies them. */
function funnel() {
  const all = Q.readStore();
  const cfg = Q.config();
  const bots = Q.behaviouralBots(all, cfg);
  const rows = [['collected', all.length]];
  let cur = all;
  const drop = (label, pred) => { cur = cur.filter(pred); rows.push([label, cur.length]); };
  drop('after removing named bots', g => !((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot)));
  drop('after removing accounts that behave like bots',
    g => !(bots.has((g.p1 || {}).name) || bots.has((g.p2 || {}).name)));
  drop('after removing forfeits', g => !g.forfeit);
  const minTurns = ((cfg.rules || {}).min_turns || {}).value || 3;
  drop(`after removing games under ${minTurns} turns`, g => (g.turns || []).length >= minTurns);
  drop('after requiring all four brought to be revealed',
    g => ((g.brought || {}).p1 || []).length === 4 && ((g.brought || {}).p2 || []).length === 4);
  return rows;
}

/* How many engines read the ladder store with neither a clean filter nor a declared reason. Same
 * rule engine/selftest.js enforces, so the document and the test can never disagree. */
function unfiltered() {
  const out = [];
  for (const r of ['engine', 'build', 'web', 'app', 'tests']) {
    const dir = path.join(ROOT, r);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(js|py)$/.test(f)) continue;
      if (['quality.js', 'quality.py', 'selftest.js'].includes(f)) continue;
      let src; try { src = fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { continue; }
      if (!/games\.ladder[\w.-]*\.jsonl/.test(src)) continue;
      const filters = /load_games|loadGames|isClean|clean=True|cleanIds|_cleanIds/.test(src);
      if (!filters && !/RAW-STORE-OK/.test(src)) out.push(r + '/' + f);
    }
  }
  return out.sort();
}

function blocks() {
  const rows = funnel();
  const collected = rows[0][1], usable = rows[rows.length - 1][1];
  const pct = collected ? (100 * usable / collected).toFixed(1) : '0.0';
  const raw = unfiltered();

  const table = ['| Stage | Games remaining |', '|---|---|']
    .concat(rows.map(([l, n], i) =>
      `| ${l} | ${i === rows.length - 1 ? '**' + n.toLocaleString() + '**' : n.toLocaleString()} |`))
    .join('\n');

  return {
    FUNNEL:
      `Of **${collected.toLocaleString()}** games collected, **${usable.toLocaleString()}** are usable — **${pct}%**.\n\n` +
      `Games are dropped for five reasons, in this order:\n\n${table}`,
    RAWREADERS:
      `**${raw.length} engine tools still read the store with neither the clean filter nor a declared reason.**\n` +
      `\`engine/selftest.js\` fails while any remain, and names them:\n\n` +
      (raw.length ? raw.map(f => `\`${f}\``).join(', ') : '_none — the filter is universal._') +
      `\n\nAnything they publish is computed over a store that is ${(100 - +pct).toFixed(1)}% unusable.`,
  };
}

function main() {
  const check = process.argv.includes('--check');
  let doc = fs.readFileSync(DOC, 'utf8');
  const before = doc;
  const B = blocks();
  let missing = [];
  for (const [key, body] of Object.entries(B)) {
    const re = new RegExp(`(<!-- BEGIN:${key} -->)[\\s\\S]*?(<!-- END:${key} -->)`);
    if (!re.test(doc)) { missing.push(key); continue; }
    doc = doc.replace(re, `$1\n${body}\n$2`);
  }
  if (missing.length) {
    console.error('markers not found in ORIENTATION.md: ' + missing.join(', '));
    process.exit(2);
  }
  if (check) {
    if (doc !== before) { console.error('ORIENTATION.md is STALE — run node build/sync_orientation.js'); process.exit(1); }
    console.log('ORIENTATION.md is current'); return;
  }
  if (doc !== before) { fs.writeFileSync(DOC, doc); console.log('ORIENTATION.md updated'); }
  else console.log('ORIENTATION.md already current');
}

main();
