using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Entekhab
{
    /// <summary>
    /// The window: https://entekhab.net in Microsoft Edge WebView2, and nothing else inside it.
    ///  • Only entekhab.net (and its subdomains) opens in the window, over HTTPS; every other link — Telegram, YouTube,
    ///    X, exchanges — opens in the person's own browser or app. No JavaScript bridge into Windows, no dev tools.
    ///  • The site's data stays in %LOCALAPPDATA%\Entekhab (settings, alerts and progress survive updates).
    ///  • The tray icon shows the live bitcoin price in its tooltip; the app checks /app/windows.json for new versions.
    ///  • --selftest out.png: loads the site, checks the link rules, saves a picture and a report, exits (used in CI).
    /// </summary>
    sealed class MainForm : Form
    {
        const string Site = "https://entekhab.net/";
        static readonly Color Bg = Color.FromArgb(10, 10, 10);
        static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };

        readonly WebView2 web = new WebView2();
        readonly Panel splash = new Panel();
        readonly NotifyIcon tray = new NotifyIcon();
        readonly Timer ticker = new Timer { Interval = 60_000 };
        readonly string selftest, start;
        readonly string dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Entekhab");
        readonly List<string> external = new List<string>();
        string lastSiteUrl, updateUrl, trayPrice = "";
        bool offlineShown, firstLoadDone, testing;

        public int ExitCode { get; private set; }

        public MainForm(string selftest, string start)
        {
            this.selftest = selftest;
            this.start = start;
            Text = "انتخاب — entekhab.net";
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            BackColor = Bg;
            MinimumSize = new Size(900, 600);
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(1280, 820);

            Directory.CreateDirectory(dataDir);
            LoadSettings();

            web.Dock = DockStyle.Fill;
            web.DefaultBackgroundColor = Bg;
            Controls.Add(web);

            // a calm splash while the first page loads: the logo, whole, on the site's black
            splash.Dock = DockStyle.Fill;
            splash.BackColor = Bg;
            var logo = new PictureBox { SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(132, 132), BackColor = Bg };
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("logo.png")) if (s != null) using (var img = Image.FromStream(s)) logo.Image = new Bitmap(img);   // a copy: GDI+ needs its stream alive otherwise
            var name = new Label { Text = "entekhab.net", ForeColor = Color.FromArgb(168, 164, 156), BackColor = Bg, AutoSize = true, Font = new Font("Segoe UI", 11f) };
            splash.Controls.Add(logo);
            splash.Controls.Add(name);
            splash.Resize += (o, e) =>
            {
                logo.Location = new Point((splash.Width - logo.Width) / 2, (splash.Height - logo.Height) / 2 - 24);
                name.Location = new Point((splash.Width - name.Width) / 2, logo.Bottom + 14);
            };
            Controls.Add(splash);
            splash.BringToFront();

            BuildTray();
            ticker.Tick += async (o, e) => await RefreshPrice();
            Load += async (o, e) => await Init();
            FormClosing += (o, e) => { if (selftest == null) SaveSettings(); tray.Visible = false; tray.Dispose(); };
        }

        protected override void OnHandleCreated(EventArgs e) { base.OnHandleCreated(e); Native.DarkFrame(Handle); }
        protected override void OnShown(EventArgs e) { base.OnShown(e); Native.DarkFrame(Handle); }      // some Windows builds only take it once the window is on screen

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == Native.WM_SHOWME) BringBack();
            base.WndProc(ref m);
        }

        void BringBack()
        {
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Show(); Activate(); BringToFront();
        }

        // ----------------------------------------------------------------------------------------------- the page
        async Task Init()
        {
            string ver = null;
            try { ver = CoreWebView2Environment.GetAvailableBrowserVersionString(); } catch { }
            if (string.IsNullOrEmpty(ver))
            {
                if (selftest != null) { Report("webview2 runtime missing", false); ExitCode = 3; Close(); return; }
                MessageBox.Show(this, S.Get("wv2"), "Entekhab", MessageBoxButtons.OK, MessageBoxIcon.Information,
                    MessageBoxDefaultButton.Button1, S.Rtl ? MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign : (MessageBoxOptions)0);
                OpenExternal("https://developer.microsoft.com/microsoft-edge/webview2/");
                Close();
                return;
            }
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dataDir, "WebView2"));
            await web.EnsureCoreWebView2Async(env);
            var c = web.CoreWebView2;
            c.Settings.UserAgent = c.Settings.UserAgent + " EntekhabWin/" + Program.Version;
            c.Settings.AreDevToolsEnabled = false;
            c.Settings.IsStatusBarEnabled = false;
            c.Settings.IsPasswordAutosaveEnabled = false;
            c.Settings.IsGeneralAutofillEnabled = false;
            c.Settings.IsZoomControlEnabled = true;

            c.NavigationStarting += OnNavigationStarting;
            c.NewWindowRequested += OnNewWindow;
            c.NavigationCompleted += OnNavigationCompleted;
            c.DocumentTitleChanged += (o, e) => { var t = c.DocumentTitle; if (!string.IsNullOrWhiteSpace(t) && !offlineShown) Text = t.Contains("entekhab") ? t : t + " — entekhab.net"; };
            c.WebMessageReceived += (o, e) => { string m = null; try { m = e.TryGetWebMessageAsString(); } catch { } if (m == "retry") c.Navigate(lastSiteUrl ?? Site); };
            c.ProcessFailed += (o, e) => { try { c.Reload(); } catch { } };
            c.PermissionRequested += (o, e) =>
            {
                // the site needs none of these; a window that cannot listen, film or locate is the safer default
                switch (e.PermissionKind)
                {
                    case CoreWebView2PermissionKind.Microphone:
                    case CoreWebView2PermissionKind.Camera:
                    case CoreWebView2PermissionKind.Geolocation:
                    case CoreWebView2PermissionKind.OtherSensors:
                        e.State = CoreWebView2PermissionState.Deny; break;
                }
            };

            if (selftest != null)
            {
                testing = true;
                var guard = new Timer { Interval = 120_000 };
                guard.Tick += (o, e) => { guard.Stop(); Report("timed out", false); ExitCode = 2; Close(); };
                guard.Start();
            }
            c.Navigate(start ?? Site + "?source=windows");
            ticker.Start();
            _ = RefreshPrice();
            if (selftest == null) { await Task.Delay(20_000); await CheckUpdate(false); }
        }

        public static bool IsSite(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var u)) return false;
            if (u.Scheme != Uri.UriSchemeHttps && u.Scheme != Uri.UriSchemeHttp) return false;
            var h = u.Host.ToLowerInvariant();
            return h == "entekhab.net" || h.EndsWith(".entekhab.net");
        }

        void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
        {
            var url = e.Uri ?? "";
            if (url.StartsWith("about:") || url.StartsWith("data:")) return;          // the offline page
            if (IsSite(url))
            {
                if (url.StartsWith("http://")) { e.Cancel = true; web.CoreWebView2.Navigate("https://" + url.Substring(7)); }
                return;
            }
            e.Cancel = true;            // anything else belongs to the person's own browser or app
            OpenExternal(url);
        }

        void OnNewWindow(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;           // no second window: our pages open here, the rest outside
            if (IsSite(e.Uri)) web.CoreWebView2.Navigate(e.Uri.Replace("http://", "https://"));
            else OpenExternal(e.Uri);
        }

        void OpenExternal(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var u)) return;
            var ok = new[] { "https", "http", "tg", "mailto" };
            if (Array.IndexOf(ok, u.Scheme) < 0) return;              // javascript:, file:, ms-… and the like never leave the window
            external.Add(u.AbsoluteUri);
            if (testing) return;
            try { Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true }); } catch { }
        }

        async void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            var c = web.CoreWebView2;
            if (!e.IsSuccess && e.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled)
            {
                ShowOffline();
                HideSplash();
                if (testing) { Report("offline: " + e.WebErrorStatus, false); ExitCode = 4; Close(); }
                return;
            }
            if (!e.IsSuccess) return;
            if (IsSite(c.Source)) { lastSiteUrl = c.Source; offlineShown = false; }
            HideSplash();
            await SyncLanguage();
            if (testing && !firstLoadDone && IsSite(c.Source)) { firstLoadDone = true; await RunSelfTest(); }
            firstLoadDone = true;
        }

        void HideSplash() { if (splash.Visible) { splash.Visible = false; web.Focus(); } }

        void ShowOffline()
        {
            offlineShown = true;
            string html;
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("offline.html"))
            using (var r = new StreamReader(s, Encoding.UTF8)) html = r.ReadToEnd();
            string logo = "";
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("logo.png"))
            using (var m = new MemoryStream()) { s.CopyTo(m); logo = Convert.ToBase64String(m.ToArray()); }
            html = html.Replace("{{LOGO}}", logo).Replace("{{TITLE}}", S.Get("offTitle")).Replace("{{RETRY}}", S.Get("retry"));
            Text = "Entekhab — " + S.Get("offTitle");
            web.CoreWebView2.NavigateToString(html);
        }

        /// <summary>the app speaks the language the reader chose on the site (Arabic included)</summary>
        async Task SyncLanguage()
        {
            try
            {
                var r = await web.CoreWebView2.ExecuteScriptAsync("(function(){try{return localStorage.getItem('ek_ar')==='1'?'ar':(localStorage.getItem('ck_lang')||'fa')}catch(e){return ''}})()");
                var l = (r ?? "").Trim('"');
                if ((l == "fa" || l == "ckb" || l == "ar" || l == "en") && l != S.Lang) { S.Lang = l; BuildTray(); }
            }
            catch { }
        }

        // ----------------------------------------------------------------------------------------------- tray
        void BuildTray()
        {
            var menu = new ContextMenuStrip { RightToLeft = S.Rtl ? RightToLeft.Yes : RightToLeft.No, ShowImageMargin = false };
            menu.Items.Add(S.Get("open"), null, (o, e) => BringBack());
            menu.Items.Add(S.Get("home"), null, (o, e) => { BringBack(); web.CoreWebView2?.Navigate(Site); });
            menu.Items.Add(S.Get("reload"), null, (o, e) => { BringBack(); web.CoreWebView2?.Reload(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(S.Get("update"), null, async (o, e) => await CheckUpdate(true));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(S.Get("exit"), null, (o, e) => Close());
            var old = tray.ContextMenuStrip;
            tray.ContextMenuStrip = menu;
            old?.Dispose();
            tray.Icon = Icon ?? SystemIcons.Application;
            tray.Text = string.IsNullOrEmpty(trayPrice) ? "Entekhab — entekhab.net" : trayPrice;
            tray.Visible = true;
            tray.MouseClick -= TrayClick; tray.MouseClick += TrayClick;
            tray.BalloonTipClicked -= BalloonClick; tray.BalloonTipClicked += BalloonClick;
        }

        void TrayClick(object o, MouseEventArgs e) { if (e.Button == MouseButtons.Left) BringBack(); }
        void BalloonClick(object o, EventArgs e) { if (updateUrl != null) OpenExternal(updateUrl); }

        /// <summary>the bitcoin price in the tray tooltip, once a minute, from Binance's public data API</summary>
        async Task RefreshPrice()
        {
            try
            {
                var j = await Http.GetStringAsync("https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT&type=MINI");
                var last = Num(j, "lastPrice"); var open = Num(j, "openPrice");
                if (last > 0)
                {
                    var chg = open > 0 ? (last / open - 1) * 100 : 0;
                    trayPrice = "BTC $" + last.ToString("N0", CultureInfo.InvariantCulture) + " (" + (chg >= 0 ? "+" : "") + chg.ToString("0.00", CultureInfo.InvariantCulture) + "%) — Entekhab";
                    if (trayPrice.Length > 63) trayPrice = trayPrice.Substring(0, 63);
                    tray.Text = trayPrice;
                }
            }
            catch { /* no network: the tooltip keeps the last price */ }
        }

        static double Num(string json, string key)
        {
            var m = Regex.Match(json, "\"" + key + "\"\\s*:\\s*\"?([0-9.eE+-]+)");
            return m.Success && double.TryParse(m.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? v : 0;
        }

        // ----------------------------------------------------------------------------------------------- updates
        async Task CheckUpdate(bool asked)
        {
            try
            {
                var j = await Http.GetStringAsync(Site + "app/windows.json?t=" + DateTime.UtcNow.Ticks);
                var v = Regex.Match(j, "\"version\"\\s*:\\s*\"([0-9.]+)\"").Groups[1].Value;
                if (v.Length > 0 && Newer(v, Program.Version))
                {
                    updateUrl = Site + "app/#windows";
                    tray.ShowBalloonTip(15000, S.Get("newTitle"), string.Format(S.Get("newText"), v), ToolTipIcon.Info);
                }
                else if (asked) tray.ShowBalloonTip(6000, "Entekhab", S.Get("upToDate"), ToolTipIcon.Info);
            }
            catch { if (asked) tray.ShowBalloonTip(6000, "Entekhab", S.Get("noCheck"), ToolTipIcon.Warning); }
        }

        static bool Newer(string a, string b)
        {
            var x = a.Split('.').Select(s => int.TryParse(s, out var n) ? n : 0).ToArray();
            var y = b.Split('.').Select(s => int.TryParse(s, out var n) ? n : 0).ToArray();
            for (int i = 0; i < 3; i++) { int p = i < x.Length ? x[i] : 0, q = i < y.Length ? y[i] : 0; if (p != q) return p > q; }
            return false;
        }

        // ----------------------------------------------------------------------------------------------- settings
        string SettingsFile => Path.Combine(dataDir, "settings.txt");

        void LoadSettings()
        {
            S.Lang = S.FromWindows();
            try
            {
                if (!File.Exists(SettingsFile)) return;
                var kv = File.ReadAllLines(SettingsFile).Select(l => l.Split(new[] { '=' }, 2)).Where(p => p.Length == 2).ToDictionary(p => p[0], p => p[1]);
                if (kv.TryGetValue("lang", out var l) && new[] { "fa", "ckb", "ar", "en" }.Contains(l)) S.Lang = l;
                if (kv.TryGetValue("bounds", out var b))
                {
                    var n = b.Split(',').Select(int.Parse).ToArray();
                    var r = new Rectangle(n[0], n[1], n[2], n[3]);
                    if (r.Width >= 900 && r.Height >= 600 && Screen.AllScreens.Any(s => s.WorkingArea.IntersectsWith(r)))
                    { StartPosition = FormStartPosition.Manual; Bounds = r; }
                }
                if (kv.TryGetValue("max", out var mx) && mx == "1") WindowState = FormWindowState.Maximized;
            }
            catch { }
        }

        void SaveSettings()
        {
            try
            {
                var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                File.WriteAllLines(SettingsFile, new[] { "lang=" + S.Lang, $"bounds={r.X},{r.Y},{r.Width},{r.Height}", "max=" + (WindowState == FormWindowState.Maximized ? "1" : "0") });
            }
            catch { }
        }

        // ----------------------------------------------------------------------------------------------- self-test (CI)
        async Task RunSelfTest()
        {
            var c = web.CoreWebView2;
            await Task.Delay(8000);                                   // let the page draw its live parts
            await c.ExecuteScriptAsync("window.open('https://t.me/Coin_Kurd','_blank'); 1");      // must open outside
            await c.ExecuteScriptAsync("setTimeout(function(){location.href='https://example.com/'},10); 1");   // must be refused
            await Task.Delay(2500);
            var info = await c.ExecuteScriptAsync("JSON.stringify({title:document.title,href:location.href,ua:navigator.userAgent,links:document.links.length,lang:document.documentElement.lang,dir:document.documentElement.dir})");
            long size = 0;
            try
            {
                using (var f = File.Create(selftest)) await c.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, f);
                size = new FileInfo(selftest).Length;
            }
            catch (Exception ex) { external.Add("capture failed: " + ex.Message); }
            bool ok = info.Contains("entekhab.net") && info.Contains("EntekhabWin/") && external.Any(u => u.StartsWith("https://t.me/"))
                      && !c.Source.Contains("example.com") && size > 10_000;
            Report(info, ok, size);
            ExitCode = ok ? 0 : 1;
            Close();
        }

        void Report(string info, bool ok, long png = 0)
        {
            if (selftest == null) return;
            string ver = "";
            try { ver = CoreWebView2Environment.GetAvailableBrowserVersionString(); } catch { }
            var sb = new StringBuilder();
            sb.Append("{\"ok\":").Append(ok ? "true" : "false")
              .Append(",\"app\":\"").Append(Program.Version).Append('"')
              .Append(",\"webview2\":\"").Append(J(ver)).Append('"')
              .Append(",\"source\":\"").Append(J(web.CoreWebView2?.Source ?? "")).Append('"')
              .Append(",\"png_bytes\":").Append(png)
              .Append(",\"opened_outside\":[").Append(string.Join(",", external.Select(u => "\"" + J(u) + "\""))).Append(']')
              .Append(",\"page\":\"").Append(J(info)).Append("\"}");
            try { File.WriteAllText(Path.ChangeExtension(selftest, ".json"), sb.ToString(), new UTF8Encoding(false)); } catch { }
        }

        static string J(string s) => (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");
    }
}
