#!/usr/bin/env python3
"""omnibus.py — sew a set of Markdown docs into ONE styled, consecutive PDF.

Reusable across ANY project: give it a manifest (title + ordered sections) and it
produces a single PDF with a cover page, an auto table of contents, and every doc
in order with page breaks between them. Image sections (e.g. an architecture SVG)
are rasterised and embedded.

Usage:
  python omnibus.py manifest.json
  python omnibus.py --title "My Project — Special Cut" --author "Me" \
                    --out out.pdf docA.md docB.md ...

Manifest format (JSON):
{
  "title": "ABRA — The Special Cut",
  "subtitle": "Executive summary, deck, and white papers, in one read",
  "author": "Will Hooper",
  "out": "docs/ABRA-Special-Cut.pdf",
  "note": "optional cover blurb",
  "sections": [
    {"label": "Cheat card",        "file": "docs/MODELS-CHEATSHEET.md"},
    {"label": "How they interact", "file": "docs/architecture-diagram.svg", "kind": "image"},
    {"label": "Executive Summary", "file": "docs/EXECUTIVE-SUMMARY.md"}
  ]
}

Requires: python-markdown, and LibreOffice (`soffice`) on PATH.
Design goal: reproduce this special-cut format for this and all future projects.
"""
import sys, os, json, base64, subprocess, tempfile, argparse, datetime
import markdown

CSS = """
@page { size: Letter; margin: 0.9in; }
* { box-sizing: border-box; }
body { font-family: Georgia,'Times New Roman',serif; font-size: 11.5pt; line-height: 1.55; color:#1a1a1a; }
h1 { font-family:'Segoe UI',Arial,sans-serif; font-size:22pt; color:#1E2761; margin:0 0 2pt; border-bottom:2px solid #1E2761; padding-bottom:6pt; }
h2 { font-family:'Segoe UI',Arial,sans-serif; font-size:15pt; color:#1E2761; margin:18pt 0 6pt; }
h3 { font-family:'Segoe UI',Arial,sans-serif; font-size:12.5pt; color:#333; margin:13pt 0 4pt; font-weight:600; }
p,li { margin:5pt 0; }
strong { color:#111; }
code { font-family:'Consolas',monospace; background:#f2f3f7; padding:1px 4px; border-radius:3px; font-size:10pt; }
pre { background:#f2f3f7; padding:9pt 11pt; border-radius:5px; font-size:9.5pt; line-height:1.4; white-space:pre-wrap; border-left:3px solid #1E2761; }
pre code { background:none; padding:0; }
table { border-collapse:collapse; width:100%; margin:10pt 0; font-size:9.5pt; }
th,td { border:1px solid #d0d3dd; padding:5pt 8pt; text-align:left; vertical-align:top; }
th { background:#1E2761; color:#fff; font-family:'Segoe UI',Arial,sans-serif; }
tr:nth-child(even) td { background:#f6f7fb; }
blockquote { margin:10pt 0; padding:6pt 12pt; background:#f6f7fb; border-left:3px solid #E8B33D; color:#333; font-style:italic; }
hr { border:none; border-top:1px solid #ccc; margin:16pt 0; }
a { color:#1E2761; }
.cover { text-align:center; padding-top:2.4in; }
.cover .big { font-family:'Segoe UI',Arial,sans-serif; font-size:34pt; color:#1E2761; font-weight:800; border:none; }
.cover .sub { font-size:15pt; color:#41597a; margin-top:8pt; }
.cover .meta { font-size:12pt; color:#666; margin-top:26pt; }
.cover .note { font-size:11pt; color:#444; font-style:italic; max-width:5in; margin:22pt auto 0; }
.toc { page-break-before:always; }
.toc h1 { }
.toc ol { font-size:13pt; line-height:2; }
.section { page-break-before:always; }
.divider { font-family:'Segoe UI',Arial,sans-serif; font-size:11pt; color:#E8B33D; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:4pt; }
.imgwrap { text-align:center; page-break-before:always; }
.imgwrap img { max-width:100%; border:1px solid #d0d3dd; border-radius:6px; }
"""

