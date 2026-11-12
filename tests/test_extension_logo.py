# -*- coding: utf-8 -*-
"""THE LOGO RULE — set by the site's owner and repeated by him: the extension's logo is NEVER covered.

Two halves, both must pass before a version ships:
  1. the code: the toolbar icon is the logo alone — no badge text, no badge colour, no painted icon
     (the same check scripts/build_extension.py runs before it packages anything);
  2. the popup: rendered in every language, light and dark, with and without the "new version" line, the logo is
     loaded, opaque, whole, the top element at every point of its box, and nothing else overlaps it.

Run:  python3 -m pytest -q tests/test_extension_logo.py      (needs playwright and Google Chrome)
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import ext_harness as H  # noqa: E402


def test_code_never_draws_on_the_icon():
    import build_extension as BE
    assert BE.logo_guard() == [], "THE LOGO RULE is broken in the extension code"


def test_guard_catches_a_badge(tmp_path):
    """the guard itself must notice the mistake it exists for"""
    import build_extension as BE
    (tmp_path / "background.js").write_text("chrome.action.setBadgeText({ text: short(p) });\n", encoding="utf-8")
    (tmp_path / "popup.html").write_text('<header><a class="brand"><img id="logo" src="icons/icon128.png"></a></header>', encoding="utf-8")
    assert BE.logo_guard(str(tmp_path)), "the guard missed a badge with text"
    (tmp_path / "background.js").write_text("chrome.action.setBadgeBackgroundColor({ color: '#f00' });\n", encoding="utf-8")
    assert BE.logo_guard(str(tmp_path)), "the guard missed a badge colour"


@pytest.fixture(scope="module")
def browser():
    pw_api = pytest.importorskip("playwright.sync_api")
    if not os.path.exists(H.CHROME):
        pytest.skip("Google Chrome is not installed")
    srv, base = H.serve()
    with pw_api.sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=H.CHROME, args=["--no-sandbox"])
        yield b, base
        b.close()
    srv.shutdown()


@pytest.mark.parametrize("lang", H.LANGS)
@pytest.mark.parametrize("scheme", ["dark", "light"])
@pytest.mark.parametrize("latest", [None, "9.9.9"])
@pytest.mark.parametrize("wide", [False, True])
def test_popup_logo_is_never_covered(browser, lang, scheme, latest, wide):
    """`wide`: wider type than any font the popup asks for (computers differ) — the header may wrap, never cover"""
    b, base = browser
    ctx = b.new_context(viewport={"width": 380, "height": 600})
    try:
        pg = H.open_popup(ctx, base, lang, latest=latest, scheme=scheme)
        if wide:
            pg.add_style_tag(content="body *{letter-spacing:.05em!important;word-spacing:.1em!important}")
            pg.evaluate("fitHeight()")
            pg.wait_for_timeout(100)
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        for tab in ("market", "report", "alerts", "calc", "posts"):   # the header is the same for every tab; the panes are not
            pg.evaluate(f"document.querySelector('.tabs button[data-tab={tab}]').click()")
            pg.wait_for_timeout(150)
            r = pg.evaluate(H.LOGO_CHECK)
            assert "error" not in r, r
            assert r["problems"] == [], f"[{lang}/{scheme}/{tab}] THE LOGO RULE: {r['problems']}"
            assert r["height"] <= 600, f"[{lang}/{tab}] the popup is {r['height']}px tall; Chrome stops at 600"
            if not wide:
                cut = pg.evaluate("[...document.querySelectorAll('footer a,.lang button,.tabs button')].filter(a => a.scrollWidth > a.clientWidth + 1).map(a => a.textContent)")
                assert not cut, f"[{lang}] labels cut short: {cut}"
        if latest:
            assert pg.evaluate("!document.getElementById('nv').hidden"), "the new-version line did not show"
        assert not errors, errors
    finally:
        ctx.close()
