# Entekhab for Android

A small, hardened WebView shell for **https://entekhab.net** (package `net.entekhab.app`).
Users download it from [entekhab.net/app](https://entekhab.net/app/).

## Security model

- Only `https://entekhab.net` (and subdomains) loads inside the app. Every other link opens in the
  browser or in its own app (Telegram, YouTube, X…). `http://entekhab.net` is upgraded to HTTPS.
- `intent:`, `javascript:`, `file:`, `content:` and other schemes are refused at top level.
- No JavaScript bridge (`addJavascriptInterface` is never used).
- No file/content URL access, no geolocation, camera or microphone, no mixed content, no cleartext.
- TLS errors are never bypassed (`onReceivedSslError` is not overridden, so the load is cancelled).
- Remote debugging off, third-party cookies off, Safe Browsing on, backups off, tap-jacking filter on.
- Only permission: `INTERNET`. Downloads (JSON backup, PNG/WebM exports) are saved with the system
  "Save as" dialog (Storage Access Framework), so no storage permission is needed.
- Deep links (`https://entekhab.net/…`) are App Links verified by `/.well-known/assetlinks.json`.
- In-app update notice: the site compares the app's `EntekhabApp/x.y.z` user-agent with `/app/app.json`.

## Build (no Gradle)

```bash
sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk
KEYSTORE=/secure/entekhab-release.p12 KS_PASS='…' ./build.sh
```

The signing key is **not** in this repository and must never be committed: Android only installs
an update that is signed with the same key. After a build, copy the APK to `app/` and update
`app/app.json` (`version`, `versionCode`, `file`, `size`, `sha256`).

Sources are kept flat (one folder): `res.<folder>.<file>` is copied to `res/<folder>/<file>` at build time.
`RenderProcessGoneDetail.java` is a compile-time stub for an API 26 class; it is never packaged.