def svg_to_png_datauri(path):
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(['soffice','--headless','--convert-to','png','--outdir',td,path],
                       check=True, capture_output=True, timeout=120)
        png=os.path.join(td, os.path.splitext(os.path.basename(path))[0]+'.png')
        data=base64.b64encode(open(png,'rb').read()).decode()
    return 'data:image/png;base64,'+data

def img_datauri(path):
    ext=os.path.splitext(path)[1].lower()
    if ext=='.svg': return svg_to_png_datauri(path)
    mime={'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','gif':'image/gif'}[ext.lstrip('.')]
    return f'data:{mime};base64,'+base64.b64encode(open(path,'rb').read()).decode()

def render_md(path):
    text=open(path, encoding='utf-8').read()
    return markdown.markdown(text, extensions=['tables','fenced_code','sane_lists'])

def build(manifest, base='.'):
    title=manifest.get('title','Special Cut'); sub=manifest.get('subtitle','')
    author=manifest.get('author',''); note=manifest.get('note','')
    date=datetime.date.today().isoformat()
    sections=manifest['sections']
    P=lambda f: f if os.path.isabs(f) else os.path.join(base,f)

    parts=[f"""<div class="cover"><div class="big">{title}</div>
      <div class="sub">{sub}</div>
      <div class="meta">{author}{' · ' if author else ''}{date}</div>
      <div class="note">{note}</div></div>"""]
    # TOC
    toc="".join(f"<li>{s['label']}</li>" for s in sections)
    parts.append(f'<div class="toc"><h1>Contents</h1><ol>{toc}</ol></div>')
    # sections
    for i,s in enumerate(sections,1):
        label=s['label']; kind=s.get('kind','md'); f=P(s['file'])
        if kind=='image':
            parts.append(f'<div class="imgwrap"><div class="divider">Part {i}</div><h1>{label}</h1><img src="{img_datauri(f)}"></div>')
        else:
            body=render_md(f)
            parts.append(f'<div class="section"><div class="divider">Part {i}</div>{body}</div>')
    doc=f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{''.join(parts)}</body></html>"
    return doc

def to_pdf(html, out):
    with tempfile.TemporaryDirectory() as td:
        htmlp=os.path.join(td,'omnibus.html'); open(htmlp,'w',encoding='utf-8').write(html)
        subprocess.run(['soffice','--headless','--convert-to',
                        'pdf:writer_web_pdf_Export','--outdir',td,htmlp],
                       check=True, capture_output=True, timeout=240)
        gen=os.path.join(td,'omnibus.pdf')
        os.makedirs(os.path.dirname(os.path.abspath(out)),exist_ok=True)
        import shutil; shutil.copy(gen,out)
    return out

if __name__=='__main__':
    if len(sys.argv)==2 and sys.argv[1].endswith('.json'):
        man=json.load(open(sys.argv[1])); base=os.path.dirname(os.path.abspath(sys.argv[1])) or '.'
        # allow manifest paths relative to repo root (parent of build/)
        base=os.getcwd()
        out=man.get('out','omnibus.pdf')
    else:
        ap=argparse.ArgumentParser()
        ap.add_argument('--title',default='Special Cut'); ap.add_argument('--subtitle',default='')
        ap.add_argument('--author',default=''); ap.add_argument('--note',default='')
        ap.add_argument('--out',default='omnibus.pdf'); ap.add_argument('docs',nargs='+')
        a=ap.parse_args()
        man={'title':a.title,'subtitle':a.subtitle,'author':a.author,'note':a.note,'out':a.out,
             'sections':[{'label':os.path.splitext(os.path.basename(d))[0],'file':d,
                          'kind':'image' if d.lower().endswith(('.svg','.png','.jpg','.jpeg','.gif')) else 'md'} for d in a.docs]}
        base=os.getcwd(); out=a.out
    html=build(man, base)
    path=to_pdf(html, out)
    print(f"omnibus -> {path}  ({os.path.getsize(path)//1024} KB, {len(man['sections'])} sections)")
