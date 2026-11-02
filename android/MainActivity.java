package net.entekhab.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.Charset;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Entekhab for Android — a hardened WebView shell for https://entekhab.net.
 *
 * Security model
 *  - Only https://entekhab.net (and its subdomains) is ever loaded inside the app.
 *    Every other link opens in the user's browser / the matching app (Telegram, YouTube…).
 *  - No JavaScript bridge (addJavascriptInterface is never used), no file:// or content://
 *    access, no geolocation, camera or microphone, no mixed content, no cleartext traffic.
 *  - TLS errors are never bypassed (onReceivedSslError is not overridden → the load is cancelled).
 *  - Remote debugging is off; third-party cookies are off; Safe Browsing is on (manifest).
 */
public class MainActivity extends Activity {

    private static final String HOME = "https://entekhab.net/";
    private static final int REQ_FILE = 41;
    private static final int REQ_SAVE = 42;
    private static final int BG = 0xFF0A0A0A;
    private static final int ACCENT = 0xFFF7931A;
    private static final int MUTED = 0xFF9A948C;
    private static final int CHUNK = 1 << 20;            // 1M chars per evaluateJavascript round-trip

    /** Remembers the file name of the last <a download> the page clicked (blob:/data: downloads lose it). */
    private static final String HOOK =
        "(function(){if(window.__ekh)return;window.__ekh=1;" +
        "function m(a){try{if(a&&a.hasAttribute&&a.hasAttribute('download'))" +
        "window.__ekdn=[String(a.href).slice(0,64),a.getAttribute('download')||'']}catch(e){}}" +
        "var c=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){m(this);return c.apply(this,arguments)};" +
        "document.addEventListener('click',function(e){var t=e.target;" +
        "m(t&&t.closest?t.closest('a[download]'):null)},true)})();";

    private final Handler ui = new Handler(Looper.getMainLooper());

    private FrameLayout root;
    private WebView web;
    private ProgressBar bar;
    private LinearLayout offline;
    private View splash;
    private View customView;
    private WebChromeClient.CustomViewCallback customCb;
    private ValueCallback<Uri[]> fileCb;

    private byte[] pendingBytes;
    private String lastUrl = HOME;
    private String failedUrl;
    private String version = "1";
    private boolean revealed;

    private final Runnable revealTask = new Runnable() {
        @Override public void run() { reveal(); }
    };

    // ───────────────────────────────────────────────────────────── lifecycle

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        try {
            version = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception ignored) { }
        WebView.setWebContentsDebuggingEnabled(false);

        root = new FrameLayout(this);
        root.setFilterTouchesWhenObscured(true);          // tap-jacking protection
        setContentView(root);

