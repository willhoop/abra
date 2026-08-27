/* identity_audit.js — WHO ANSWERS "WHICH ROSTER BODY IS THIS", AND WHETHER THEY WENT THROUGH THE DOOR.
 *
 *   node engine/identity_audit.js            the report, and a non-zero exit if any site is UNROUTED
 *   node engine/identity_audit.js --list     one line per site, machine-readable
 *   node engine/identity_audit.js --break    self-test: prove this check can go RED (see below)
 *
 * ══ WHY THIS EXISTS ═════════════════════════════════════════════════════════════════════════════
 *
 * "Which of the four bodies this side brought is this one" is the FIFTH instance of the species-key
 * class in this repository. It has been found, fixed and gated three times and walked past every
 * gate. The reason is written down in `engine/mc_key.js`: every previous fix was A LIST OF KNOWN-BAD
 * SPELLINGS, and the next instance used a spelling that was not on the list.
 *
 *   2026-07-30  a builder keyed `venusaurmega`, the artifact keyed `venusaur-mega`   0 of 67 writes
 *   2026-08-01  MC.mons[norm(x)] in four more files                                  101 of 308 keys
 *   2026-08-23  buildMon(s.toLowerCase()) in tests/test-engine-diff.js               138 of 345 species
 *   2026-08-23  a bare `globalThis.` prefix walked past the ratchet in eight files
 *   2026-08-26  `partyMap` keyed the party on the DISPLAYED species (ROADMAP #465)   20 collisions / 961 games
 *
 * The fifth is the one this file is about, and it is a different question from `mc_key.js`'s. That
 * file answers *which row of the damage table is this species*; this one answers *which body of the
 * roster is this object*, which stops agreeing with the species the moment something renames a body —
 * in this format, seven abilities do: Disguise, Forecast, Hunger Switch, Illusion, Imposter, Stance
 * Change and Zero to Hero.
 *
 * THE DOOR IS `engine/board_state.js`'s `stableKey`. `game_differential.js`'s `rosterKey` delegates
 * to it and is the same function under another name. Nothing else may re-derive the answer.
 *
 * ══ MEMBERSHIP IS DERIVED FROM THE DOOR, NEVER TYPED ════════════════════════════════════════════
 *
 * This file contains NO list of identity fields. It reads `stableKey`'s own source at run time,
 * pulls out every property chain the door consults on its argument, and scans for those. A field the
 * door starts consulting tomorrow joins this audit on the next run with no edit here — which is the
 * whole point, and is the same construction `engine/generated_audit.js` uses for its membership.
 *
 * The chains split in two, and the split is derived as well — from whether the door's own branch
 * announces itself as a fallback by calling `say(...)`:
 *
 *   HARD   a branch the door trusts silently. Today: `set.species`, `set.name`, `_switchKey`.
 *          A read of one of these is UNAMBIGUOUSLY the identity question, because nothing else in
 *          this repository has a reason to touch them. These are ENFORCED.
 *   SOFT   a branch the door itself flags with `say(...)` — a declared fallback. Today:
 *          `baseSpecies.id`, `species.id`, `name`. These are also ordinary DISPLAY reads all over
 *          the tree, so they are COUNTED AND PRINTED, never enforced. See the hole below.
 *
 * ══ WHAT WALKS PAST IT — READ THIS BEFORE TRUSTING A GREEN RUN ══════════════════════════════════
 *
 * Four things get through, and printing them is the difference between coverage and the look of it:
 *
 *  1. EVERY SOFT-CHAIN SITE. `x.name` and `x.species.id` are display reads far more often than they
 *     are identity reads, and no static rule tells the two apart. They are reported as a count per
 *     file and enforced on nobody. This is the largest hole and it is deliberate: an audit that
 *     failed on every `.name` in the tree would be turned off within a day.
 *  2. AN IDENTITY READ THROUGH A LOCAL ALIAS. `const k = b; ... k._switchKey` is caught (the chain
 *     is still there), but `const f = x => x._switchKey; ... f(b)` moves the read into a helper —
 *     which is caught, and the helper is then the unrouted site, which is the right answer. What is
 *     NOT caught is an identity answered with no chain read at all, e.g. by index into `sf.team`.
 *     That failure has its own name (`partyMap`'s header records index-matching manufacturing 123
 *     diverging games of 179) and its own counter, and it is not this file's question.
 *  3. A FILE OUTSIDE THE SCANNED ROOTS. `engine/`, `tests/` and `build/` are scanned;
 *     `node_modules/`, `data/` (generated) and `.scratch*` are not.
 *  4. A DECLARATION THAT IS WRONG. `IDENTITY-OK: <reason>` exempts a line on the author's word. The
 *     declarations are printed in full on every run so a wrong one is at least visible.
 *
 * ══ THE SELF-TEST — A CHECK THAT CANNOT GO RED IS NOT A CHECK ═══════════════════════════════════
 *
 *   node engine/identity_audit.js --break
 *
 * writes a throwaway file under the scanned roots that reads a HARD chain with no routing and no
 * declaration, re-runs the scan in a child, and FAILS unless that child went red and named the file.
 * It removes only the file it created, and only if it created it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const ROOTS = ['engine', 'tests', 'build'];
const SKIP_DIR = new Set(['node_modules', '.git']);
const DOOR_FILE = 'engine/board_state.js';
const DOOR_FN = 'stableKey';
/* The names a routed call goes through. `rosterKey` is `stableKey` under another name — it delegates
 * and the delegation is asserted by tests/test-roster-identity.js — so a caller reaching either has
 * gone through the one door. */
