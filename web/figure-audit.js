/* web/figure-audit.js — WEB's own number: what fraction of the figures a visitor reads traces to an
 * artifact.
 *
 *   node web/figure-audit.js            the fraction, per page and overall
 *   node web/figure-audit.js --list     every untraced figure, with its line
 *
 * WHY THIS EXISTS
 * ---------------
 * `.claude/agents/web.md` gives this division one rule — *you may not author a number* — and until
 * now nothing measured whether it was being kept. `docs/DIVISIONS.md` gives every other division a
 * number it is judged on; WEB's was listed as "every rendered figure traces to an artifact" and was
 * never computed. A rule with no measurement is a preference, which is the same sentence CLAUDE.md
 * uses about `portfolio/build/check_projects.py`. The division that polices drift does not get to
 * exempt itself.
 *
 * ONE IMPLEMENTATION, TWO CALLERS. `web/build-status.js` and `tests/test-web-figures.js` both call
 * `audit()` here. Two scanners that both decide what a figure is would disagree eventually and the
 * disagreement would be invisible — CLAUDE.md, FACTS ARE GLOBAL.
 *
 * ================================================================================================
 * DEFINITION 1 — WHAT IS A "FIGURE"
 * ================================================================================================
 * A figure is **a numeric literal that a visitor reads as a claim about the world**. Mechanically:
 *
 *   (a) it appears in VISIBLE TEXT. Visible text is what falls between tags in HTML, plus the
 *       contents of the template literals inside <script>, because that is where most of this site's
 *       prose actually lives — `roomPory()` and friends build their panels from backtick strings.
 *       CSS, JS code, tag names, and HTML attribute values are NOT visible text. A `border:3px` or a
 *       `<text x="704">` is layout, not a claim.
 *
 *   (b) it survives the SCALE FILTER: it has a decimal point, or a thousands separator, or a percent
 *       sign, or is an integer of 100 or more.
 *       WHY: prose is full of small counting words written as digits — "top-3", "one in 10", "turn 8",
 *       "4 alive". Those are language, not measurements, and counting them would swamp the metric with
 *       noise and make it easy to move by rewording. Every measurement this project publishes — a
 *       percentage, a confidence bound, a corpus size, a log-loss — clears the filter. The cost is
 *       real and is stated rather than hidden: a genuine measured value below 100 with no decimal and
 *       no percent sign is invisible to this audit.
 *
 *   (c) it is not a DATE, TIME or VERSION. `2026-07-30`, `14:22` and `v3.20.0` are stamps, not
 *       measurements, and are masked before extraction.
 *
 * NOT counted, and this one matters: a figure produced by a `${...}` interpolation. It is not a
 * figure the site AUTHORED — it is read out of a bundled artifact (`data/live.js`, `data/status.js`,
 * `web/status-data.js`) at render time and cannot drift from it by definition. Interpolations are
 * stripped with the rest of the JS. The denominator here is therefore **hardcoded figures**, which is
 * exactly the population the rule is about.
 *
 * ================================================================================================
 * DEFINITION 2 — WHAT IS "TRACED"
 * ================================================================================================
 * The unit of attribution is the **source line**. Every page under `web/` is written one block per
 * line — a `<p>`, a panel, a tooltip — so a line is a claim and its context. This is an
 * approximation and is named as one: a figure at the end of a very long line is credited by a
 * citation at the start of it.
 *
 * A figure is TRACED when its line's visible text names an artifact path — `data/*.json`,
 * `data/*.js`, `docs/*.md`, `engine/*.js` and so on. That is the citation a reader can follow, and it
 * is the same standard the prose already meets in the places this project got right:
 *   "top-1 29.8% / top-3 65.6% ... from <code>data/policy-eval.json</code>"
 *
 * A figure is WITHDRAWN when it sits inside `<s class="wd" title="...">`. A retracted claim is left
 * on the page struck through rather than deleted, because deleting it hides that it was ever made
 * while leaving it plain keeps asserting it. Withdrawn figures are reported as their own count and
 * are OUT of the denominator — the site is not standing behind them. The `title` is mandatory and its
 * absence is a hard failure, so this cannot be used to launder a live claim: striking a figure out
 * makes it render struck out.
 *
 * Everything else is UNTRACED, and the coverage number is
 *
 *      traced / (traced + untraced)
 *
 * PUBLISH THE BAD NUMBER. This started at a fraction the division would not have chosen. That is the
 * finding; a metric introduced at a flattering value would not have been worth introducing.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* ================================================================================================
 * ALLOWLIST — figures that clear the scale filter but are not claims about the world.
 * Declared BY LINE CONTENT with a REASON, never by a pattern broad enough to swallow a real figure
 * added later. This is `tests/test-stadium-roster.js`'s rule for judgement gaps, applied to numbers.
 * ============================================================================================== */
