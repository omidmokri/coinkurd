#!/usr/bin/env bash
# Builds the Entekhab Android app (a hardened WebView shell for https://entekhab.net) without Gradle.
#
# Tools (Debian/Ubuntu: apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk):
#   aapt · javac (JDK 8+) · dalvik-exchange (dx) · zipalign · apksigner
#
# Usage:
#   KEYSTORE=/secure/place/entekhab-release.p12 KS_PASS='…' ./build.sh
# The signing key is NEVER stored in this repository. Keep it (and its password) offline:
# Android only installs an update when it is signed with the same key.
set -euo pipefail
cd "$(dirname "$0")"

SDK_JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
OUT=${OUT:-build}
KS=${KEYSTORE:?set KEYSTORE=/path/to/release.p12}
: "${KS_PASS:?set KS_PASS (keystore password)}"
ALIAS=${KS_ALIAS:-entekhab}
VC=$(sed -n 's/.*android:versionCode="\([0-9]*\)".*/\1/p' AndroidManifest.xml)
VN=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' AndroidManifest.xml)

rm -rf "$OUT"; mkdir -p "$OUT/gen" "$OUT/stubs" "$OUT/obj" "$OUT/res"

# 0) the sources are kept flat: res.<folder>.<file> → res/<folder>/<file>
for f in res.*; do q=${f#res.}; dir=${q%%.*}; name=${q#*.}; mkdir -p "$OUT/res/$dir"; cp "$f" "$OUT/res/$dir/$name"; done

# 1) resources + manifest → R.java and a resource-only APK
aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S "$OUT/res" -I "$SDK_JAR" \
     -F "$OUT/res.apk" --min-sdk-version 21 --target-sdk-version 34

# 2) Java → classes (the API-26 stub is compile-time only and never packaged)
javac -nowarn -encoding UTF-8 -source 8 -target 8 -bootclasspath "$SDK_JAR" -d "$OUT/stubs" RenderProcessGoneDetail.java 2>/dev/null
javac -nowarn -encoding UTF-8 -source 8 -target 8 -bootclasspath "$SDK_JAR" -classpath "$OUT/stubs" -d "$OUT/obj" \
      "$OUT"/gen/net/entekhab/app/R.java MainActivity.java 2>&1 | grep -v "^warning: \[options\]" || true
test -f "$OUT/obj/net/entekhab/app/MainActivity.class"

# 3) classes → classes.dex
dalvik-exchange --dex --min-sdk-version=21 --output="$OUT/classes.dex" "$OUT/obj"

# 4) repack: resources.arsc must be STORED (uncompressed) for targetSdk ≥ 30; fixed timestamps
python3 - "$OUT/res.apk" "$OUT/classes.dex" "$OUT/unsigned.apk" <<'PY'
import sys, zipfile
src, dex, dst = sys.argv[1:]
STORED = ('resources.arsc', '.png', '.webp', '.jpg')
with zipfile.ZipFile(src) as zi, zipfile.ZipFile(dst, 'w') as zo:
    names = zi.namelist()
    order = ['AndroidManifest.xml'] + sorted(n for n in names if n != 'AndroidManifest.xml')
    for n in order + ['classes.dex']:
        data = open(dex, 'rb').read() if n == 'classes.dex' else zi.read(n)
        zinfo = zipfile.ZipInfo(n, date_time=(2026, 11, 2, 0, 0, 0))
        zinfo.compress_type = zipfile.ZIP_STORED if n.endswith(STORED) else zipfile.ZIP_DEFLATED
        zinfo.external_attr = 0o644 << 16
        zo.writestr(zinfo, data)
PY

# 5) align + sign (v1 for Android 5–6, v2/v3 for 7+)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
apksigner sign --ks "$KS" --ks-pass env:KS_PASS --ks-key-alias "$ALIAS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT/entekhab-v$VN.apk" "$OUT/aligned.apk"
apksigner verify --verbose --print-certs "$OUT/entekhab-v$VN.apk"
zipalign -c -p 4 "$OUT/entekhab-v$VN.apk" && echo "aligned OK"
echo "built $OUT/entekhab-v$VN.apk (versionCode $VC)"