const ROUTES = ['stableKey', 'rosterKey'];
const DECLARE = 'IDENTITY-OK:';

/* ---- BLANKING, NOT DELETING ------------------------------------------------------------------
 * Comments and string literals are replaced with spaces so line and column numbers survive. A
 * `_switchKey` inside a comment or inside an error message is not a read, and counting one is how an
 * audit earns its reputation for noise. */
function blank(src) {
  const out = src.split('');
  let i = 0, n = src.length;
  const fill = (a, b) => { for (let j = a; j < b && j < n; j++) if (out[j] !== '\n') out[j] = ' '; };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; fill(i, end); i = end; continue; }
    if (c === '/' && d === '/') { let e = src.indexOf('\n', i); if (e < 0) e = n; fill(i, e); i = e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === c) break; if (c !== '`' && src[j] === '\n') break; j++; }
      fill(i, Math.min(j + 1, n)); i = Math.min(j + 1, n); continue;
    }
    i++;
  }
  return out.join('');
}

/* ---- THE DOOR, READ AT RUN TIME --------------------------------------------------------------- */
function readDoor() {
  const src = fs.readFileSync(D(DOOR_FILE), 'utf8');
  const at = src.indexOf('function ' + DOOR_FN);
  if (at < 0) throw new Error('IDENTITY AUDIT CANNOT FIND THE DOOR — `function ' + DOOR_FN + '` is not in '
    + DOOR_FILE + '. That is a real finding, not a scan failure: either the resolver moved or it was renamed, '
    + 'and either way this audit was scanning for the wrong thing. Nothing is reported until it is fixed.');
  let depth = 0, k = src.indexOf('{', at);
  for (; k < src.length; k++) { const c = src[k]; if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) break; } }
  const body = src.slice(at, k + 1);
  const startLine = src.slice(0, at).split('\n').length;
  const endLine = src.slice(0, k).split('\n').length;
  /* the door's parameter name, so the chains are read off the right identifier rather than off a
   * guess. `function stableKey(x, id, note)` -> `x`. */
  const arg = /function\s+\w+\s*\(\s*([A-Za-z_$][\w$]*)/.exec(body);
  if (!arg) throw new Error('IDENTITY AUDIT CANNOT READ THE DOOR\'S PARAMETER LIST.');
  const P = arg[1];
  const clean = blank(body);
  const re = new RegExp('\\b' + P + '((?:\\.[A-Za-z_$][\\w$]*)+)', 'g');
  const chains = new Map();     /* chain -> { soft } */
  const lines = clean.split('\n');
  let m;
  while ((m = re.exec(clean))) {
    const chain = m[1].slice(1);
    if (chain.indexOf('.') < 0 && ['set', 'baseSpecies', 'species'].indexOf(chain) >= 0) continue; /* a prefix of a longer chain */
    const line = clean.slice(0, m.index).split('\n').length;
    /* SOFT if the door announces this branch as a fallback. The branch is the statement group from
     * the matching line to the next `return`, and `say(` inside it is the door's own admission. */
    let soft = false;
    for (let j = line - 1; j < lines.length; j++) {
      if (/\bsay\s*\(/.test(lines[j])) { soft = true; }
      if (/\breturn\b/.test(lines[j])) break;
    }
    /* ANY branch that announces itself makes the chain SOFT — the union, not the intersection. This
     * was AND first and it put every fallback chain in the ENFORCED set: `return id(x.name);` is its
     * own occurrence, contains `return` on the matched line, breaks the scan before it can see the
     * `say(` one line above it, and reported HARD. The audit then accused 1,282 sites, nearly all of
     * them ordinary `.name` display reads. An over-matching derived rule is this project's named
     * failure and it fired on the first run of this file. */
    const prev = chains.get(chain);
    chains.set(chain, { soft: prev ? (prev.soft || soft) : soft });
  }
  /* drop any chain that is a strict prefix of another chain the door consults: `set` is not a field,
   * `set.species` is. */
  const keys = [...chains.keys()];
  for (const c of keys) if (keys.some(o => o !== c && o.startsWith(c + '.'))) chains.delete(c);
  return { chains, startLine, endLine };
}

/* ---- THE SCAN ---------------------------------------------------------------------------------- */
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name) || e.name.startsWith('.scratch')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function scan(door) {
  const hard = [...door.chains.entries()].filter(([, v]) => !v.soft).map(([c]) => c);
  const soft = [...door.chains.entries()].filter(([, v]) => v.soft).map(([c]) => c);
  const rx = cs => cs.map(c => new RegExp('\\.' + c.replace(/\./g, '\\.') + '\\b'));
  const HARD = rx(hard), SOFT = rx(soft);
  const files = [];
  for (const r of ROOTS) { const p = D(r); if (fs.existsSync(p)) walk(p, files); }
  files.sort();
  const sites = [], softCount = new Map();
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    const raw = fs.readFileSync(f, 'utf8');
    const rawLines = raw.split('\n');
    const lines = blank(raw).split('\n');
    lines.forEach((l, i) => {
      if (SOFT.some(r => r.test(l))) softCount.set(rel, (softCount.get(rel) || 0) + 1);
      const hit = hard.filter((c, k) => HARD[k].test(l));
      if (!hit.length) return;
      const no = i + 1;
      let verdict;
      if (rel === DOOR_FILE && no >= door.startLine && no <= door.endLine) verdict = 'DOOR';
      else if (hit.some(c => new RegExp('\\.' + c.replace(/\./g, '\\.') + '\\s*=[^=]').test(l))) verdict = 'STAMP';
      else if (ROUTES.some(n => new RegExp('\\b' + n + '\\s*\\(').test(l))) verdict = 'ROUTED';
      else if (rawLines.slice(Math.max(0, i - 3), i + 1).some(t => t.indexOf(DECLARE) >= 0)) verdict = 'DECLARED';
      else verdict = 'UNROUTED';
      const decl = verdict === 'DECLARED'
        ? (rawLines.slice(Math.max(0, i - 3), i + 1).find(t => t.indexOf(DECLARE) >= 0) || '').trim() : '';
      sites.push({ file: rel, line: no, chains: hit, verdict, decl, text: rawLines[i].trim() });
    });
  }
  return { hard, soft, sites, softCount, fileCount: files.length };
}