const ALLOW = [
  { re: /^\d{3,4}$/, ctx: /Champions|Reg M-B|generation|Gen \d/i, why: 'a format or generation label, not a measurement' },
];

/* ---- visible-text extraction ------------------------------------------------------------------
 * Returns, per line, the visible text on that line and the visible text on it that is struck out.
 * Handles: <style> (skipped), <script> (skipped EXCEPT template-literal contents, which are markup),
 * HTML comments, and `${...}` interpolations (dropped — see DEFINITION 1).
 */
function visibleByLine(src) {
  const lines = src.split('\n');
  const vis = lines.map(() => '');
  const wd = lines.map(() => '');
  let line = 0;
  let strikeDepth = 0;          /* inside <s class="wd"> */

  /* emit one character of visible text at the current line */
  const emit = (ch) => {
    vis[line] += ch;
    if (strikeDepth > 0) wd[line] += ch;
  };
  const bump = (ch) => { if (ch === '\n') line++; };

  /* --- THE HTML SCANNER, fed one character at a time. Character-at-a-time rather than slice-at-a-
   *     time so that markup and template literals SHARE tag state: `roomPory()` opens a <p> in one
   *     backtick string and code between literals never closes it, and a slice-based scanner treats
   *     the resumed text as if it were inside a tag. --- */
  let tagBuf = null;     /* accumulating a <tag ...>, or null */
  let inComment = false;
  function scanHtmlChar(c) {
    if (inComment) { if (c === '>' && tagBuf.slice(-2) === '--') { inComment = false; tagBuf = null; } else tagBuf += c; return; }
    if (tagBuf !== null) {
      tagBuf += c;
      if (tagBuf === '<!--') { inComment = true; return; }
      if (c === '>') {
        const tag = tagBuf;
        /* <s class="wd"> opens a withdrawn run; </s> closes it. */
        if (/^<s[\s>]/i.test(tag) && /class\s*=\s*["']?[^"'>]*\bwd\b/i.test(tag)) strikeDepth++;
        else if (/^<\/s\s*>/i.test(tag) && strikeDepth > 0) strikeDepth--;
        tagBuf = null;
      }
      return;
    }
    if (c === '<') { tagBuf = '<'; return; }
    emit(c === '\n' ? ' ' : c);
  }
  function scanHtml(s) { for (let i = 0; i < s.length; i++) { scanHtmlChar(s[i]); bump(s[i]); } }

  /* --- top level: split on <style> / <script>, and lex script bodies for template literals ------ */
  let i = 0;
  while (i < src.length) {
    const m = /<(script|style)\b[^>]*>/i.exec(src.slice(i));
    if (!m) { scanHtml(src.slice(i)); break; }
    const openAt = i + m.index;
    scanHtml(src.slice(i, openAt));
    const bodyAt = openAt + m[0].length;
    for (let k = openAt; k < bodyAt; k++) bump(src[k]);
    const closeRe = new RegExp('</' + m[1] + '\\s*>', 'i');
    const cm = closeRe.exec(src.slice(bodyAt));
    const bodyEnd = cm ? bodyAt + cm.index : src.length;
    const body = src.slice(bodyAt, bodyEnd);
    if (m[1].toLowerCase() === 'style') { for (const ch of body) bump(ch); }
    else scanScript(body);
    for (let k = bodyEnd; k < (cm ? bodyEnd + cm[0].length : bodyEnd); k++) bump(src[k]);
    i = cm ? bodyEnd + cm[0].length : src.length;
  }

  /* A small JS lexer. It exists only to find template-literal bodies, which on this site are HTML.
   * It tracks comments and quoted strings so a backtick inside one does not open a bogus literal,
   * and it tracks `${...}` nesting so a template inside an interpolation is still found. */
  function scanScript(s) {
    let i = 0;
    const stack = [];               /* {kind:'tpl'} | {kind:'expr', braces:n} */
    const top = () => stack[stack.length - 1];
    let lastSig = '';               /* last significant code character — tells regex from division */
    while (i < s.length) {
      const c = s[i];
      const prevSig = lastSig;
      if (!/\s/.test(c)) lastSig = c;
      const inTpl = top() && top().kind === 'tpl';
      if (inTpl) {
        if (c === '\\') { bump(s[i]); bump(s[i + 1]); i += 2; continue; }
        if (c === '`') { stack.pop(); bump(c); i++; continue; }
        if (c === '$' && s[i + 1] === '{') { stack.push({ kind: 'expr', braces: 0 }); bump(c); bump(s[i + 1]); i += 2; continue; }
        /* a template body is markup: hand the character to the HTML scanner one at a time */
        if (top().markup) scanHtmlChar(c);
        bump(c); i++; continue;
      }
      /* code / interpolation-expression mode */
      if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') { bump(s[i]); i++; } continue; }
      if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); const stop = e < 0 ? s.length : e + 2; for (let k = i; k < stop; k++) bump(s[k]); i = stop; continue; }
      /* A REGEX LITERAL, WHICH IS NOT DIVISION. This is not pedantry: `index.html:662` contains
       * `.replace(/"/g,'&quot;')` inside a `${...}`, and without this branch the `"` opened a string
       * that ran to end of line, the interpolation frame never closed, and the lexer was one frame
       * out for the REST OF THE FILE — 36 lines of raw JavaScript were being read as page prose.
       * The rule is the usual one: a `/` after a value is division, a `/` anywhere else is a regex. */
      if (c === '/' && !/[A-Za-z0-9_$)\]]/.test(prevSig)) {
        bump(c); i++;
        let inClass = false;
        while (i < s.length) {
          const d = s[i];
          if (d === '\\') { bump(s[i]); bump(s[i + 1]); i += 2; continue; }
          if (d === '\n') break;
          if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) { bump(d); i++; break; }
          bump(d); i++;
        }
        while (i < s.length && /[a-z]/.test(s[i])) { bump(s[i]); i++; }  /* flags */
        lastSig = '/';
        continue;
      }
      if (c === '"' || c === "'") {
        /* A QUOTED STRING CAN BE PROSE. `stadium.html` keeps every cabinet's honest verdict in an
         * ordinary double-quoted string, not a template literal — skipping quoted strings outright
         * reported that page as carrying no figures at all, which is exactly the silent-zero this
         * project keeps getting caught by. So: find the string, and treat it as visible markup when
         * it READS like prose. The bar is 8+ SPACE-SEPARATED alphabetic words. Space-separated, not
         * merely alphabetic: `"text-align:center;font-size:12px;color:#9aa3b2;font-weight:600"` has
         * twelve letter-runs and not one space, and it was being read as a sentence — which is how
         * `font-weight:600` turned up in the untraced list as if it were a claim. */
        const q = c; let j = i + 1; let body = '';
        while (j < s.length) {
          if (s[j] === '\\') { body += s[j] + (s[j + 1] || ''); j += 2; continue; }
          if (s[j] === q || s[j] === '\n') break;
          body += s[j]; j++;
        }
        const words = body.split(/\s+/).filter(t => /^[A-Za-z][A-Za-z'’]{1,}[.,;:!?)]?$/.test(t)).length;
        bump(c);
        for (let k = i + 1; k < j; k++) { if (words >= 8) scanHtmlChar(s[k]); bump(s[k]); }
        if (j < s.length) bump(s[j]);
        i = j + 1;
        continue;
      }
      /* A TEMPLATE LITERAL IS NOT ALWAYS MARKUP. `index.html:1289` builds a bare style string in a
       * backtick — `font-weight:800;color:${...}` — and with no tag in it the whole thing reads as
       * page text, so `800` was being counted as a published figure. A literal that contains no `<`
       * outside its interpolations is a value, not a panel, and is skipped. */
      if (c === '`') { stack.push({ kind: 'tpl', markup: tplIsMarkup(s, i + 1) }); bump(c); i++; continue; }
      if (top() && top().kind === 'expr') {
        if (c === '{') top().braces++;
        else if (c === '}') { if (top().braces === 0) { stack.pop(); bump(c); i++; continue; } top().braces--; }
      }
      bump(c); i++;
    }
  }

  return lines.map((raw, n) => ({ n: n + 1, raw: raw, visible: vis[n], withdrawn: wd[n] }));
}

