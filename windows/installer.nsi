; Entekhab for Windows (64-bit) — installer
; Built in CI:  makensis /DVERSION=1.0.0 /DSRC=<build output> /DOUT=<folder> installer.nsi
; Per-user install (no administrator prompt) into %LOCALAPPDATA%\Programs\Entekhab, Start-menu and desktop shortcuts,
; an uninstaller in "Apps & features". The site's own data (settings, alerts, progress) lives in %LOCALAPPDATA%\Entekhab
; and survives updates; the uninstaller asks before deleting it.

Unicode true
ManifestDPIAware true
!include "MUI2.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!ifndef SRC
  !define SRC "bin\Release\net48"
!endif
!ifndef OUT
  !define OUT "."
!endif
!define UNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\Entekhab"

Name "Entekhab — انتخاب"
OutFile "${OUT}\EntekhabSetup-x64-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\Entekhab"
InstallDirRegKey HKCU "Software\Entekhab" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "entekhab.net"
ShowInstDetails nevershow
ShowUninstDetails nevershow

!define MUI_ICON "app.ico"
!define MUI_UNICON "app.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "wizard.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "wizard.bmp"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Entekhab.exe"
!define MUI_FINISHPAGE_LINK "entekhab.net"
!define MUI_FINISHPAGE_LINK_LOCATION "https://entekhab.net/"
!define MUI_LANGDLL_ALLLANGUAGES

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Farsi"
!insertmacro MUI_LANGUAGE "Arabic"
!insertmacro MUI_LANGUAGE "English"

LangString NOT64   ${LANG_FARSI}   "این نسخهٔ انتخاب برای ویندوز ۶۴ بیتی است و روی این رایانه نصب نمی‌شود."
LangString NOT64   ${LANG_ARABIC}  "هذا الإصدار من انتخاب مخصّص لنظام ويندوز 64 بت ولا يمكن تثبيته على هذا الحاسوب."
LangString NOT64   ${LANG_ENGLISH} "This version of Entekhab is for 64-bit Windows and cannot be installed on this computer."
LangString RUNNING ${LANG_FARSI}   "انتخاب باز است. لطفاً پنجرهٔ آن را ببندید و سپس OK را بزنید."
LangString RUNNING ${LANG_ARABIC}  "تطبيق انتخاب مفتوح. أغلق نافذته ثم اضغط OK."
LangString RUNNING ${LANG_ENGLISH} "Entekhab is open. Please close its window, then press OK."
LangString KEEP    ${LANG_FARSI}   "تنظیمات و داده‌های انتخاب هم از این رایانه پاک شود؟"
LangString KEEP    ${LANG_ARABIC}  "هل تريد حذف إعدادات انتخاب وبياناته من هذا الحاسوب أيضًا؟"
LangString KEEP    ${LANG_ENGLISH} "Also delete Entekhab's settings and data from this computer?"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "Entekhab"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "entekhab.net"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "Entekhab for Windows (64-bit) setup"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright" "entekhab.net"

; the app holds this mutex while it is open (Program.cs)
!macro WaitForAppClosed
  ${Do}
    System::Call 'kernel32::OpenMutexW(i 0x00100000, i 0, w "Entekhab.Desktop.Single") p .r0'
    ${If} $0 == 0
      ${Break}
    ${EndIf}
    System::Call 'kernel32::CloseHandle(p r0)'
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION "$(RUNNING)" /SD IDCANCEL IDOK +2
    Abort
  ${Loop}
!macroend

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "$(NOT64)" /SD IDOK
    Abort
  ${EndIf}
  !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd

Section "Entekhab" SecMain
  !insertmacro WaitForAppClosed
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  File "app.ico"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$SMPROGRAMS\Entekhab - انتخاب.lnk" "$INSTDIR\Entekhab.exe" "" "$INSTDIR\Entekhab.exe" 0 SW_SHOWNORMAL "" "entekhab.net"
  CreateShortcut "$DESKTOP\Entekhab - انتخاب.lnk" "$INSTDIR\Entekhab.exe" "" "$INSTDIR\Entekhab.exe" 0 SW_SHOWNORMAL "" "entekhab.net"
  WriteRegStr HKCU "Software\Entekhab" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "DisplayName" "Entekhab — انتخاب"
  WriteRegStr HKCU "${UNINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST}" "Publisher" "entekhab.net"
  WriteRegStr HKCU "${UNINST}" "DisplayIcon" "$INSTDIR\Entekhab.exe"
  WriteRegStr HKCU "${UNINST}" "URLInfoAbout" "https://entekhab.net/app/"
  WriteRegStr HKCU "${UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST}" "EstimatedSize" "$0"
SectionEnd

Function un.onInit
  !insertmacro MUI_UNGETLANGUAGE
FunctionEnd

Section "Uninstall"
  !insertmacro WaitForAppClosed
  Delete "$SMPROGRAMS\Entekhab - انتخاب.lnk"
  Delete "$DESKTOP\Entekhab - انتخاب.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST}"
  DeleteRegKey HKCU "Software\Entekhab"
  MessageBox MB_YESNO|MB_ICONQUESTION "$(KEEP)" /SD IDNO IDNO +2
  RMDir /r "$LOCALAPPDATA\Entekhab"
SectionEnd
