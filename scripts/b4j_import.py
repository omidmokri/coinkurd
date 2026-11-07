# -*- coding: utf-8 -*-
"""Import the English "Bitcoin for Juniors" educator guide from a clone of MyFirstBitcoin/mfb-curriculum
into content/b4j/en/ (the one place the site reads its English text from), and write content/b4j/SOURCE.json.

Only small formatting repairs are applied; every repair is asserted (it must match exactly once), so the
script fails loudly if the upstream text changes underneath it.  Nothing else about the text is altered.

usage:  python3 -I scripts/b4j_import.py <clone-of-mfb-curriculum> [<out-dir = content/b4j>]
(run with -I: the clone is untrusted data, so Python must not import anything from its folders)
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

CLONE = sys.argv[1]
OUT_ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "content", "b4j")
FOLDER = "programs/bitcoin-for-juniors/educator-guide/en"
SRC = os.path.join(CLONE, FOLDER)
OUT = os.path.join(OUT_ROOT, "en")

MAP = [
    # (source path, output path)
    ("0-front-matter/foreword.md", "front/foreword.md"),
    ("0-front-matter/introduction.md", "front/how-to-use.md"),
    ("0-front-matter/a-parent-guide-to-bitcoin-for-juniors.md", "front/parent-guide.md"),
    ("0-front-matter/faq.md", "front/faq.md"),
    ("1-exchange-value-and-price/1-overview.md", "m1/1.1-overview.md"),
    ("1-exchange-value-and-price/2-going-going-gone.md", "m1/1.2-going-going-gone.md"),
    ("1-exchange-value-and-price/3-what-is-value.md", "m1/1.3-what-is-value.md"),
    ("1-exchange-value-and-price/1-ship-rekt.md", "m1/1.4-ship-rekt.md"),
    ("1-exchange-value-and-price/4-worth-it.md", "m1/1.5-worth-it.md"),
    ("2-time-energy-and-reward/1-overview.md", "m2/2.1-overview.md"),
    ("2-time-energy-and-reward/1-work-rest-and-play.md", "m2/2.2-work-rest-and-play.md"),
    ("2-time-energy-and-reward/2-energy-economy.md", "m2/2.3-energy-economy.md"),
    ("2-time-energy-and-reward/3-that-s-not-fair.md", "m2/2.4-thats-not-fair.md"),
    ("2-time-energy-and-reward/4-that-s-not-fair-story-time.md", "m2/2.5-thats-not-fair-story-time.md"),
    ("2-time-energy-and-reward/5-time-preference.md", "m2/2.6-time-preference.md"),
    ("2-time-energy-and-reward/6-smart-choices.md", "m2/2.7-smart-choices.md"),
    ("3-analog-vs-digital/1-overview.md", "m3/3.1-overview.md"),
    ("3-analog-vs-digital/1-evolution-of-technology.md", "m3/3.2-back-in-my-day.md"),
    ("3-analog-vs-digital/2-vote-with-your-feet.md", "m3/3.3-vote-with-your-feet.md"),
    ("3-analog-vs-digital/3-invent-the-future.md", "m3/3.4-invent-the-future.md"),
    ("4-safety-security-and-privacy/1-overview.md", "m4/4.1-overview.md"),
    ("4-safety-security-and-privacy/1-gatekeepers.md", "m4/4.2-gatekeepers.md"),
    ("4-safety-security-and-privacy/2-wire-tap.md", "m4/4.3-wire-tap.md"),
    ("4-safety-security-and-privacy/3-cypherpunks-write-code.md", "m4/4.4-cypherpunks-write-code.md"),
    ("4-safety-security-and-privacy/4-nostr.md", "m4/4.5-nostr.md"),
    ("5-money-matters/1-overview.md", "m5/5.1-overview.md"),
    ("5-money-matters/1-money-matters.md", "m5/5.2-money-matters.md"),
    ("6-bitcoin-basics/1-overview.md", "m6/6.1-overview.md"),
    ("6-bitcoin-basics/1-from-problem-to-protocol.md", "m6/6.2-from-problem-to-protocol.md"),
    ("6-bitcoin-basics/2-satoshi-where-are-you.md", "m6/6.3-satoshi-where-are-you.md"),
    ("6-bitcoin-basics/3-it-s-mine.md", "m6/6.4-its-mine.md"),
]

# ---- repairs: (output path) -> list of (old, new). Each `old` must occur exactly once.
FIX = {
    "front/parent-guide.md": [
        ("https://github.com/MyFirstBitcoin/curriculum/tree/main/programs/bitcoin-for-juniors/en",
         "https://github.com/MyFirstBitcoin/mfb-curriculum/tree/main/programs/bitcoin-for-juniors/educator-guide/en"),
    ],
    "m1/1.2-going-going-gone.md": [
        ("1. Ask:\n1. Which items were most expensive? Why?\n1. Were some things not worth much? Why?\n"
         "1. Did everyone want the same things?\n1. Did anyone run out of shells too quickly?\n",
         "1. Ask:\n   * Which items were most expensive? Why?\n   * Were some things not worth much? Why?\n"
         "   * Did everyone want the same things?\n   * Did anyone run out of shells too quickly?\n"),
    ],
    "m1/1.3-what-is-value.md": [
        ("1. Define:\n1. **Price**: how much something costs\n1. **Value**: how useful or important something is\n",
         "1. Define:\n   * **Price**: how much something costs\n   * **Value**: how useful or important something is\n"),
    ],
    "m4/4.5-nostr.md": [
        (" ### Pre-requisites\n", "\n"),
        ("#### Notes\n\n* 4.3 - Telephone\n* 4.4 - Cypherpunks Write Code\n",
         "#### Notes\n\n**Pre-requisites**\n\n* 4.3 - Telephone\n* 4.4 - Cypherpunks Write Code\n"),
    ],
    "m5/5.2-money-matters.md": [
        ("1.  HOME TILE SETUP (10 minutes)\n\nEach learner:\n\n1. Receives a HOME tile",
         "**1. HOME TILE SETUP (10 minutes)**\n\nEach learner:\n\n1. Receives a HOME tile"),
        ("1. STATION INTRODUCTIONS (35 minutes)\n\nStations are introduced one by one:\n\n"
         "1. Home\n1. Farm\n1. Factory\n1. Market\n1. Bank\n",
         "**2. STATION INTRODUCTIONS (35 minutes)**\n\nStations are introduced one by one:\n\n"
         "* Home\n* Farm\n* Factory\n* Market\n* Bank\n"),
    ],
    "m6/6.4-its-mine.md": [
        ("##### Step 1: Set up the lesson\n\n1. Briefly review",
         "##### Step 1: Set up the lesson\n\n**5 minutes**\n\n1. Briefly review"),
        ("before earning words.\n\n**5 minutes**\n\n1. Lay out 20 playing cards",
         "before earning words.\n1. Lay out 20 playing cards"),
    ],
}


def clean(txt):
    txt = txt.replace("\r\n", "\n").replace(" ", " ")
    txt = re.sub(r"^(\s*[*-]) {2,}", r"\1 ", txt, flags=re.M)      # '*  “x”' -> '* “x”'
    txt = re.sub(r"[ \t]+$", "", txt, flags=re.M)
    txt = re.sub(r"\n{3,}", "\n\n", txt)
    return txt.strip("\n") + "\n"



LEX_LINK = re.compile(r"https://curriculum\.myfirstbitcoin\.org/lexicon/en/#([\w-]+)")


def modules_md():
    """the six module names, in order, from the bold entries of the guide's own README table"""
    readme = open(os.path.join(SRC, "README.md"), encoding="utf-8").read()
    names = re.findall(r"^\| \*\*\[([^\]]+)\]\(", readme, flags=re.M)
    assert len(names) == 6, names
    return "# Modules\n\n" + "".join(f"1. {n}\n" for n in names)


