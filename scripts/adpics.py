"""Pictures that must never be used: other channels' adverts and logos (flagged by the owner).

A picture is recognised by its difference hash (9x8 greyscale gradient), so a resized or recompressed copy of
the same logo still matches. Add the hash of any new advert here; bot_feeds and postimg both check this list.
"""
from io import BytesIO

BLOCKED = (
    0x002A3B3F27370304,   # iamUSD logo (@iamusd)
    0x967071F1E4C4F033,   # NewsCity red cube (@newscitypro)
)
# channels whose every picture (and every linked page's preview) is their own advert: always draw our own card
ART_ONLY = {"newscitypro", "iamusd"}


def dhash(data, n=8):
    from PIL import Image
    im = Image.open(BytesIO(data)).convert("L").resize((n + 1, n), Image.LANCZOS)
    px = list(im.getdata())
    return sum(1 << i for i in range(n * n) if px[(i // n) * (n + 1) + i % n] > px[(i // n) * (n + 1) + i % n + 1])


def is_ad(data):
    try:
        h = dhash(data)
    except Exception:
        return False
    return any(bin(h ^ b).count("1") <= 8 for b in BLOCKED)
