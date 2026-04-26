@echo off
setlocal
cd /d "%~dp0"

echo.
echo Publikowanie sklepu na GitHub Pages...
echo.

git status --short
git add .
git diff --cached --quiet
if %errorlevel%==0 (
  echo.
  echo Brak zmian do opublikowania.
  echo.
  pause
  exit /b 0
)

for /f "tokens=1-3 delims=.:-/ " %%a in ("%date% %time%") do set STAMP=%%a-%%b-%%c
git commit -m "Update shop %STAMP%"
if errorlevel 1 (
  echo.
  echo Nie udalo sie utworzyc commita.
  echo.
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo.
  echo Nie udalo sie wyslac zmian na GitHub.
  echo.
  pause
  exit /b 1
)

echo.
echo Gotowe. GitHub Pages zaktualizuje strone po chwili:
echo https://dd-systems.github.io/sklep-app/
echo.
pause
