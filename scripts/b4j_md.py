# -*- coding: utf-8 -*-
"""Reader and renderer for the "Bitcoin for Juniors" lesson files (content/b4j/<lang>/**.md).

Only the markdown the curriculum really uses is understood: headings, paragraphs (a paragraph that
is only bold, or only italic, is told apart), bullet and numbered lists two levels deep, tables,
links, **bold** and _italic_.  parity() compares a translation with the English file block by block,
so a page can never be built from a translation whose structure has drifted away from the source.
"""
import html
import re

HEAD = re.compile(r"^(#{1,6})\s+(.*)$")
LI = re.compile(r"^(\s*)([*-]|\d+\.)\s+(.*)$")
TBL = re.compile(r"^\s*\|")
BOLD_ONLY = re.compile(r"^\*\*[^*]+\*\*$")
ITAL_ONLY = re.compile(r"^_[^_]+_$")
LINK = re.compile(r"\[([^\]]*)\]\((https?://[^)\s]+)\)")
ITAL = re.compile(r"(?<![\w_])_([^_\n]+)_(?![\w_])")
BOLD = re.compile(r"\*\*(.+?)\*\*")


# ------------------------------------------------------------------ reading
def parse(text):
    """markdown text -> flat list of blocks (dicts with k = h | p | pb | pi | li | tr)"""
    out, para = [], []

    def flush():
        if para:
            t = " ".join(para).strip()
            out.append({"k": "pb" if BOLD_ONLY.match(t) else "pi" if ITAL_ONLY.match(t) else "p", "t": t})
            para.clear()

    for ln in text.replace("\r\n", "\n").split("\n"):
        if not ln.strip():
            flush()
            continue
        m = HEAD.match(ln)
        if m:
            flush()
            out.append({"k": "h", "n": len(m.group(1)), "t": m.group(2).strip()})
            continue
        if TBL.match(ln):
            flush()
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            sep = all(re.fullmatch(r":?-{2,}:?", c) for c in cells)
            out.append({"k": "tr", "cells": cells, "sep": sep})
            continue
        m = LI.match(ln)
        if m:
            flush()
            ind = len(m.group(1).replace("\t", "    "))
            out.append({"k": "li", "lvl": 0 if ind == 0 else (1 if ind < 4 else 2),
                        "o": m.group(2)[0].isdigit(), "t": m.group(3).strip()})
            continue
        para.append(ln.strip())
    flush()
    return out


def kind(b):
    """the structural fingerprint of one block (what must be identical in every language)"""
    k = b["k"]
    if k == "h":
        return f"H{b['n']}"
    if k == "li":
        return f"L{b['lvl']}{'ol' if b['o'] else 'ul'}"
    if k == "tr":
        return "TS" if b["sep"] else f"T{len(b['cells'])}"
    return {"p": "P", "pb": "PB", "pi": "PI"}[k]


def text_of(b):
    return " | ".join(b["cells"]) if b["k"] == "tr" else b["t"]


def parity(en, tr):
    """list of problems; empty = the translation has exactly the structure of the English file"""
    bad = []
    a, b = [kind(x) for x in en], [kind(x) for x in tr]
    if a != b:
        bad.append(f"structure differs: {len(a)} English blocks vs {len(b)}")
        for i in range(max(len(a), len(b))):
            if (a[i] if i < len(a) else None) != (b[i] if i < len(b) else None):
                bad.append(f"first difference at block {i}: {a[i] if i < len(a) else '-'} vs {b[i] if i < len(b) else '-'}")
                break
        return bad
    for i, (x, y) in enumerate(zip(en, tr)):
        tx, ty = text_of(x), text_of(y)
        if tx.count("**") != ty.count("**"):
            bad.append(f"block {i}: ** count differs")
        if [u for _, u in LINK.findall(tx)] != [u for _, u in LINK.findall(ty)]:
            bad.append(f"block {i}: links differ")
    return bad


# ------------------------------------------------------------------ writing
def fmt(s):
    s = html.escape(s, quote=False)
    s = BOLD.sub(r"<strong>\1</strong>", s)
    return ITAL.sub(r"<em>\1</em>", s)


def inline(t, fix=None):
    """one line of markdown -> safe HTML.  fix(url) -> (href, external) lets the caller keep links on the site."""
    keep = []

    def stash(m):
        keep.append((m.group(1), m.group(2)))
        return f"\x00{len(keep) - 1}\x00"

    t = fmt(LINK.sub(stash, t))

    def back(m):
        txt, url = keep[int(m.group(1))]
        href, ext = fix(url) if fix else (url, True)
        rel = ' target="_blank" rel="noopener noreferrer"' if ext else ""
        return f'<a href="{html.escape(href, quote=True)}"{rel}>{fmt(txt)}</a>'

    return re.sub(r"\x00(\d+)\x00", back, t)


def plain(t):
    """markdown -> plain text (for titles, labels and meta descriptions)"""
    return LINK.sub(lambda m: m.group(1), t).replace("**", "").replace("`", "")


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", plain(t).lower()).strip("-")


def render_list(items, fix=None, attrs=None):
    """consecutive li blocks -> nested <ul>/<ol>.  attrs(i) may add attributes/HTML to the i-th item."""
    out, stack = [], []
    for i, it in enumerate(items):
        lvl, tag = it["lvl"], "ol" if it["o"] else "ul"
        while stack and stack[-1][0] > lvl:
            out.append(f"</li></{stack.pop()[1]}>")
        if stack and stack[-1][0] == lvl:
            if stack[-1][1] != tag:
                out.append(f"</li></{stack.pop()[1]}>")
                stack.append((lvl, tag))
                out.append(f"<{tag}>")
            else:
                out.append("</li>")
        else:
            stack.append((lvl, tag))
            out.append(f"<{tag}>")
        pre = attrs(i, it) if attrs else ""
        out.append(f"<li>{pre}{inline(it['t'], fix)}")
    while stack:
        out.append(f"</li></{stack.pop()[1]}>")
    return "".join(out)


def render_table(rows, fix=None):
    head, body = [], []
    seen_sep = False
    for r in rows:
        if r["sep"]:
            seen_sep = True
        elif not seen_sep:
            head.append(r)
        else:
            body.append(r)
    if not seen_sep:                      # no separator row: treat everything as body
        head, body = [], head
    th = "".join("<tr>" + "".join(f"<th>{inline(c, fix)}</th>" for c in r["cells"]) + "</tr>" for r in head)
    tb = "".join("<tr>" + "".join(f"<td>{inline(c, fix)}</td>" for c in r["cells"]) + "</tr>" for r in body)
    return f'<div class="b4j-tw"><table>{"<thead>" + th + "</thead>" if th else ""}<tbody>{tb}</tbody></table></div>'


def head_map(blocks):
    """heading level in the file -> level on the page (the lowest one under the title becomes h2, and so on)"""
    lv = sorted({b["n"] for b in blocks if b["k"] == "h" and b["n"] > 1})
    return {1: 1, **{n: min(2 + i, 6) for i, n in enumerate(lv)}}
