@echo off
setlocal
cd /d "%~dp0"

echo.
echo Publikowanie sklepu na GitHub Pages...
echo.

git status --short
git add .
if errorlevel 1 (
  echo.
  echo Nie udalo sie dodac plikow do commita.
  echo Sprawdz, czy repozytorium jest poprawne i czy pliki nie sa zablokowane.
  echo.
  pause
  exit /b 1
)

git diff --cached --quiet
if %errorlevel%==0 (
  echo.
  echo Brak zmian do opublikowania.
  echo.
  pause
  exit /b 0
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "STAMP=%%i"
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
  echo Najczestsze przyczyny:
  echo 1. Do repo trafil za duzy plik, np. archiwum .7z.
  echo 2. Do repo trafil katalog node_modules.
  echo 3. GitHub zablokowal push, bo w historii lokalnych commitow jest plik powyzej 100 MB.
  echo.
  echo Uwaga:
  echo Komunikat "LF will be replaced by CRLF" nie jest krytycznym bledem.
  echo Oznacza tylko zmiane koncow linii przy pracy na Windowsie.
  echo.
  pause
  exit /b 1
)

echo.
echo Gotowe. GitHub Pages zaktualizuje strone po chwili:
echo https://dd-systems.github.io/sklep-app/
echo.
pause
