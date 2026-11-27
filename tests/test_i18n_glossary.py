"""The trading-word glossary: every translated language has one, and the translator is given it."""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import i18n_glossary as G  # noqa: E402
import pro_langs  # noqa: E402


def test_every_translated_language_has_every_term():
    d = G.data()
    terms = list(G.terms())
    assert len(terms) >= 40
    want = {r[0] for r in pro_langs.LANGS if r[0] not in pro_langs.SITE}
    have = {k for k in d if not k.startswith("_")}
    assert want == have, (sorted(want - have), sorted(have - want))
    for code in want:
        assert list(d[code]) == terms, code
        assert all(isinstance(v, str) and v.strip() for v in d[code].values()), code


def test_only_the_terms_in_the_batch_are_given():
    assert G.lines("th", ["Hello world"]) == ""
    out = G.lines("th", ["Open a short when support breaks"])
    assert "short" in out and "support" in out and "leverage" not in out
    assert G.lines("fa", ["Open a short"]) == ""          # the site's own languages are written by hand


def test_longest_term_wins_and_plurals_count():
    f = G.found("Bull market ahead; whales and stop-loss orders")
    assert "bull market" in f and "whale" in f and "stop loss" in f


def test_both_translators_carry_the_glossary():
    import i18n_site
    import pro_l10n
    p = i18n_site.prompt_for("gr", ["Set a stop loss"])
    assert G.data()["gr"]["stop loss"] in p and p.index("stop loss (") < p.index("Input:")
    q = pro_l10n.prompt_for("gr", {"a": "Leverage"})
    assert G.data()["gr"]["leverage"] in q


def test_arabic_page_shows_the_arabic_kurdish_line():
    js = open(os.path.join(ROOT, "assets", "i18n.js"), encoding="utf-8").read()
    assert "classList.contains('ek-ar') ? 'ar'" in js
    assert pro_langs.kurd_note("ar")


def test_an_old_cache_queues_its_glossary_strings_once(tmp_path, monkeypatch):
    import i18n_site
    monkeypatch.setattr(i18n_site, "CACHE", str(tmp_path))
    s = {"Open a short": "x", "Hello world": "y", "Max drawdown": "z"}
    (tmp_path / "th.json").write_text(json.dumps({"lang": "th", "s": s, "g": ["Hello world"]}), encoding="utf-8")
    g = i18n_site.load_g("th")
    assert g == {"Hello world", "Open a short", "Max drawdown"}
    g.discard("Open a short")                          # Gemini re-did this one
    i18n_site.save("th", s, g=g)
    d = json.loads((tmp_path / "th.json").read_text(encoding="utf-8"))
    assert d["gv"] == G.version()
    assert i18n_site.load_g("th") == {"Hello world", "Max drawdown"}    # stamped: nothing re-added
    (tmp_path / "fa.json").write_text(json.dumps({"lang": "fa", "s": {"Open a short": "x"}}), encoding="utf-8")
    assert i18n_site.load_g("fa") == set()             # a hand-written language has no glossary
