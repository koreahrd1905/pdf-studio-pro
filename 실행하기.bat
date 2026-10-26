@echo off
chcp 65001 > nul
title PDF Studio Pro
echo ========================================================
echo   PDF Studio Pro - PDF 분리/결합 및 순서 변경 편집기
echo ========================================================
echo.
echo 로컬 서버를 확인하고 브라우저를 실행합니다...

:: Start python server in background if not already running
tasklist /FI "IMAGENAME eq python.exe" 2>NUL | find /I /N "python.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] 서버가 이미 실행 중입니다.
) else (
    echo [START] 로컬 서버를 시작합니다...
    start /B python server.py
    timeout /t 1 /nobreak >nul
)

start "" "http://localhost:8080/index.html"
echo.
echo [성공] 브라우저 창이 열렸습니다!
echo - 편집창에서 각 카드의 ◀ / ▶ 버튼 또는 번호를 클릭하여 순서를 자유롭게 바꿀 수 있습니다.
echo - [새 PDF 생성 및 다운로드] 버튼을 누르면 다운로드가 무조건 수행됩니다.
echo.
echo 이 창을 닫아도 브라우저는 계속 이용하실 수 있습니다.
pause