/** Does the template literal starting at `k` contain a tag, ignoring its `${...}` interpolations? */
function tplIsMarkup(s, k) {
  let depth = 0;
  for (let i = k; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { i++; continue; }
    if (depth === 0) {
      if (c === '`') return false;
      if (c === '$' && s[i + 1] === '{') { depth = 1; i++; continue; }
      if (c === '<') return true;
    } else {
      if (c === '{') depth++;
      else if (c === '}') depth--;
    }
  }
  return false;
}

/* ---- figures inside one string ----------------------------------------------------------------- */
const ENT = { '&nbsp;': ' ', '&ndash;': '-', '&mdash;': '-', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&ldquo;': '"', '&rdquo;': '"', '&eacute;': 'e', '&times;': 'x' };
/* `&#9662;` is a glyph (▾), not the number 9662. Numeric entities are dropped, not spelled out. */
function decode(s) { return s.replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/g, m => (ENT[m] !== undefined ? ENT[m] : ' ')); }

/* DEFINITION 1(c): stamps are masked before extraction so they can never be read as measurements. */
function mask(s) {
  return s
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')          /* ISO date */
    .replace(/\bv?\d+\.\d+\.\d+\b/g, ' ')        /* semver */
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ') /* clock time */
    .replace(/\btop-\d\b/gi, ' ')                /* top-1 / top-3 are rank labels */
    .replace(/\bGen\s?\d\b/gi, ' ');
}

