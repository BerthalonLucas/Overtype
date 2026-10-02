; Overtype was called FlowTranslate until 0.5.1. Tauri's installer names the install
; folder, the uninstall key, the shortcuts and the autostart value after the product, so a
; 0.6 installed over a 0.5 would leave two apps side by side. These hooks remove the old
; one first. The data (%APPDATA%\com.flowtranslate.desktop: settings, DPAPI keys, history)
; is never touched: the identifier did not change, and the old uninstaller only deletes it
; when its checkbox is ticked, which a silent run never does.

!define LEGACY_NAME "FlowTranslate"
!define LEGACY_UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${LEGACY_NAME}"
!define LEGACY_RUNKEY "Software\Microsoft\Windows\CurrentVersion\Run"
!define LEGACY_APPROVEDKEY "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"

Var LegacyAutostart
Var LegacyDesktopShortcut

!macro NSIS_HOOK_PREINSTALL
  StrCpy $LegacyAutostart 0
  StrCpy $LegacyDesktopShortcut 0

  ; What the 0.5 user had and must keep under the new name.
  ReadRegStr $R8 HKCU "${LEGACY_RUNKEY}" "${LEGACY_NAME}"
  ${If} $R8 != ""
    StrCpy $LegacyAutostart 1
  ${EndIf}
  ${If} ${FileExists} "$DESKTOP\${LEGACY_NAME}.lnk"
    StrCpy $LegacyDesktopShortcut 1
  ${EndIf}

  ReadRegStr $R8 HKCU "${LEGACY_UNINSTKEY}" "UninstallString"
  ReadRegStr $R9 HKCU "${LEGACY_UNINSTKEY}" "InstallLocation"
  ${If} $R8 != ""
  ${AndIf} $R9 != ""
    ; InstallLocation is stored between quotes.
    StrCpy $R7 $R9 1
    ${If} $R7 == '"'
      StrCpy $R9 $R9 "" 1
      StrCpy $R9 $R9 -1
    ${EndIf}
    DetailPrint "Removing ${LEGACY_NAME} from $R9"
    nsis_tauri_utils::KillProcessCurrentUser "${LEGACY_NAME}.exe"
    Pop $R7
    Sleep 500
    ; Silent, and in place (_?=) so that ExecWait really waits for it.
    ExecWait '$R8 /S _?=$R9' $R7
    ; An uninstaller run in place cannot delete itself nor its folder.
    Delete "$R9\uninstall.exe"
    RMDir "$R9"
  ${EndIf}

  ; Whatever the old uninstaller left behind.
  DeleteRegValue HKCU "${LEGACY_RUNKEY}" "${LEGACY_NAME}"
  DeleteRegValue HKCU "${LEGACY_APPROVEDKEY}" "${LEGACY_NAME}"
  DeleteRegKey HKCU "${LEGACY_UNINSTKEY}"
  DeleteRegKey HKCU "Software\flowtranslate\${LEGACY_NAME}"
  DeleteRegKey /ifempty HKCU "Software\flowtranslate"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Launch at sign-in follows the app to its new name and path.
  ${If} $LegacyAutostart = 1
    WriteRegStr HKCU "${LEGACY_RUNKEY}" "${PRODUCTNAME}" '"$INSTDIR\${MAINBINARYNAME}.exe"'
  ${EndIf}
  ${If} $LegacyDesktopShortcut = 1
    Call CreateOrUpdateDesktopShortcut
  ${EndIf}
!macroend
