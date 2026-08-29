/* side_selection_census.js — EVERY PLACE THIS ENGINE WRITES DOWN A SIDE, AND WHICH QUESTION IT IS
 * ANSWERING.
 *
 *   node engine/side_selection_census.js              # print the census and the ratchet verdict
 *   node engine/side_selection_census.js --write      # restamp data/side-selection-census.json
 *   node engine/side_selection_census.js --undeclared # only the rows nobody has classified
 *
 * ================= WHY THIS EXISTS, AND WHY THE OTHER SHAPE OF CHECK FAILED =====================
 *
 * Five separate defects on 2026-08-29 were one wrong belief — *the other side is the far side* — in
 * code with no shared function, array or predicate between them: `redirectDrawnTo`'s callers, the
 * attack branch's spread guard, `sideBuffRefuses`, all three default-target draws, and Instruct's
 * repeat. Each was found by fixing the previous one and never by a gate.
 *
 * THE SAFEGUARD PASS DERIVED ITS SET FROM THE AUTHORITY — "which handlers receive a source" — found
 * zero others, said so honestly, and the very next batch found one anyway. That frame CANNOT see this
 * class: a bad SELECTOR hands a CORRECT predicate the wrong body, so the symptom arrives wearing the
 * predicate's name, and the selector it came from (`Battle#getRandomTarget`) is a plain method with no
 * `on…` name to enumerate. An authority-side enumeration is structurally blind to it.
 *
 * So this census is ENGINE-SIDE. It asks of this file, not of Showdown: **where does a line pick one
 * half of the field, and is that a SIDE question or a TARGET question?**
 *
 *   SIDE    "who are this body's opponents / whose side does this land on" — hard-coding the far side
 *           is simply correct. Trapping, the spread-target list, hazards, a switch's own party.
 *   TARGET  "which body does this action address, and where does THAT body stand" — the far side is
 *           an assumption, and the answer belongs to the move's target class or to the resolved body.
 *
 * ================= WHAT IT CATCHES, AND WHAT IT DOES NOT — SAID PLAINLY ==========================
 *
 * It matches a TERNARY whose two branches are a matched `<name>A` / `<name>B` pair in either order,
 * with an optional dotted receiver. That is spelling-agnostic in the ways this file has actually
 * varied: `it.side==='A'?actB:actA`, `_side==='A'?actB:actA` (a leading underscore defeats a `\bside`
 * regex — measured), `it.side==='A'?field.sgB:field.sgA`, `m._sf===sfA?sfB:sfA` (which does not
 * mention `side` at all), `!==`, `'B'` first, and any amount of whitespace. It also catches a
 * `'p1'`/`'p2'` label pair.
 *
 * IT WOULD NOT CATCH A SITE THAT PICKS A SIDE SOME OTHER WAY — a helper that returns the far array
 * and is then called by name, an index arithmetic like `sides[1 - i]`, or a filter written out in
 * full. That is the honest limit, stated the way the Safeguard pass stated its own: a gate built from
 * an instance catches that instance. What this one adds is that a NEW site cannot appear silently —
 * it arrives UNDECLARED and the ratchet refuses to let the undeclared count rise.
 *
 * ================= THE KEY IS NOT THE LINE NUMBER ==============================================
 *
 * A declaration keyed on a line number would go stale on the next edit anywhere above it, which is
 * this project's oldest failure mode. The key is `anchor | expr | digest`: the nearest enclosing named
 * context (a `function` name, or an `a.kind==='x'` branch test), the normalised expression, and a
 * digest of the SITE'S OWN CODE with whitespace removed. Moving a site does not invalidate its
 * declaration; CHANGING what it selects does, which is the point.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const SOURCES = ['engine/medicham2-browser.js'];
const DECL_PATH = D('data', 'side-selection-declarations.json');
const OUT_PATH = D('data', 'side-selection-census.json');

/* ---- STRIP COMMENTS. A site named inside a comment is prose, not code, and this file has several —
 * the Armor Tail report's own denominator counted two of them and had to say so. */
