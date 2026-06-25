@echo off
REM =====================================================================
REM  build_zip.bat
REM  Packages the Samurai Slash project files into SamuraiSlash.zip
REM  Uses PowerShell's built-in Compress-Archive (no extra tools needed,
REM  works out of the box on Windows 10 and Windows 11).
REM =====================================================================

setlocal

set "ZIPNAME=SamuraiSlash.zip"
set "SRCDIR=%~dp0"

echo.
echo ============================================
echo  Samurai Slash - Build Zip
echo ============================================
echo.
echo Source folder: %SRCDIR%
echo Output file:   %SRCDIR%%ZIPNAME%
echo.

REM Remove any previous zip so Compress-Archive doesn't complain about it existing.
if exist "%SRCDIR%%ZIPNAME%" (
    echo Removing existing %ZIPNAME% ...
    del /f /q "%SRCDIR%%ZIPNAME%"
)

echo Creating %ZIPNAME% ...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Compress-Archive -Path '%SRCDIR%index.html', '%SRCDIR%style.css', '%SRCDIR%game.js', '%SRCDIR%README.md' -DestinationPath '%SRCDIR%%ZIPNAME%' -Force"

echo.
if exist "%SRCDIR%%ZIPNAME%" (
    echo SUCCESS: Created %ZIPNAME%
) else (
    echo ERROR: Failed to create %ZIPNAME%.
    echo Make sure PowerShell is available and try again.
)

echo.
pause
endlocal
