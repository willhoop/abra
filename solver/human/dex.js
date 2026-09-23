/* solver/human/dex.js — the ONE place the solver's human-dataset code touches Showdown.
 *
 * Every Pokemon fact this dataset uses (a move's target type, a mega forme's ability, whether an
 * entity is in the regulation) is READ from Dex.forFormat on the Reg M-C checkout, never typed.
 * The checkout is found the same way the engine finds it: SHOWDOWN_PATH if set, else the
 * `checkout` named for regmc in data/regulations.json, as a sibling of the repo.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'regulations.json'), 'utf8'));
const RT = REGS.runtime.regmc;
const FORMAT = RT.bo3Format;                      // gen9championsvgc2026regmcbo3 — read, not typed

function checkoutPath() {
  if (process.env.SHOWDOWN_PATH) return process.env.SHOWDOWN_PATH;
  for (const c of [path.join(ROOT, '..', RT.checkout), path.join(ROOT, RT.checkout)]) {
    if (fs.existsSync(path.join(c, 'dist', 'sim'))) return c;
  }
  throw new Error('solver/dex: no Reg M-C Showdown checkout found (looked for ../' + RT.checkout + '); set SHOWDOWN_PATH');
}

const SD = checkoutPath();
const { Dex } = require(path.join(SD, 'dist', 'sim'));
const D = Dex.forFormat(FORMAT);
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');

/* The checkout's HEAD commit, read from the .git directory as a FILE (no git process is run). */
function checkoutCommit() {
  try {
    const g = path.join(SD, '.git');
    let head = fs.readFileSync(path.join(g, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref: ')) return head;
    const ref = head.slice(5);
    const loose = path.join(g, ref);
    if (fs.existsSync(loose)) return fs.readFileSync(loose, 'utf8').trim();
    const packed = fs.readFileSync(path.join(g, 'packed-refs'), 'utf8');
    const m = packed.split('\n').find(l => l.endsWith(' ' + ref));
    return m ? m.split(' ')[0] : null;
  } catch (e) { return null; }
}

/* Move target types for which the player CHOOSES a target in doubles (Showdown's choosable set). */
const CHOOSABLE = new Set(['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe']);

module.exports = {
  D, Dex, toID, legal, FORMAT, SINGLES_FORMAT: RT.showdownFormat, SHOWDOWN_PATH: SD,
  PINNED_COMMIT: RT.pinnedCommit, checkoutCommit,
  moveTargetType: m => { const x = D.moves.get(m); return x.exists ? x.target : null; },
  moveType: m => { const x = D.moves.get(m); return x.exists ? x.type : null; },
  choosable: m => { const x = D.moves.get(m); return x.exists ? CHOOSABLE.has(x.target) : null; },
  species: s => D.species.get(s),
  item: s => D.items.get(s),
  ability: s => D.abilities.get(s),
  move: s => D.moves.get(s),
};
