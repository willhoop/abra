/* md2pdf.js -- render a project doc to a printable PDF.
 *
 *   node tools/md2pdf.js docs/MILTANK.md docs/MILTANK.html
 *   chrome --headless --no-pdf-header-footer --print-to-pdf=docs/MILTANK.pdf file:///.../docs/MILTANK.html
 *
 * Lives here rather than in a scratch directory because a PDF nobody can regenerate is a dead end:
 * the .md is the source, this is how it becomes the .pdf, and both belong beside the doc.
 *
 * Minimal markdown -> printable HTML. Handles exactly the constructs the docs use:
 * document uses: headings, tables, fenced/inline code, links, bold/italic, lists, rules,
 * blockquotes. Not a general converter and does not pretend to be one. */
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const out = [];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

const lines = src.split(/\r?\n/);
let i = 0, inList = false;
const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
while (i < lines.length) {
  const L = lines[i];
  if (/^\s*\|/.test(L) && /^\s*\|/.test(lines[i + 1] || '') && /-{2,}/.test(lines[i + 1])) {
    closeList();
    const head = L.split('|').slice(1, -1).map(c => c.trim());
    i += 2;
    const rows = [];
    while (i < lines.length && /^\s*\|/.test(lines[i])) {
      rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim())); i++;
    }
    out.push('<table><thead><tr>' + head.map(h => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>');
    for (const r of rows) out.push('<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>');
    out.push('</tbody></table>');
    continue;
  }
  const h = /^(#{1,6})\s+(.*)$/.exec(L);
  if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
  if (/^---+\s*$/.test(L)) { closeList(); out.push('<hr>'); i++; continue; }
  if (/^>\s?/.test(L)) {
    closeList(); const buf = [];
    while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
    out.push('<blockquote>' + inline(buf.join(' ')) + '</blockquote>'); continue;
  }
  const li = /^\s*[-*]\s+(.*)$/.exec(L);
  if (li) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inline(li[1]) + '</li>'); i++; continue; }
  const ol = /^\s*(\d+)\.\s+(.*)$/.exec(L);
  if (ol) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inline(ol[2]) + '</li>'); i++; continue; }
  if (!L.trim()) { closeList(); i++; continue; }
  const buf = [];
  while (i < lines.length && lines[i].trim() && !/^[#>|-]/.test(lines[i]) && !/^\s*[-*]\s/.test(lines[i])) {
    buf.push(lines[i]); i++;
  }
  if (buf.length) out.push('<p>' + inline(buf.join(' ')) + '</p>'); else i++;
}
closeList();

const css = `
@page { size: A4; margin: 18mm 16mm; }
body { font: 10.5pt/1.55 "Segoe UI", -apple-system, sans-serif; color: #1a1a1a; }
h1 { font-size: 22pt; margin: 0 0 4pt; letter-spacing: -0.4pt; }
h1 + p em { color: #666; }
h2 { font-size: 14pt; margin: 20pt 0 6pt; padding-bottom: 3pt; border-bottom: 1.5px solid #d94f2b; }
h3 { font-size: 11.5pt; margin: 14pt 0 4pt; color: #b03d1f; }
p { margin: 0 0 7pt; }
code { font: 9.2pt "Cascadia Mono", Consolas, monospace; background: #f4f2ef; padding: 1px 4px; border-radius: 3px; }
a { color: #b03d1f; text-decoration: none; border-bottom: 0.5px solid #e0b8ac; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 9.5pt; page-break-inside: avoid; }
th { background: #f4f2ef; text-align: left; padding: 5pt 7pt; border-bottom: 1.5px solid #d0c8c0; font-weight: 600; }
td { padding: 5pt 7pt; border-bottom: 0.5px solid #e8e4e0; vertical-align: top; }
blockquote { margin: 9pt 0; padding: 7pt 12pt; background: #faf7f4; border-left: 3px solid #d94f2b; font-style: italic; }
ul { margin: 0 0 8pt; padding-left: 18pt; }
li { margin-bottom: 3pt; }
hr { border: 0; border-top: 0.5px solid #ddd; margin: 16pt 0; }
h2, h3 { page-break-after: avoid; }
`;
fs.writeFileSync(process.argv[3],
  '<!doctype html><meta charset="utf-8"><title>MILTANK</title><style>' + css + '</style>' + out.join('\n'));
console.log('wrote ' + process.argv[3]);
