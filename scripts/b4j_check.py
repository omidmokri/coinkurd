# -*- coding: utf-8 -*-
"""Structure + hygiene checker for the translations of the Bitcoin for Juniors markdown (content/b4j/).

usage: python3 -I scripts/b4j_check.py <fa|ckb|en> [relative/file.md ...]     (default: every file under content/b4j/en/)
Compares content/b4j/en/<f> with content/b4j/<lang>/<f> block by block and reports:
  ERROR  = the translation is structurally wrong (must be fixed; the exit code is 1)
  WARN   = suspicious, please look
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "content", "b4j")
LANG = sys.argv[1]
ARGS = sys.argv[2:]

DIG = {**{chr(0x06F0 + i): str(i) for i in range(10)}, **{chr(0x0660 + i): str(i) for i in range(10)}}


def ascii_digits(s):
    return "".join(DIG.get(c, c) for c in s)


HEAD = re.compile(r"^(#{1,6})\s+(.*)$")
LI = re.compile(r"^(\s*)([*-]|\d+\.)\s+(.*)$")
TBL = re.compile(r"^\s*\|")
BOLD_ONLY = re.compile(r"^\*\*[^*]+\*\*$")
ITAL_ONLY = re.compile(r"^_[^_]+_$")
LINK = re.compile(r"\[([^\]]*)\]\((https?://[^)\s]+)\)")
ITAL = re.compile(r"(?<![\w_])_[^_\n]+_(?![\w_])")


def blocks(text):
    out, para = [], []

    def flush():
        if para:
            t = " ".join(para).strip()
            kind = "PB" if BOLD_ONLY.match(t) else "PI" if ITAL_ONLY.match(t) else "P"
            out.append((kind, t))
            para.clear()

    for ln in text.split("\n"):
        if not ln.strip():
            flush()
            continue
        m = HEAD.match(ln)
        if m:
            flush()
            out.append((f"H{len(m.group(1))}", m.group(2).strip()))
            continue
        if TBL.match(ln):
            flush()
            cells = [c for c in ln.strip().strip("|").split("|")]
            sep = all(re.fullmatch(r"\s*:?-{2,}:?\s*", c) for c in cells)
            out.append(("TS" if sep else f"T{len(cells)}", ln.strip()))
            continue
        m = LI.match(ln)
        if m:
            flush()
            ind = len(m.group(1).replace("\t", "    "))
            lvl = 0 if ind == 0 else (1 if ind < 4 else 2)
            kind = "ol" if m.group(2)[0].isdigit() else "ul"
            out.append((f"L{lvl}{kind}", m.group(3).strip()))
            continue
        para.append(ln.strip())
    flush()
    return out


def strip_md(s):
    s = LINK.sub(lambda m: m.group(1), s)
    return s.replace("**", "").replace("`", "")


def numbers(text):
    t = ascii_digits(LINK.sub(lambda m: m.group(1), text))
    return re.findall(r"\d+(?:[.,٫]\d+)?", t)


def latin_ratio(s):
    s = re.sub(r"https?://\S+", "", strip_md(s))
    letters = [c for c in s if c.isalpha()]
    if len(letters) < 8:
        return 0.0
    lat = [c for c in letters if "a" <= c.lower() <= "z"]
    return len(lat) / len(letters)


KU_ONLY = set("ەێۆڵڕڤ")
BAD_COMMON = set("كيةھۃ")                    # Arabic-form k/y/ta-marbuta/heh-doachashmee: the site writes ک ی ه
FA_WORDS = ["است", "که", "را", "برای", "می‌", "نمی‌", "شود", "کنید", "خواهد", "دارد", "هستند", "این", "آن", "نیز"]


def check(rel):
    errs, warns = [], []
    en = open(os.path.join(ROOT, "en", rel), encoding="utf-8").read()
    p = os.path.join(ROOT, LANG, rel)
    if not os.path.exists(p):
        return [f"missing file {LANG}/{rel}"], []
    tr = open(p, encoding="utf-8").read()
    if "‌‌" in tr:
        warns.append("double ZWNJ")
    be, bt = blocks(en), blocks(tr)
    ske, skt = [b[0] for b in be], [b[0] for b in bt]
    if ske != skt:
        errs.append(f"block structure differs: en has {len(ske)} blocks, {LANG} has {len(skt)}")
        n = 0
        for i in range(max(len(ske), len(skt))):
            a = ske[i] if i < len(ske) else "-"
            b = skt[i] if i < len(skt) else "-"
            if a != b:
                ctx_en = be[i][1][:70] if i < len(be) else ""
                ctx_tr = bt[i][1][:70] if i < len(bt) else ""
                errs.append(f"   first difference at block #{i}: en={a} «{ctx_en}»  vs  {LANG}={b} «{ctx_tr}»")
                break
    else:
        for i, ((ke, te), (kt, tt)) in enumerate(zip(be, bt)):
            if te.count("**") != tt.count("**"):
                errs.append(f"block #{i} ({ke}): number of ** differs ({te.count('**')} vs {tt.count('**')}): «{tt[:60]}»")
            if len(LINK.findall(te)) != len(LINK.findall(tt)):
                errs.append(f"block #{i} ({ke}): number of links differs: «{tt[:60]}»")
            if len(ITAL.findall(te)) != len(ITAL.findall(tt)):
                warns.append(f"block #{i} ({ke}): italic _x_ count differs: «{tt[:60]}»")
    ue, ut = [u for _, u in LINK.findall(en)], [u for _, u in LINK.findall(tr)]
    if ue != ut:
        errs.append(f"link URLs differ or are reordered: en={ue} {LANG}={ut}")
    ne, nt = numbers(en), numbers(tr)
    from collections import Counter
    ce, ct = Counter(ne), Counter(nt)
    miss = [f"{k}x{v - ct.get(k, 0)}" for k, v in ce.items() if ct.get(k, 0) < v]
    if miss and LANG != "en":
        errs.append("numbers present in English but missing in translation: " + ", ".join(miss))
    if LANG == "en":
        return errs, warns
    body = re.sub(r"https?://\S+", "", tr)
    if any(c in body for c in BAD_COMMON):
        bad = sorted({c for c in body if c in BAD_COMMON})
        errs.append("forbidden Arabic-form letters (use ک ی ه): " + " ".join(f"U+{ord(c):04X}" for c in bad))
    if re.search(r"[0-9]", body):
        warns.append("ASCII digits in prose: " + ", ".join(sorted(set(re.findall(r"\S*[0-9]\S*", body)))[:8]))
    if LANG == "fa":
        if any(c in KU_ONLY for c in body):
            errs.append("Kurdish-only letters in the Persian text: " + "".join(sorted({c for c in body if c in KU_ONLY})))
        if re.search("[٠-٩]", body):
            errs.append("Arabic-Indic digits in Persian text (use ۰-۹)")
    if LANG == "ckb":
        if re.search("[۰-۹]", body):
            errs.append("Persian digits in Kurdish text (use ٠-٩)")
        letters = [c for c in body if "؀" <= c <= "ۿ" and c.isalpha()]
        ku = sum(1 for c in letters if c in KU_ONLY)
        if letters and ku / len(letters) < 0.05:
            warns.append(f"very few Kurdish letters ({ku}/{len(letters)}): is this really Sorani?")
        words = re.findall(r"[\w‌]+", body)
        hits = {w: words.count(w) for w in FA_WORDS if words.count(w)}
        if hits:
            warns.append("Persian function words in the Kurdish text: " + ", ".join(f"{w}×{c}" for w, c in hits.items()))
    for i, (k, t) in enumerate(bt):
        if k.startswith("T") or k == "TS":
            continue
        r = latin_ratio(t)
        if r > 0.5 and len(t) > 25:
            warns.append(f"block #{i} looks untranslated ({int(r*100)}% Latin): «{t[:70]}»")
    if re.search(r"(?<![A-Za-z0-9])[?;](?![A-Za-z0-9/=&])", re.sub(r"https?://\S+", "", re.sub(r"[A-Za-z][A-Za-z ,.'’\-]*[?]", "", body))):
        warns.append("Latin ? or ; used in prose (use ؟ ؛)")
    if re.search(r"[“”\"]", body):
        warns.append("English quotation marks in prose (use « »)")
    return errs, warns


def main():
    files = ARGS or sorted(os.path.relpath(os.path.join(d, f), os.path.join(ROOT, "en"))
                           for d, _, fs in os.walk(os.path.join(ROOT, "en")) for f in fs if f.endswith(".md"))
    bad = 0
    for rel in files:
        errs, warns = check(rel)
        tag = "OK " if not errs else "ERR"
        print(f"{tag} {rel}  ({len(errs)} errors, {len(warns)} warnings)")
        for x in errs:
            print("   ERROR", x)
        for x in warns:
            print("   warn ", x)
        bad += bool(errs)
    print(f"-- {len(files)} files, {bad} with errors")
    sys.exit(1 if bad else 0)


main()
