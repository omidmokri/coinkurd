# The source of `data/library.json`

`data/library.json` powers the "Financial markets library" section on the home page
(`#library` in `index.html`) and the bot screen `bot_learn.library_screen`.

It is **not** generated from an API. Every entry was checked by hand against the source
linked in its `url` field — title, year, author or director, publisher, licence, pricing —
before it was written here. Entries with no verified page carry an empty `url` rather than
a guessed link.

Files:

* `part_film.py`, `part_doc.py`, `part_book.py`, `part_tool.py`, `part_free.py`, `part_bio.py`
  — the entries, one module per category.
* `build.py` — merges them, checks them and writes `data/library.json`.

Rebuild (from the repository root):

    python3 -I scripts/libdata/build.py

`build.py` refuses to write when an entry is missing one of the three languages, has a bad
level or category, a non-https link, an implausible year, Arabic yaa/kaf in Persian or Sorani
text, or the wrong digit set for its language.

Rules for new entries:

* no poster, cover or still from the work itself — the card draws its own cover;
* nothing is hosted here, only a description and a link;
* state the caveat in `note` (dramatised, dated, ideological, exchange-owned, broker-dependent,
  self-reported data) rather than leaving it for the reader to discover;
* `l` ("for a trader") must say something usable, not praise the work.