function stripComments(lines) {
  let inC = false;
  return lines.map(l => {
    let s = l, out = '', i = 0;
    while (i < s.length) {
      if (inC) { const j = s.indexOf('*/', i); if (j < 0) { i = s.length; } else { inC = false; i = j + 2; } }
      else {
        const j = s.indexOf('/*', i), k = s.indexOf('//', i);
        if (j >= 0 && (k < 0 || j < k)) { out += s.slice(i, j); inC = true; i = j + 2; }
        else if (k >= 0) { out += s.slice(i, k); i = s.length; }
        else { out += s.slice(i); i = s.length; }
      }
    }
    return out;
  });
}

/* A matched `<name>A` / `<name>B` pair as the two branches of a ternary, either order, receiver
 * optional. `p1`/`p2` string labels are the same question wearing Showdown's spelling. */
const PAIR = /([A-Za-z_$][A-Za-z0-9_$]*)([AB])\b\s*:\s*(?:[A-Za-z_$][A-Za-z0-9_$]*\.)?([A-Za-z_$][A-Za-z0-9_$]*)([AB])\b/g;
const LABEL = /'(p[12])'\s*:\s*'(p[12])'/g;
const ANCHOR_FN = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/;
const ANCHOR_KIND = /\.kind\s*===\s*'([a-z]+)'/;
const ANCHOR_CONST = /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\(?\s*[a-z]/i;

function anchorFor(code, at) {
  /* Nearest enclosing NAMED context, searching upward. A branch test wins over a function name when
   * it is closer, because the battle loop is one enormous function and every site inside it would
   * otherwise share an anchor. */
  for (let i = at; i >= 0 && i > at - 1500; i--) {
    const k = ANCHOR_KIND.exec(code[i]); if (k) return 'kind:' + k[1];
    const f = ANCHOR_FN.exec(code[i]); if (f) return 'fn:' + f[1];
  }
  return 'fn:<module>';
}

function scan(file) {
  const raw = fs.readFileSync(D(file), 'utf8').split(/\r?\n/);
  const code = stripComments(raw);
  const sites = [];
  code.forEach((l, i) => {
    const seen = new Set();
    let m;
    PAIR.lastIndex = 0;
    while ((m = PAIR.exec(l))) {
      if (m[1] !== m[3] || m[2] === m[4]) continue;
      const expr = (m[1] + m[2] + ':' + m[3] + m[4]);
      if (seen.has(expr)) continue;
      seen.add(expr);
      sites.push({ file, line: i + 1, family: m[1], expr, far: m[2] === 'B',
                   anchor: anchorFor(code, i), text: l.trim().slice(0, 160) });
    }
    LABEL.lastIndex = 0;
    while ((m = LABEL.exec(l))) {
      const expr = m[1] + ':' + m[2];
      if (seen.has(expr)) continue;
      seen.add(expr);
      sites.push({ file, line: i + 1, family: 'p12', expr, far: m[1] === 'p2',
                   anchor: anchorFor(code, i), text: l.trim().slice(0, 160) });
    }
  });
  return sites;
}

/* THE DIGEST IS OF THE LINE'S OWN CODE, whitespace removed, comments already stripped. Two sites that
 * share an anchor and an expression are still two sites — the battle loop's `kind:attack` branch holds
 * five, and a key that merged them would let a declaration written for one silently cover the others.
 * EDITING A SITE INVALIDATES ITS DECLARATION, which is the safety property and not a defect: a line
 * that now selects something else has to be re-answered. */
const crypto = require('crypto');
const digestOf = t => crypto.createHash('sha1').update(String(t).replace(/\s+/g, '')).digest('hex').slice(0, 8);
const keyOf = s => s.anchor + ' | ' + s.expr + ' | ' + digestOf(s.text);

/* AN ABSENT DECLARATIONS FILE IS A REAL STATE AND IT IS ANNOUNCED, NEVER SWALLOWED. Anything else —
 * a truncated write, a syntax error, a permissions failure — RETHROWS, because a census that silently
 * read zero declarations would report every site as UNDECLARED and look exactly like a working
 * instrument that had found a hundred new defects. */
let decl = {};
try {
  decl = JSON.parse(fs.readFileSync(DECL_PATH, 'utf8')).declarations || {};
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
  console.log('  NOTE — no declarations file at ' + path.relative(D('.'), DECL_PATH)
    + '; every site will read UNDECLARED.');
}

const sites = [].concat(...SOURCES.map(scan));
/* One KEY may cover several LINES — the switch, pivot and pass-state branches each read the same four
 * arrays out of the same anchor. The declaration is per key; the count of lines is reported so a key
 * that quietly grows a member is visible. */
const byKey = new Map();
for (const s of sites) {
  const k = keyOf(s);
  if (!byKey.has(k)) byKey.set(k, { key: k, anchor: s.anchor, family: s.family, expr: s.expr, lines: [], text: s.text });
  byKey.get(k).lines.push(s.line);
}
const rows = [...byKey.values()].map(r => {
  const d = decl[r.key];
  return Object.assign({}, r, {
    question: d ? d.question : 'UNCLASSIFIED',
    authority: d ? d.authority : '',
    note: d ? (d.note || '') : '',
  });
});
rows.sort((a, b) => a.lines[0] - b.lines[0]);

const undeclared = rows.filter(r => r.question === 'UNCLASSIFIED');
const byQ = {};
for (const r of rows) byQ[r.question] = (byQ[r.question] || 0) + 1;

/* THE RATCHET. `undeclared` may fall and may never rise — the same shape as the direct-call ratchet in
 * `tests/test-mechanics.js`. It does NOT claim the declared rows are right; it claims that a NEW side
 * selection cannot enter this file without somebody saying which question it answers. */
/* NO PREVIOUS ARTIFACT MEANS NO FLOOR YET, WHICH IS ANNOUNCED — a ratchet that silently seeded itself
 * from the current run would accept any rise on the run that introduced it. Anything but ENOENT
 * rethrows, for the same reason as the declarations read above. */
let prev = null;
try {
  prev = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
  console.log('  NOTE — no previous census at ' + path.relative(D('.'), OUT_PATH)
    + '; the ratchet floor is seeded from THIS run and constrains nothing until it is written.');
}
const ratchet = prev && typeof prev.undeclared === 'number' ? prev.undeclared : undeclared.length;
const rose = undeclared.length > ratchet;

const ONLY_UNDECLARED = process.argv.includes('--undeclared');
const NL = String.fromCharCode(10);
console.log('SIDE-SELECTION CENSUS — ' + SOURCES.join(', '));
console.log('  ' + sites.length + ' matched lines  ->  ' + rows.length + ' distinct sites (anchor|family|expr)');
console.log('  by question: ' + Object.keys(byQ).sort().map(k => k + ' ' + byQ[k]).join('   '));
console.log('  undeclared: ' + undeclared.length + '   ratchet ' + ratchet
  + (rose ? '   >> ROSE — a new side selection entered with nobody saying what it answers' : '   ok'));
console.log('');
for (const r of rows) {
  if (ONLY_UNDECLARED && r.question !== 'UNCLASSIFIED') continue;
  console.log('  ' + String(r.lines.join(',')).padEnd(22) + r.question.padEnd(14) + r.expr.padEnd(18)
    + r.anchor);
  if (r.authority) console.log('      ' + r.authority + (r.note ? '   — ' + r.note : ''));
  else console.log('      ' + r.text);
}

if (process.argv.includes('--write')) {
  const out = { generated: new Date().toISOString(),
                by: 'engine/side_selection_census.js',
                sources: SOURCES,
                matched_lines: sites.length,
                sites: rows.length,
                by_question: byQ,
                undeclared: undeclared.length,
                rows };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(NL + 'wrote ' + path.relative(D('.'), OUT_PATH));
}
process.exit(rose ? 1 : 0);
