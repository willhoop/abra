/* md_to_pdf.js — Markdown -> styled HTML -> PDF, with no Python and no external toolchain.
 *
 * WHY THIS EXISTS. build/omnibus.py renders the document set via weasyprint. weasyprint is not
 * installed, pandoc is not installed, and wkhtmltopdf is not installed — so as of 2026-07-25 the
 * project could not produce a PDF of anything on the author's own machine. Chrome and Edge are both
 * present and both print headlessly, which needs nothing installed at all.
 *
 * Deliberately dependency-free: a renderer that needs `npm install` to print a document is the same
 * class of problem it is solving.
 *
 *   node build/md_to_pdf.js docs/REVIEW-2026-07-25.md            -> docs/REVIEW-2026-07-25.pdf
 *   node build/md_to_pdf.js <in.md> [out.pdf] [--html-only]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const IN = process.argv[2];
if (!IN) { console.error('usage: node build/md_to_pdf.js <file.md> [out.pdf] [--html-only]'); process.exit(2); }
const OUT = (process.argv[3] && !process.argv[3].startsWith('--')) ? process.argv[3] : IN.replace(/\.md$/, '.pdf');
const HTML_ONLY = process.argv.includes('--html-only');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Inline: code first, so a backtick span cannot be re-processed for bold or links. */
function inline(s) {
  const code = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { code.push(c); return `\u0000${code.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(code[+i])}</code>`);
  return s;
}

function render(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const L = lines[i];

    if (/^```/.test(L)) {                                   // fenced code
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*\|/.test(L) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {   // table
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(L); i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(cells(lines[i++]));
      out.push('<table><thead><tr>' + head.map(h => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    const h = L.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(L)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(L)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(L)) {
      const ordered = /^\s*\d+\./.test(L);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          items[items.length - 1] += ' ' + lines[i++].trim();
        }
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>` + items.map(t => `<li>${inline(t)}</li>`).join('') + `</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (!L.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|```|\s*\||\s*>)/.test(lines[i])) buf.push(lines[i++]);
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
    else i++;
  }
  return out.join('\n');
}

const title = path.basename(IN, '.md');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { size: A4; margin: 14mm 13mm; }
body { font: 10.5pt/1.5 Georgia,"Times New Roman",serif; color:#15181f; max-width:none; }
h1 { font-size:20pt; border-bottom:2px solid #15181f; padding-bottom:5px; margin:0 0 14px; page-break-after:avoid; }
h2 { font-size:14.5pt; margin:16px 0 6px; border-bottom:1px solid #b9c0cc; padding-bottom:3px; page-break-after:avoid; }
h3 { font-size:11pt; margin:11px 0 4px; page-break-after:avoid; }
h4 { font-size:10.5pt; margin:12px 0 4px; page-break-after:avoid; }
p { margin:0 0 7px; text-align:left; orphans:3; widows:3; }
table { border-collapse:collapse; width:100%; margin:8px 0; font-size:8.6pt; }
table, tr, td, th { page-break-inside:auto; }
thead { display:table-header-group; }
th,td { border:1px solid #c3c9d4; padding:2px 6px; text-align:left; vertical-align:top; }
th { background:#eef1f6; font-weight:700; }
code { font:9pt/1.4 "Consolas","Courier New",monospace; background:#f0f2f6; padding:1px 4px; border-radius:3px; }
pre { background:#f5f6fa; border:1px solid #d5dae3; border-left:3px solid #6b7688; padding:9px 11px;
      overflow-x:auto; page-break-inside:avoid; margin:9px 0; }
pre code { background:none; padding:0; font-size:8.6pt; }
blockquote { margin:9px 0; padding:2px 0 2px 13px; border-left:3px solid #b9c0cc; color:#3d4553; font-style:italic; }
ul,ol { margin:0 0 9px; padding-left:22px; } li { margin:2px 0; }
hr { border:0; border-top:1px solid #c3c9d4; margin:14px 0; }
a { color:#1a4f9c; text-decoration:none; }
strong { color:#000; }
</style></head><body>
${render(fs.readFileSync(IN, 'utf8'))}
</body></html>`;

const tmpHtml = OUT.replace(/\.pdf$/, '') + '.print.html';
fs.writeFileSync(tmpHtml, html);
if (HTML_ONLY) { console.log(`wrote ${tmpHtml}`); process.exit(0); }

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const browser = BROWSERS.find(b => fs.existsSync(b));
if (!browser) {
  console.error(`no Chrome or Edge found; wrote ${tmpHtml} — open it and print to PDF`);
  process.exit(1);
}
execFileSync(browser, [
  '--headless', '--disable-gpu', '--no-pdf-header-footer',
  `--print-to-pdf=${path.resolve(OUT)}`,
  'file:///' + path.resolve(tmpHtml).replace(/\\/g, '/'),
], { stdio: 'ignore', timeout: 120000 });
fs.unlinkSync(tmpHtml);
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB) via ${path.basename(browser)}`);
