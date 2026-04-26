$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "Publikowanie sklepu na GitHub Pages..."
Write-Host ""

git status --short
git add .

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "Brak zmian do opublikowania."
  Write-Host ""
  Read-Host "Nacisnij Enter, aby zamknac"
  exit 0
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "Update shop $stamp"

git push

Write-Host ""
Write-Host "Gotowe. GitHub Pages zaktualizuje strone po chwili:"
Write-Host "https://dd-systems.github.io/sklep-app/"
Write-Host ""
Read-Host "Nacisnij Enter, aby zamknac"