function figuresIn(text) {
  const s = mask(decode(text));
  const out = [];
  const re = /\d[\d,]*(?:\.\d+)?%?/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const tok = m[0];
    const bare = tok.replace(/%$/, '');
    const hasDot = bare.indexOf('.') >= 0, isPct = /%$/.test(tok);
    /* A COMMA COUNTS ONLY AS A THOUSANDS SEPARATOR. Treating any comma as one turned `C(6,4)`,
     * `leading 2, ` and `rgba(47,180,95,` into three, two and three "figures" — combinatorics
     * notation and a colour, none of them a claim about anything. */
    const hasComma = /^\d{1,3}(,\d{3})+$/.test(bare);
    if (bare.indexOf(',') >= 0 && !hasComma) continue;
    const val = parseFloat(bare.replace(/,/g, ''));
    /* DEFINITION 1(b), the scale filter. */
    if (!(hasDot || hasComma || isPct || val >= 100)) continue;
    /* a bare four-digit year that slipped past the ISO mask */
    if (!hasDot && !hasComma && !isPct && val >= 1900 && val <= 2100 && bare.length === 4) continue;
    out.push({ tok: tok, at: m.index, before: s.slice(Math.max(0, m.index - 40), m.index) });
  }
  return out;
}

const CITE = /\b(?:data|docs|engine|tests|web|app|build|portfolio)\/[A-Za-z0-9_.\-]+\.(?:json|jsonl|js|md|py|html|txt)\b/;

