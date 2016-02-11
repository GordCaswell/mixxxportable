${SegmentFile}

Var DisableSplashScreen

${SegmentInit}
	${If} $DisableSplashScreen != true
		${ReadUserOverrideConfig} $DisableSplashScreen DisableSplashScreen
		${IfNotThen} ${FileExists} $EXEDIR\App\AppInfo\Launcher\splash.jpg ${|} StrCpy $DisableSplashScreen true ${|}
		${If} $DisableSplashScreen != true
			newadvsplash::show /NOUNLOAD 1500 0 0 -1 /L $EXEDIR\App\AppInfo\Launcher\splash.jpg
		${EndIf}
	${EndIf}
!macroend

${SegmentPreExecPrimary}
	${ReadLauncherConfig} $DisableSplashScreen Launch LaunchAppAfterSplash
	${If} $DisableSplashScreen == true
		newadvsplash::stop /WAIT
	${EndIf}
!macroend

${SegmentUnload}
	${If} $DisableSplashScreen != true
		newadvsplash::stop /WAIT
	${EndIf}
!macroend