def glossary_md(texts):
    """the lexicon entries that the guide links to, in the lexicon's own (alphabetical) order"""
    wanted = {m for t in texts for m in LEX_LINK.findall(t)}
    lex = open(os.path.join(CLONE, "lexicon", "en.md"), encoding="utf-8").read()
    parts = re.split(r"^## ", lex, flags=re.M)[1:]
    out, found = [], set()
    for p in parts:
        title, _, rest = p.partition("\n")
        m = re.match(r"\s*<!-- term: ([\w-]+) -->\n", rest)
        if m and m.group(1) in wanted:
            found.add(m.group(1))
            out.append("## " + title.strip() + "\n\n" + clean(rest[m.end():]).strip() + "\n")
    assert found == wanted, f"terms linked but not found in the lexicon: {wanted - found}"
    return "# Key terms\n\n" + "\n".join(out)


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    files, texts = {}, []
    for src, dst in MAP:
        raw = open(os.path.join(SRC, src), encoding="utf-8").read()
        txt = clean(raw)
        for old, new in FIX.get(dst, []):
            n = txt.count(old)
            assert n == 1, f"{dst}: expected exactly one match, found {n}: {old[:50]!r}"
            txt = txt.replace(old, new)
        os.makedirs(os.path.dirname(os.path.join(OUT, dst)), exist_ok=True)
        open(os.path.join(OUT, dst), "w", encoding="utf-8").write(txt)
        texts.append(txt)
        files[dst] = {"src": src, "sha256": hashlib.sha256(raw.encode("utf-8")).hexdigest(), "words": len(txt.split())}
    for dst, txt in (("front/modules.md", modules_md()), ("front/glossary.md", glossary_md(texts))):
        open(os.path.join(OUT, dst), "w", encoding="utf-8").write(txt)
    sync = json.load(open(os.path.join(CLONE, ".mfb-sync.json"), encoding="utf-8"))
    git = lambda *a: subprocess.run(["git", "-C", CLONE, *a], capture_output=True, text=True, check=True).stdout.strip()
    info = {"repo": "https://github.com/MyFirstBitcoin/mfb-curriculum", "folder": FOLDER,
            "commit": git("rev-parse", "HEAD"), "commit_date": git("log", "-1", "--format=%cs"),
            "release": sync.get("release", ""), "retrieved": os.environ.get("B4J_RETRIEVED", ""),
            "licence": "CC BY-SA 4.0", "licence_url": "https://creativecommons.org/licenses/by-sa/4.0/",
            "files": files}
    json.dump(info, open(os.path.join(OUT_ROOT, "SOURCE.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    for dst, f in files.items():
        print(f"{dst:46s} <- {f['src']}  sha256:{f['sha256'][:12]}  {f['words']} words")
    print("files:", len(files) + 2, " words:", sum(f["words"] for f in files.values()))


main()
