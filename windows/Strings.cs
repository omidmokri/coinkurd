using System.Collections.Generic;
using System.Globalization;

namespace Entekhab
{
    /// <summary>The few words the app itself says (everything else is the site, in the reader's own language).
    /// Order of the languages everywhere: Kurdish, Persian, Arabic, English.</summary>
    static class S
    {
        public static string Lang = "fa";

        static readonly Dictionary<string, string[]> T = new Dictionary<string, string[]>
        {
            //                       ckb                                   fa                                   ar                                  en
            ["open"]        = new[] { "کردنەوەی ئینتیخاب",                 "باز کردن انتخاب",                   "فتح انتخاب",                       "Open Entekhab" },
            ["reload"]      = new[] { "نوێکردنەوەی پەڕە",                  "بارگذاری دوبارهٔ صفحه",             "إعادة تحميل الصفحة",               "Reload page" },
            ["home"]        = new[] { "پەڕەی سەرەکی",                      "صفحهٔ اصلی",                        "الصفحة الرئيسية",                  "Home page" },
            ["update"]      = new[] { "پشکنینی وەشانی نوێ",                "بررسی نسخهٔ تازه",                  "البحث عن تحديث",                   "Check for updates" },
            ["exit"]        = new[] { "داخستن",                            "خروج",                              "خروج",                             "Exit" },
            ["newTitle"]    = new[] { "وەشانی نوێی ئینتیخاب ئامادەیە",      "نسخهٔ تازهٔ انتخاب آماده است",       "إصدار جديد من انتخاب جاهز",        "A new version of Entekhab is ready" },
            ["newText"]     = new[] { "وەشانی {0} — بۆ داگرتن کلیک بکە.",   "نسخهٔ {0} — برای دریافت کلیک کنید.", "الإصدار {0} — انقر للتنزيل.",       "Version {0} — click to download." },
            ["upToDate"]    = new[] { "ئەم وەشانە نوێترینە.",              "این نسخه تازه‌ترین است.",            "هذا هو أحدث إصدار.",               "You have the latest version." },
            ["noCheck"]     = new[] { "پشکنین سەرکەوتوو نەبوو؛ پاشان هەوڵ بدەرەوە.", "بررسی انجام نشد؛ بعداً دوباره امتحان کنید.", "تعذّر التحقق؛ حاول لاحقًا.", "Could not check right now; try again later." },
            ["offTitle"]    = new[] { "پەیوەندی نییە",                     "اتصال برقرار نیست",                 "لا يوجد اتصال",                    "You are offline" },
            ["retry"]       = new[] { "دووبارە هەوڵ بدە",                  "تلاش دوباره",                       "أعد المحاولة",                     "Try again" },
            ["wv2"]         = new[] {
                "ئینتیخاب پێویستی بە Microsoft Edge WebView2 هەیە، کە لەسەر ئەم کۆمپیوتەرە نییە. ئێستا پەڕەی داگرتنی دەکرێتەوە؛ دوای دامەزراندن، ئینتیخاب دووبارە بکەرەوە.",
                "انتخاب به Microsoft Edge WebView2 نیاز دارد که روی این رایانه نصب نیست. صفحهٔ دریافت آن باز می‌شود؛ پس از نصب، انتخاب را دوباره باز کنید.",
                "يحتاج انتخاب إلى Microsoft Edge WebView2 غير المثبّت على هذا الحاسوب. ستُفتح صفحة تنزيله الآن؛ بعد التثبيت أعد فتح انتخاب.",
                "Entekhab needs Microsoft Edge WebView2, which is not installed on this computer. Its download page opens now; after installing it, open Entekhab again." },
        };

        static int Index(string l) => l == "ckb" ? 0 : l == "ar" ? 2 : l == "en" ? 3 : 1;

        public static string Get(string key) => T.TryGetValue(key, out var v) ? v[Index(Lang)] : key;

        public static bool Rtl => Lang != "en";

        /// <summary>first run: the language Windows speaks, else Persian</summary>
        public static string FromWindows()
        {
            var n = CultureInfo.CurrentUICulture.Name.ToLowerInvariant();
            if (n.StartsWith("ckb") || n.StartsWith("ku")) return "ckb";
            if (n.StartsWith("ar")) return "ar";
            if (n.StartsWith("en")) return "en";
            return "fa";
        }
    }
}
