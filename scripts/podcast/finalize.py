"""Mix, master, tag, subtitle and health-check one or more languages of an episode."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mix  # noqa: E402
import qc  # noqa: E402

ISO = {"fa": "per", "ckb": "ckb", "en": "eng", "ar": "ara", "tr": "tur"}


def finalize(ep, lang, music):
    raw, ch, off, dur = mix.build(ep, lang, music)
    sc = json.load(open(os.path.join(ep, f"script_{lang}.json"), encoding="utf-8"))
    meta = {"title": f"{sc['show']} · {sc['episode_label']} · {sc['date_label']}", "artist": "Coin Kurd · entekhab.net",
            "album": sc["show_full"], "date": sc.get("date", "")[:4], "genre": "Podcast", "language": ISO[lang], "comment": sc["summary"][:250],
            "publisher": "entekhab.net"}
    m = mix.loudnorm(raw, os.path.join(ep, f"podcast_{lang}.wav"), os.path.join(ep, f"podcast_{lang}.mp3"), meta, ch,
                     cover=os.path.join(ep, f"cover_{lang}.jpg"))
    os.remove(raw)
    srt_path, ncues = mix.srt(ep, lang, off)
    health = qc.audio_health(os.path.join(ep, f"podcast_{lang}.mp3"), os.path.join(ep, f"podcast_{lang}.wav"))
    out = {"lang": lang, "chapters": ch, "offsets": off, "duration": round(dur, 2), "srt_cues": ncues, "loudnorm_input": m, "health": health}
    json.dump(out, open(os.path.join(ep, f"mix_{lang}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return out


if __name__ == "__main__":
    ep, music = sys.argv[1], sys.argv[2]
    for lang in sys.argv[3:]:
        o = finalize(ep, lang, music)
        h = o["health"]
        print(lang, f"{h['duration_s']}s {h['size_mb']}MB {h['lufs']}LUFS peak {h['sample_peak_dbfs']} clipped {h['clipped_samples']} "
                    f"chapters {h['chapters']} cover {h['has_cover']} silences {h['silences_over_3s']} srt {o['srt_cues']}")
