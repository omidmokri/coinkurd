"""The trading words each language must use (data/i18n_glossary.json).

Gemini knew the meaning of "short" or "support" but picked a different word for it from one batch to the next, and
Google gave the everyday sense outright. The glossary pins one word a term and a language; the translator is told
only the terms that occur in the strings it is about to translate, so a batch of plain sentences costs nothing.
"""
import json
import os
import re

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "i18n_glossary.json")
_DATA = None


def data():
    global _DATA
    if _DATA is None:
        try:
            with open(PATH, encoding="utf-8") as f:
                _DATA = json.load(f)
        except (OSError, ValueError):
            _DATA = {}
    return _DATA


def version():
    """bumped when the glossary changes: the caches stamped with an older one have their glossary strings re-done"""
    return str(data().get("_version") or "")


def terms():
    return data().get("_terms") or {}


def _rx(term):
    # whole words, an optional plural s, any case: "Longs", "stop-loss" and "stop loss" all count
    t = re.escape(term).replace(r"\ ", r"[\s-]+")
    return re.compile(r"(?<![A-Za-z])" + t + r"(?:s|es)?(?![A-Za-z])", re.I)


_RX = {}


def found(text):
    """the glossary terms that occur in `text`, longest first so "bull market" wins over a bare "bull" """
    out = []
    for t in sorted(terms(), key=len, reverse=True):
        rx = _RX.get(t) or _RX.setdefault(t, _rx(t))
        if rx.search(text):
            out.append(t)
    return out


def lines(code, texts):
    """the prompt's block for one batch: '' when the batch holds no glossary term or the language has no entry"""
    g = data().get(code)
    if not isinstance(g, dict):
        return ""
    blob = "\n".join(texts if isinstance(texts, (list, tuple)) else [str(texts)])
    hits = [t for t in found(blob) if g.get(t)]
    if not hits:
        return ""
    rows = "\n".join(f"  {t} ({terms().get(t, '')}) = {g[t]}" for t in hits)
    return ("- Where an English word below is used in its trading sense, use exactly this word for it (inflect it as "
            "the grammar needs, never a synonym); where it has its everyday sense (a long article, contact support), "
            "translate it normally:\n" + rows + "\n")
