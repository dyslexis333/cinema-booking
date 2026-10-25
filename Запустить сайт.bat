@echo off
setlocal
set "PORT=8766"

curl.exe --silent --fail "http://127.0.0.1:%PORT%/" >nul 2>&1
if errorlevel 1 (
  start "Cinema demo server" /min python -m http.server %PORT% --bind 127.0.0.1 --directory "%~dp0."
)

for /L %%I in (1,1,15) do (
  curl.exe --silent --fail "http://127.0.0.1:%PORT%/" >nul 2>&1
  if not errorlevel 1 goto :open_site
  timeout /t 1 /nobreak >nul
)

echo Could not start the local server. Make sure Python is installed.
pause
exit /b 1

:open_site
start "" "http://127.0.0.1:%PORT%/"
exit /b 0
