/* ورودی صوتی ژورنال — صدا را در مرورگر به متن تبدیل می‌کند و در فیلد «یادداشت» می‌نویسد.
   از Web Speech API خود مرورگر استفاده می‌شود؛ نه کلیدی لازم است نه سروری.
   توجه: در کروم، صدای ضبط‌شده برای تبدیل به متن به سرویس گفتار گوگل می‌رود. متن و خود ژورنال
   مثل بقیهٔ این صفحه در مرورگر شما می‌مانند و جایی فرستاده نمی‌شوند. */
(function () {
  "use strict";
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var LANGS = [["fa-IR", "فارسی"], ["ar-IQ", "کوردی / عربی"], ["en-US", "English"]];
  var rec = null, on = false, base = "";

  function el(tag, cls, html) {
    var x = document.createElement(tag);
    if (cls) x.className = cls;
    if (html != null) x.innerHTML = html;
    return x;
  }

  function mount() {
    var note = document.getElementById("j_note");
    var bar = document.querySelector("#psJAdd") && document.querySelector("#psJAdd").parentNode;
    if (!note || !bar || document.getElementById("psVoice")) return false;

    var wrap = el("span", "ps-voice");
    wrap.id = "psVoice";
    if (!SR) {
      wrap.appendChild(el("span", "note", "🎙 ورودی صوتی در این مرورگر پشتیبانی نمی‌شود — کروم یا اج را امتحان کنید."));
      bar.appendChild(wrap);
      return true;
    }
    var btn = el("button", "ac-btn ghost", "🎙 گفتن به‌جای نوشتن");
    btn.type = "button";
    btn.id = "psVoiceBtn";
    var sel = el("select", "ps-voice-lang");
    sel.innerHTML = LANGS.map(function (l) { return '<option value="' + l[0] + '">' + l[1] + "</option>"; }).join("");
    try { sel.value = localStorage.getItem("ps_voice_lang") || "fa-IR"; } catch (e) {}
    sel.onchange = function () { try { localStorage.setItem("ps_voice_lang", sel.value); } catch (e) {} };
    var msg = el("span", "note ps-voice-msg", "");
    wrap.appendChild(btn); wrap.appendChild(sel); wrap.appendChild(msg);
    bar.appendChild(wrap);

    var hint = el("p", "note ps-voice-hint",
      "صدا برای تبدیل به متن به سرویس گفتار مرورگر فرستاده می‌شود؛ متن و ژورنال شما مثل بقیهٔ این صفحه در همین مرورگر می‌ماند.");
    bar.parentNode.insertBefore(hint, bar.nextSibling);

    function stop(why) {
      on = false;
      btn.classList.remove("rec");
      btn.innerHTML = "🎙 گفتن به‌جای نوشتن";
      msg.textContent = why || "";
      if (rec) { try { rec.stop(); } catch (e) {} }
    }

    btn.onclick = function () {
      if (on) { stop("ثبت شد"); return; }
      try {
        rec = new SR();
      } catch (e) { stop("ورودی صوتی در دسترس نیست"); return; }
      rec.lang = sel.value;
      rec.continuous = true;
      rec.interimResults = true;
      base = note.value ? note.value.replace(/\s+$/, "") + " " : "";
      rec.onstart = function () {
        on = true;
        btn.classList.add("rec");
        btn.innerHTML = "⏹ پایان و ثبت";
        msg.textContent = "در حال شنیدن…";
      };
      rec.onresult = function (ev) {
        var done = "", live = "";
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) done += t + " "; else live += t;
        }
        if (done) base += done;
        note.value = (base + live).replace(/\s+/g, " ").trim();
        note.dispatchEvent(new Event("input", { bubbles: true }));
      };
      rec.onerror = function (ev) {
        stop(ev.error === "not-allowed" ? "اجازهٔ میکروفون داده نشد" :
             ev.error === "no-speech" ? "صدایی شنیده نشد" : "خطا: " + ev.error);
      };
      rec.onend = function () { if (on) stop("ثبت شد"); };
      try { rec.start(); } catch (e) { stop("یک بار دیگر امتحان کنید"); }
    };
    return true;
  }

  function wait() {
    if (mount()) return;
    var n = 0, t = setInterval(function () { if (mount() || ++n > 40) clearInterval(t); }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait); else wait();
})();
