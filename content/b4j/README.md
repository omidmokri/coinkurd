# content/b4j — "Bitcoin for Juniors" lesson text (fa · ckb · en)

This folder holds the text of the open **Bitcoin for Juniors** educator guide by the non-profit
**My First Bitcoin**, in English (`en/`), Persian (`fa/`) and Central Kurdish / Sorani (`ckb/`).
`scripts/build_kids.py` turns it into the pages under <https://entekhab.net/kids/>.

## Licence and attribution

* Source: <https://github.com/MyFirstBitcoin/mfb-curriculum> (`programs/bitcoin-for-juniors/educator-guide/en`
  and `lexicon/en.md`), commit and release recorded in `SOURCE.json`.
* The source repository says: "Unless stated otherwise, all content in this repository is licensed under
  Creative Commons Attribution–ShareAlike 4.0 International (CC BY-SA 4.0)" and asks users to attribute
  My First Bitcoin and to share derivative works under the same licence.
* **Everything in `content/b4j/` (the English text, its Persian and Sorani translations, `SOURCE.json`) is a copy
  or adaptation of that material and is therefore licensed under CC BY-SA 4.0**
  (<https://creativecommons.org/licenses/by-sa/4.0/>). It is NOT covered by the licence of the rest of this repository.
* Every generated page carries the attribution, the licence link and a pointer to `/kids/about/`, which lists
  what was changed. This translation is unofficial and is not endorsed by My First Bitcoin.

## What was changed (indication of changes, CC BY-SA 4.0 §3(a)(1)(B))

1. `en/`: formatting repairs only, all listed in `scripts/b4j_import.py` (`FIX`) and asserted to match exactly once:
   numbering of nested lists/steps in 1.2, 1.3, 5.2, 6.4; one misplaced time marker (6.4); one malformed
   sub-heading (4.5); one outdated repository link (parent guide). Stray spaces are normalised.
   `front/modules.md` is assembled from the module table of the guide's README; `front/glossary.md` from the lexicon
   entries the guide links to.
2. `fa/`, `ckb/`: translations made by an AI from `en/`, then compared block by block with `en/` by
   `scripts/b4j_check.py` and reviewed by independent AI reviewers. No human translator has approved them.
   If the versions differ, the English text is the reference.

## Rules the translations follow

* Each translated file has exactly the same block skeleton as its English file (headings, paragraphs, list items,
  tables, bold/italic-only lines); the build stops if it does not (`scripts/b4j_md.py: parity`).
* Persian digits in `fa/`, Arabic-Indic digits in `ckb/`; only the letters ک ی ه; « » quotes; ، ؛ ؟.
* Course name: fa «بیت‌کوین برای کودکان», ckb «بیتکۆین بۆ منداڵان»; module = fa «فصل», ckb «بەش».
* Physical labels printed or written on the board (HOME, WALLET, MEMPOOL …) are translated with the English
  original in parentheses at first use.

## Commands

```
python3 -I scripts/b4j_check.py fa          # structure + hygiene check of a translation (also ckb)
python3 scripts/build_kids.py               # build /kids/ (output is not committed; CI builds it)
python3 scripts/kids_check.py               # check the built pages (links, languages, ids, attribution)
# re-import the English text from a fresh clone (never run code from the clone: use -I)
git clone https://github.com/MyFirstBitcoin/mfb-curriculum /tmp/mfb && \
B4J_RETRIEVED=$(date +%F) python3 -I scripts/b4j_import.py /tmp/mfb
```

After a re-import, read the English diff, update `fa/` and `ckb/` file by file and re-run the checks.
