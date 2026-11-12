# Entekhab for Windows (64-bit)

A small, hardened window on **https://entekhab.net** for Windows 10 (1903+) and 11, 64-bit.
Users download it from [entekhab.net/app](https://entekhab.net/app/#windows).

- **Engine:** Microsoft Edge WebView2 (built into Windows 11; installed on Windows 10 with Edge). The app is
  .NET Framework 4.8, which Windows already has — so the whole download is about 1 MB.
- **Only entekhab.net** opens inside the window (HTTPS only); Telegram, YouTube, X and every other link open in the
  person's own browser or app. No JavaScript bridge into Windows, no developer tools, no camera / microphone /
  location. Site data stays in `%LOCALAPPDATA%\Entekhab` and survives updates.
- **Tray:** the live bitcoin price in the tray icon's tooltip; Open, Home, Reload, Check for updates, Exit — in the
  language chosen on the site (Kurdish, Persian, Arabic or English).
- **Updates:** the app reads `/app/windows.json` and shows a notification when a newer installer is published.
- **Installer:** NSIS, Persian / Arabic / English, per-user (no administrator prompt), Start-menu and desktop
  shortcuts, uninstaller in "Apps & features" (it asks before deleting the site data).

## Build, test, publish

Everything runs in `.github/workflows/windows-app.yml` on a Windows runner whenever `windows/` changes:
build → `Entekhab.exe --selftest out.png` (loads the site, checks that outside links leave the window and that a
foreign page is refused, saves a picture and a JSON report) → installer → silent install → the installed app's
self-test → a desktop screenshot → a second launch must not open a second app → silent uninstall must leave nothing
→ the installer is committed to `app/windows/` with `app/windows.json` (version, size, SHA-256). Pictures of every
run are on the `ci-windows` branch. To release a new version, raise `<Version>` in `Entekhab.csproj` and
`Program.Version` together.

The installer is not code-signed (a certificate costs money and needs a company identity), so Windows SmartScreen
asks once: "More info" → "Run anyway". The SHA-256 on the download page lets anyone check the file.