/* ---- THE SELF-TEST ------------------------------------------------------------------------------ */
function selfTest() {
  const { spawnSync } = require('child_process');
  const victim = D('tests', '_identity_audit_break.js');
  if (fs.existsSync(victim)) {
    console.log('RED — ' + path.relative(ROOT, victim) + ' already exists. This self-test refuses to '
      + 'overwrite or delete a file it did not create.');
    process.exit(1);
  }
  const door = readDoor();
  const chain = [...door.chains.entries()].filter(([, v]) => !v.soft).map(([c]) => c)[0];
  if (!chain) { console.log('RED — the door consults no HARD chain, so nothing could be planted.'); process.exit(1); }
  fs.writeFileSync(victim, '/* throwaway, written by engine/identity_audit.js --break */\n'
    + 'module.exports = body => body.' + chain + ';\n');
  let ok = false, out = '';
  try {
    const c = spawnSync(process.execPath, [__filename], { encoding: 'utf8' });
    out = String(c.stdout || '') + String(c.stderr || '');
    ok = c.status !== 0 && out.indexOf('_identity_audit_break.js') >= 0;
  } finally { fs.unlinkSync(victim); }
  console.log('  planted an unrouted read of `.' + chain + '` and re-ran the scan in a child.');
  console.log('  ' + (ok ? 'green — the child went RED and named the planted file.'
    : 'RED — THE CHECK DID NOT FIRE. It cannot see the defect it exists to see.'));
  if (!ok) console.log(out.split('\n').map(l => '    |' + l).join('\n'));
  process.exit(ok ? 0 : 1);
}

