# -*- coding: utf-8 -*-
"""
bidi.py — keep numbers from being reordered inside RTL (fa/ckb) messages.

The problem
-----------
A Persian or Sorani line is an RTL paragraph containing LTR islands: numbers,
percentages, +/- signs, `$`, tickers, times. The Unicode Bidirectional
Algorithm resolves *neutral* characters — space, comma, dot, `+`, `-`, `%`,
`(`, `[`, `|`, `·` — from whatever surrounds them, so these all break:

    f"{pct:+.2f}٪"                 -> sign ends up on the wrong side
    f"{buy} | {sell}"              -> the two columns swap around the pipe
    f"${p:,.2f} ({ch:+.2f}%)"      -> `$` and the parens drift

The fix
-------
Wrap every LTR island in an isolate, `U+2066 LRI … U+2069 PDI`. An isolate is
self-contained: its inside cannot interact with the text around it, and it
cannot leak outward either (which is why it replaces the older RLM/LRM marks
and the deprecated LRE/RLE embeddings).

Isolates are inert inside LTR text, so the same helpers are safe for the `en`
and `kmr` renderings and no language threading is needed. Only `rtl()`, which
emits U+200F, is direction-specific.

Control characters are written as \\u escapes on purpose: they are invisible
in an editor, and copy-pasting them is how this kind of string gets silently
corrupted.
"""

RLM = "‏"  # RIGHT-TO-LEFT MARK      - pins paragraph direction to RTL
LRI = "⁦"  # LEFT-TO-RIGHT ISOLATE   - open an LTR island
FSI = "⁨"  # FIRST-STRONG ISOLATE    - direction taken from the content
PDI = "⁩"  # POP DIRECTIONAL ISOLATE - close an isolate

MINUS = "−"  # true minus sign; same width as '+', unlike a hyphen
RTL_LANGS = ("fa", "ckb", "ar")


def iso(s) -> str:
    """Isolate one LTR island (number, percent, `$`, ticker, time, URL)."""
    return f"{LRI}{s}{PDI}"


def auto(s) -> str:
    """Isolate a run whose direction depends on its content (mixed names)."""
    return f"{FSI}{s}{PDI}"


def rtl(line: str, lang: str = "fa") -> str:
    """Prefix with RLM for RTL languages, so a leading emoji or digit cannot
    flip the line's direction. A no-op for en/kmr."""
    return (RLM + line) if lang in RTL_LANGS else line


def n(x, decimals: int = 0) -> str:
    """Bare grouped number — no isolate. Use inside `pair()` or `iso()`."""
    return "—" if x is None else f"{x:,.{decimals}f}"


def amount(x, decimals: int = 0) -> str:
    """An isolated amount: ⁦271,153⁩"""
    return "—" if x is None else iso(n(x, decimals))


def pct(p, decimals: int = 2, arrow: str = "") -> str:
    """
    An isolated percentage, written in natural order: ⁦▲ +0.51%⁩

    A Latin `%` rather than `٪` (U+066A): the Persian sign is itself a neutral
    that some fonts place badly, and the isolate already guarantees the
    position. Signs are written forwards — no reversed-string workarounds.
    """
    if p is None:
        return ""
    sign = "+" if p > 0 else (MINUS if p < 0 else "")
    head = f"{arrow} " if arrow else ""
    return iso(f"{head}{sign}{abs(p):.{decimals}f}%")


def usd(x, decimals: int = 2) -> str:
    """An isolated dollar figure: ⁦$3,967.18⁩ — `$` is neutral on its own."""
    return "—" if x is None else iso(f"${n(x, decimals)}")


def pair(a, b, sep: str = " | ", decimals: int = 0, bold_b: bool = False) -> str:
    """
    Two numbers and their separator as ONE isolated run.

    This is what fixes a buy/sell column: the separator lives *inside* the
    isolate, so it can never jump to the other side and take a column with it.
    """
    right = f"<b>{n(b, decimals)}</b>" if bold_b else n(b, decimals)
    return iso(f"{n(a, decimals)}{sep}{right}")


def check(text: str):
    """Return a list of isolate-nesting problems; empty means clean.

    Unbalanced isolates are the bidi bug that renders fine in the one client
    you tested and badly in the next, so this belongs in CI.
    """
    problems, depth = [], 0
    for i, ch in enumerate(text):
        if ch in (LRI, FSI, "⁧"):
            depth += 1
        elif ch == PDI:
            depth -= 1
            if depth < 0:
                problems.append(f"stray PDI at {i}")
                depth = 0
    if depth:
        problems.append(f"{depth} unclosed isolate(s)")
    for bad, name in (("‪", "LRE"), ("‫", "RLE"), ("‬", "PDF")):
        if bad in text:
            problems.append(f"deprecated {name} embedding - use isolates")
    return problems