/* ---- the audit ---------------------------------------------------------------------------------- */
function auditFile(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const rows = visibleByLine(src);
  let traced = 0, untraced = 0, withdrawn = 0;
  const open = [], badStrike = [];

  /* every <s class="wd"> must say when and why, or the strike is not a declaration */
  const strikeRe = /<s\b[^>]*class\s*=\s*["']?[^"'>]*\bwd\b[^>]*>/gi;
  let sm;
  while ((sm = strikeRe.exec(src)) !== null) {
    if (!/title\s*=\s*["'][^"']{10,}/i.test(sm[0])) {
      badStrike.push({ n: src.slice(0, sm.index).split('\n').length, tag: sm[0].slice(0, 90) });
    }
  }

  /* LIVE PLACEHOLDERS. `<b id="pv_mh">100</b>`, `<span id="magHPAv">100%</span>`,
   * `<div id="pv_out">50%</div>` — an element with an `id` whose ENTIRE content is one bare figure
   * exists to be overwritten by script on the first render. It is the static spelling of a `${...}`
   * and is out of the denominator for the same reason: nobody authored it as a claim. The rule is
   * deliberately narrow — sole content, no surrounding words — because a real claim is a sentence. */
  let placeholders = 0;
  const phByLine = new Map();
  const phRe = /<(\w+)\b[^>]*\bid\s*=\s*["'][^"']+["'][^>]*>([^<>]{1,12})<\/\1>/g;
  let pm;
  while ((pm = phRe.exec(src)) !== null) {
    const inner = pm[2].trim();
    const fs2 = figuresIn(inner);
    if (fs2.length !== 1 || fs2[0].tok !== decode(inner).trim()) continue;
    const n = src.slice(0, pm.index).split('\n').length;
    if (!phByLine.has(n)) phByLine.set(n, []);
    phByLine.get(n).push(fs2[0].tok);
  }

  for (const row of rows) {
    if (!row.visible.trim()) continue;
    const all = figuresIn(row.visible);
    if (!all.length) continue;
    const wdSet = new Set(figuresIn(row.withdrawn).map(f => f.tok));
    const ph = (phByLine.get(row.n) || []).slice();
    const cited = CITE.test(decode(row.visible));
    for (const f of all) {
      if (ALLOW.some(a => a.re.test(f.tok) && a.ctx.test(row.visible))) continue;
      const pi = ph.indexOf(f.tok);
      if (pi >= 0) { ph.splice(pi, 1); placeholders++; continue; }
      if (wdSet.has(f.tok)) { withdrawn++; continue; }
      if (cited) { traced++; continue; }
      untraced++;
      open.push({ n: row.n, tok: f.tok, ctx: (f.before + '[' + f.tok + ']').replace(/\s+/g, ' ').trim().slice(-70) });
    }
  }
  const denom = traced + untraced;
  return {
    file: rel, traced: traced, untraced: untraced, withdrawn: withdrawn, placeholders: placeholders,
    denom: denom, pct: denom ? +(100 * traced / denom).toFixed(1) : null,
    open: open, bad_strikes: badStrike,
  };
}

function audit() {
  const files = fs.readdirSync(path.join(ROOT, 'web')).filter(f => f.endsWith('.html')).sort();
  const pages = files.map(f => auditFile('web/' + f));
  const traced = pages.reduce((a, p) => a + p.traced, 0);
  const untraced = pages.reduce((a, p) => a + p.untraced, 0);
  const withdrawn = pages.reduce((a, p) => a + p.withdrawn, 0);
  const denom = traced + untraced;
  return {
    generated: new Date().toISOString(),
    by: 'web/figure-audit.js',
    metric: 'fraction of hardcoded figures in visible page text whose source line cites an artifact',
    traced: traced, untraced: untraced, withdrawn: withdrawn, denom: denom,
    placeholders: pages.reduce((a, p) => a + p.placeholders, 0),
    pct: denom ? +(100 * traced / denom).toFixed(1) : null,
    pages: pages,
    bad_strikes: pages.reduce((a, p) => a.concat(p.bad_strikes.map(b => ({ file: p.file, ...b }))), []),
  };
}

module.exports = { audit, auditFile, figuresIn, visibleByLine };

if (require.main === module) {
  const r = audit();
  console.log('WEB FIGURE PROVENANCE — ' + r.metric + '\n');
  for (const p of r.pages) {
    if (!p.denom && !p.withdrawn) { console.log('  ' + p.file.padEnd(22) + '  no figures'); continue; }
    console.log('  ' + p.file.padEnd(22) + '  ' + String(p.pct === null ? '—' : p.pct + '%').padStart(6) +
      '   traced ' + String(p.traced).padStart(3) + ' / ' + String(p.denom).padStart(3) +
      (p.withdrawn ? '   (+' + p.withdrawn + ' withdrawn, out of denominator)' : ''));
  }
  console.log('\n  OVERALL  ' + r.pct + '%   ' + r.traced + ' of ' + r.denom + ' figures cite an artifact' +
    (r.withdrawn ? ';  ' + r.withdrawn + ' struck out as withdrawn' : ''));
  if (r.bad_strikes.length) {
    console.log('\n  ' + r.bad_strikes.length + ' withdrawn-strike(s) with no title — a strike without a reason is not a declaration:');
    for (const b of r.bad_strikes) console.log('    ' + b.file + ':' + b.n + '  ' + b.tag);
  }
  if (process.argv.includes('--list')) {
    console.log('\nUNTRACED, by page:');
    for (const p of r.pages) {
      if (!p.open.length) continue;
      console.log('\n  ' + p.file);
      for (const o of p.open) console.log('    :' + String(o.n).padEnd(5) + o.tok.padEnd(10) + o.ctx);
    }
  }
}