/* ---- MAIN --------------------------------------------------------------------------------------- */
if (require.main === module) {
  if (process.argv.includes('--break')) selfTest();
  const door = readDoor();
  const r = scan(door);
  const LIST = process.argv.includes('--list');
  if (LIST) {
    for (const s of r.sites) console.log([s.verdict, s.file + ':' + s.line, s.chains.join('+')].join('\t'));
  } else {
    console.log('\n=== IDENTITY AUDIT — who answers "which roster body is this" ===');
    console.log('  the door : ' + DOOR_FILE + ' ' + DOOR_FN + '()  lines ' + door.startLine + '-' + door.endLine);
    console.log('  routed through: ' + ROUTES.join(', ') + '   (rosterKey delegates to stableKey)');
    console.log('  scanned  : ' + r.fileCount + ' .js files under ' + ROOTS.join(', '));
    console.log('\n  CHAINS THE DOOR CONSULTS, read out of its source this run — nothing here is typed:');
    console.log('    HARD (enforced) : ' + (r.hard.map(c => '.' + c).join('  ') || '(none)'));
    console.log('    SOFT (counted)  : ' + (r.soft.map(c => '.' + c).join('  ') || '(none)')
      + '   <- the door flags these branches itself with say(); they are display reads elsewhere too');
    const by = {};
    for (const s of r.sites) (by[s.verdict] = by[s.verdict] || []).push(s);
    for (const v of ['DOOR', 'STAMP', 'ROUTED', 'DECLARED', 'UNROUTED']) {
      const g = by[v] || [];
      console.log('\n  ' + v + '  ' + g.length);
      for (const s of g) {
        console.log('    ' + s.file + ':' + s.line + '  [' + s.chains.join('+') + ']  ' + s.text.slice(0, 110));
        if (s.decl) console.log('        ' + s.decl.slice(0, 140));
      }
    }
    const softTotal = [...r.softCount.values()].reduce((a, b) => a + b, 0);
    console.log('\n  SOFT-CHAIN READS, NOT ENFORCED — ' + softTotal + ' lines in ' + r.softCount.size + ' files.');
    console.log('    This is the hole, stated rather than hidden: `.name` and `.species.id` are display');
    console.log('    reads far more often than identity reads and no static rule separates them.');
    [...r.softCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .forEach(([f, n]) => console.log('      ' + String(n).padStart(4) + '  ' + f));
    const bad = (by.UNROUTED || []).length;
    console.log('\n' + (bad ? 'RED — ' + bad + ' identity read(s) do not go through the door.'
      : 'green — every HARD identity read is the door, a stamp, routed, or declared.'));
    process.exit(bad ? 1 : 0);
  }
}

module.exports = { readDoor, scan, blank };