        createWebView();

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setIndeterminate(false);
        bar.setProgressTintList(ColorStateList.valueOf(ACCENT));
        bar.setProgressBackgroundTintList(ColorStateList.valueOf(0x00000000));
        root.addView(bar, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP));

        buildOffline();

        splash = new View(this);
        splash.setBackgroundResource(R.drawable.splash);  // identical to the window background → seamless
        splash.setClickable(true);
        root.addView(splash, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        boolean restored = saved != null && web.restoreState(saved) != null;
        if (!restored) {
            String deep = linkFrom(getIntent());
            web.loadUrl(deep != null ? deep : HOME);
        }
        ui.postDelayed(revealTask, 8000);                 // never keep the splash forever
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String deep = linkFrom(intent);
        if (deep != null && web != null) {
            hideOffline();
            web.loadUrl(deep);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) { web.onPause(); web.pauseTimers(); }
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) { web.resumeTimers(); web.onResume(); }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        ui.removeCallbacksAndMessages(null);
        if (fileCb != null) { fileCb.onReceiveValue(null); fileCb = null; }
        destroyWebView();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (customView != null) { exitFullscreen(); return; }
        if (web != null && web.canGoBack()) { hideOffline(); web.goBack(); return; }
        super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            if (fileCb != null) {
                fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
                fileCb = null;
            }
            return;
        }
        if (req == REQ_SAVE) {
            byte[] bytes = pendingBytes;
            pendingBytes = null;
            if (res == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                writeTo(data.getData(), bytes);
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    // ───────────────────────────────────────────────────────────── WebView

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(BG);
        web.setFilterTouchesWhenObscured(true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setGeolocationEnabled(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSaveFormData(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " EntekhabApp/" + version);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, false);

        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener(new Downloads());

        root.addView(web, 0, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void destroyWebView() {
        if (web == null) return;
        if (customView != null) {
            root.removeView(customView);
            customView = null;
            customCb = null;
        }
        root.removeView(web);
        web.stopLoading();
        web.setWebChromeClient(null);
        web.setWebViewClient(new WebViewClient());
        web.destroy();
        web = null;
    }

    private static boolean inApp(Uri u) {
        if (u == null || u.getHost() == null) return false;
        String h = u.getHost().toLowerCase(Locale.ROOT);
        return h.equals("entekhab.net") || h.endsWith(".entekhab.net");
    }

    /** https://entekhab.net/… only — anything else from an incoming intent is ignored. */
    private static String linkFrom(Intent i) {
        if (i == null || !Intent.ACTION_VIEW.equals(i.getAction())) return null;
        Uri u = i.getData();
        if (u == null || !"https".equalsIgnoreCase(u.getScheme()) || !inApp(u)) return null;
        return u.toString();
    }

    /** @return true when the WebView must NOT load the URL itself. */
    private boolean route(Uri u) {
        String sc = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
        if (sc.equals("https") && inApp(u)) return false;
        if (sc.equals("http") && inApp(u)) {                       // upgrade, never load cleartext
            web.loadUrl(u.buildUpon().scheme("https").build().toString());
            return true;
        }
        if (sc.equals("https") || sc.equals("http") || sc.equals("mailto") || sc.equals("tg")) {
            openExternal(u);
        }
        // intent:, javascript:, file:, content:, data:, blob: … are refused at top level.
        return true;
    }

    private void openExternal(Uri u) {
        Intent i = new Intent(Intent.ACTION_VIEW, u);
        i.addCategory(Intent.CATEGORY_BROWSABLE);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            toast("برنامه‌ای برای باز کردن این پیوند پیدا نشد · No app can open this link");
        }
    }

    private void reveal() {
        if (revealed) return;
        revealed = true;
        ui.removeCallbacks(revealTask);
        if (splash != null) {
            final View s = splash;
            s.animate().alpha(0f).setDuration(260).withEndAction(new Runnable() {
                @Override public void run() {
                    root.removeView(s);
                    getWindow().setBackgroundDrawable(new ColorDrawable(BG));
                }
            }).start();
            splash = null;
        }
    }

    private class Client extends WebViewClient {

        /** API 24+ (no @Override: we compile against API 23). */
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (!r.isForMainFrame()) {
                String sc = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
                // embedded widgets (TradingView…) may navigate inside their own frame, but no exotic schemes
                return !(sc.equals("https") || sc.equals("about") || sc.equals("data") || sc.equals("blob"));
            }
            return route(u);
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, String url) {
            return route(Uri.parse(url));
        }

        @Override
        public void onPageStarted(WebView v, String url, Bitmap favicon) {
            bar.setProgress(5);
            bar.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageCommitVisible(WebView v, String url) {
            reveal();
        }

        @Override
        public void onPageFinished(WebView v, String url) {
            bar.setVisibility(View.GONE);
            Uri u = Uri.parse(url);
            if ("https".equals(u.getScheme()) && inApp(u)) {
                lastUrl = url;
                v.evaluateJavascript(HOOK, null);
            }
            if (offline.getVisibility() != View.VISIBLE) reveal();
        }

        @Override
        public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
            if (r.isForMainFrame()) showOffline(r.getUrl().toString());
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onReceivedError(WebView v, int code, String description, String url) {
            if (Build.VERSION.SDK_INT < 23) showOffline(url);
        }

        /** API 26+: the renderer died (e.g. out of memory on a heavy 3D page) → rebuild instead of crashing. */
        public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
            if (v != web) return true;
            destroyWebView();
            createWebView();
            web.loadUrl(lastUrl);
            return true;
        }
    }

    private class Chrome extends WebChromeClient {

        @Override
        public void onProgressChanged(WebView v, int p) {
            bar.setProgress(Math.max(5, p));
            bar.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            if (p >= 80 && offline.getVisibility() != View.VISIBLE) reveal();
        }

        @Override
        public void onShowCustomView(View view, CustomViewCallback cb) {
            if (customView != null) { cb.onCustomViewHidden(); return; }
            customView = view;
            customCb = cb;
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            immersive(true);
        }

        @Override
        public void onHideCustomView() {
            if (customView == null) return;
            root.removeView(customView);
            customView = null;
            customCb = null;
            immersive(false);
        }

        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
            if (fileCb != null) fileCb.onReceiveValue(null);
            fileCb = cb;
            try {
                startActivityForResult(params.createIntent(), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                fileCb = null;
                cb.onReceiveValue(null);
            }
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            request.deny();                                  // camera / microphone / MIDI: never
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
            cb.invoke(origin, false, false);
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            return true;                                     // keep logcat clean in release
        }

        @Override
        public Bitmap getDefaultVideoPoster() {
            return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
        }
    }

    private void exitFullscreen() {
        WebChromeClient.CustomViewCallback cb = customCb;
        if (cb != null) cb.onCustomViewHidden();
        if (customView != null) {                            // in case WebView did not call onHideCustomView
            root.removeView(customView);
            customView = null;
            customCb = null;
            immersive(false);
        }
    }

    @SuppressWarnings("deprecation")
    private void immersive(boolean on) {
        View d = getWindow().getDecorView();
        if (on) {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            d.setSystemUiVisibility(0);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    // ───────────────────────────────────────────────────────────── offline screen

    private void buildOffline() {
        offline = new LinearLayout(this);
        offline.setOrientation(LinearLayout.VERTICAL);
        offline.setGravity(Gravity.CENTER);
        offline.setBackgroundColor(BG);
        offline.setPadding(dp(28), dp(28), dp(28), dp(28));
        offline.setClickable(true);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.splash_logo);
        logo.setAdjustViewBounds(true);
        logo.setMaxWidth(dp(180));
        logo.setAlpha(0.9f);
        LinearLayout.LayoutParams lpLogo = new LinearLayout.LayoutParams(dp(180), ViewGroup.LayoutParams.WRAP_CONTENT);
        lpLogo.bottomMargin = dp(26);
        offline.addView(logo, lpLogo);

        offline.addView(label("اتصال به اینترنت برقرار نیست", 19, 0xFFF5F2EE, true), wrap(0));
        offline.addView(label("No internet connection", 14, MUTED, false), wrap(dp(6)));
        offline.addView(label("اتصال خود را بررسی کنید و دوباره تلاش کنید.\nCheck your connection and try again.", 13, MUTED, false), wrap(dp(14)));

        Button retry = new Button(this);
        retry.setText("تلاش دوباره · Retry");
        retry.setAllCaps(false);
        retry.setTextColor(0xFF111111);
        retry.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        retry.setTypeface(retry.getTypeface(), android.graphics.Typeface.BOLD);
        GradientDrawable g = new GradientDrawable();
        g.setColor(ACCENT);
        g.setCornerRadius(dp(14));
        retry.setBackground(g);
        retry.setPadding(dp(26), dp(12), dp(26), dp(12));
        retry.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                String u = failedUrl != null ? failedUrl : lastUrl;
                hideOffline();
                if (web != null) web.loadUrl(u);
            }
        });
        LinearLayout.LayoutParams lpBtn = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lpBtn.topMargin = dp(26);
        offline.addView(retry, lpBtn);

        offline.setVisibility(View.GONE);
        root.addView(offline, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private TextView label(String text, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextColor(color);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setGravity(Gravity.CENTER);
        t.setLineSpacing(0, 1.25f);
        if (bold) t.setTypeface(t.getTypeface(), android.graphics.Typeface.BOLD);
        return t;
    }

    private LinearLayout.LayoutParams wrap(int top) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = top;
        return lp;
    }

    private void showOffline(String url) {
        failedUrl = url;
        bar.setVisibility(View.GONE);
        offline.setVisibility(View.VISIBLE);
        offline.bringToFront();
        reveal();
    }

    private void hideOffline() {
        failedUrl = null;
        offline.setVisibility(View.GONE);
    }

    // ───────────────────────────────────────────────────────────── downloads (data:, blob:, http)

    private class Downloads implements DownloadListener {
        @Override
        public void onDownloadStart(final String url, String userAgent, String disposition, final String mime, long length) {
            if (url == null) return;
            if (url.startsWith("data:") || url.startsWith("blob:")) {
                final String fromHeader = nameFromDisposition(disposition);
                resolveName(url, fromHeader, mime, new NameCallback() {
                    @Override public void go(String name) {
                        if (url.startsWith("data:")) saveDataUrl(url, name);
                        else fetchBlob(url, name);
                    }
                });
                return;
            }
            Uri u = Uri.parse(url);
            String sc = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            if (sc.equals("https") || sc.equals("http")) openExternal(u);   // the browser downloads it
        }
    }

    private interface NameCallback { void go(String name); }

    private void resolveName(final String url, String fromHeader, final String mime, final NameCallback cb) {
        if (fromHeader != null) { cb.go(cleanName(fromHeader, mime)); return; }
        if (web == null) { cb.go(defaultName(mime)); return; }
        web.evaluateJavascript("window.__ekdn||null", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) {
                String name = null;
                try {
                    if (v != null && v.startsWith("[")) {
                        JSONArray a = new JSONArray(v);
                        String prefix = a.optString(0, "");
                        if (prefix.length() > 0 && url.startsWith(prefix)) name = a.optString(1, null);
                    }
                } catch (Exception ignored) { }
                cb.go(name == null || name.trim().isEmpty() ? defaultName(mime) : cleanName(name, mime));
            }
        });
    }

    private void fetchBlob(final String url, final String name) {
        if (web == null) return;
        final String id = "d" + System.nanoTime();
        String js = "(function(){var S=window.__ekdl=window.__ekdl||{},k='" + id + "';"
            + "fetch(" + JSONObject.quote(url) + ").then(function(r){return r.blob()}).then(function(b){"
            + "var f=new FileReader();f.onload=function(){S[k]=String(f.result)};f.onerror=function(){S[k]='!'};"
            + "f.readAsDataURL(b)}).catch(function(){S[k]='!'});return 1})()";
        web.evaluateJavascript(js, null);
        poll(id, name, 0);
    }

    private void poll(final String id, final String name, final int tries) {
        if (web == null) return;
        web.evaluateJavascript("(function(){var v=(window.__ekdl||{})['" + id + "'];return v===undefined?-1:(v==='!'?-2:v.length)})()",
            new ValueCallback<String>() {
                @Override public void onReceiveValue(String v) {
                    int n;
                    try { n = Integer.parseInt(v.trim()); } catch (Exception e) { n = -2; }
                    if (n == -1 && tries < 400) {
                        ui.postDelayed(new Runnable() { @Override public void run() { poll(id, name, tries + 1); } }, 100);
                    } else if (n > 0) {
                        readChunks(id, name, n, 0, new StringBuilder(n));
                    } else {
                        toast("دریافت فایل ممکن نشد · Download failed");
                    }
                }
            });
    }

    private void readChunks(final String id, final String name, final int total, final int off, final StringBuilder sb) {
        if (web == null) return;
        web.evaluateJavascript("window.__ekdl['" + id + "'].substr(" + off + "," + CHUNK + ")", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) {
                try {
                    sb.append(new JSONArray("[" + v + "]").getString(0));
                } catch (Exception e) {
                    toast("دریافت فایل ممکن نشد · Download failed");
                    return;
                }
                int next = off + CHUNK;
                if (next < total) {
                    readChunks(id, name, total, next, sb);
                } else {
                    web.evaluateJavascript("delete window.__ekdl['" + id + "']", null);
                    saveDataUrl(sb.toString(), name);
                }
            }
        });
    }

    private void saveDataUrl(String dataUrl, String name) {
        try {
            int comma = dataUrl.indexOf(',');
            if (!dataUrl.startsWith("data:") || comma < 0) throw new IllegalArgumentException();
            String meta = dataUrl.substring(5, comma);
            String payload = dataUrl.substring(comma + 1);
            boolean b64 = meta.toLowerCase(Locale.ROOT).contains(";base64");
            String mime = meta.contains(";") ? meta.substring(0, meta.indexOf(';')) : meta;
            if (mime.isEmpty()) mime = "application/octet-stream";
            byte[] bytes = b64 ? Base64.decode(payload, Base64.DEFAULT)
                               : Uri.decode(payload).getBytes(Charset.forName("UTF-8"));
            askWhereToSave(bytes, name, mime);
        } catch (Exception e) {
            toast("دریافت فایل ممکن نشد · Download failed");
        }
    }

    /** Storage Access Framework: the user picks the folder, so no storage permission is needed. */
    private void askWhereToSave(byte[] bytes, String name, String mime) {
        pendingBytes = bytes;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(mime);
        i.putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(i, REQ_SAVE);
        } catch (ActivityNotFoundException e) {
            pendingBytes = null;
            toast("ذخیره‌سازی روی این دستگاه پشتیبانی نمی‌شود · Saving is not supported here");
        }
    }

    private void writeTo(Uri target, byte[] bytes) {
        OutputStream os = null;
        try {
            os = getContentResolver().openOutputStream(target);
            if (os == null) throw new IllegalStateException();
            os.write(bytes);
            os.flush();
            toast("ذخیره شد ✓ Saved");
        } catch (Exception e) {
            toast("ذخیره نشد · Could not save");
        } finally {
            if (os != null) try { os.close(); } catch (Exception ignored) { }
        }
    }

    private static String nameFromDisposition(String cd) {
        if (cd == null) return null;
        int i = cd.toLowerCase(Locale.ROOT).indexOf("filename=");
        if (i < 0) return null;
        String n = cd.substring(i + 9).trim();
        int semi = n.indexOf(';');
        if (semi >= 0) n = n.substring(0, semi);
        n = n.replace("\"", "").trim();
        return n.isEmpty() ? null : n;
    }

    private static String cleanName(String n, String mime) {
        String c = n.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        while (c.startsWith(".")) c = c.substring(1);
        if (c.length() > 120) c = c.substring(c.length() - 120);
        return c.isEmpty() ? defaultName(mime) : c;
    }

    private static String defaultName(String mime) {
        String m = mime == null ? "" : mime.toLowerCase(Locale.ROOT);
        String ext = m.contains("json") ? "json" : m.contains("png") ? "png" : m.contains("jpeg") ? "jpg"
            : m.contains("webm") ? "webm" : m.contains("mp4") ? "mp4" : m.contains("csv") ? "csv"
            : m.contains("svg") ? "svg" : m.contains("pdf") ? "pdf" : m.startsWith("text/") ? "txt" : "bin";
        return "entekhab-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date()) + "." + ext;
    }

    // ───────────────────────────────────────────────────────────── helpers

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void toast(String s) {
        Toast.makeText(this, s, Toast.LENGTH_SHORT).show();
    }
}
