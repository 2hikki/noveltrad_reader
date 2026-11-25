Set-Location "C:\Users\canod\NovelaTrad"
if (-not (Test-Path "generar_catalogo.py")) {
    Write-Error "No se encontró generar_catalogo.py en C:\Users\canod\NovelaTrad"
    exit 1
}
python generar_catalogo.py
git add output/catalogo.json
$diff = git status --porcelain output/catalogo.json
if ($diff) {
    git commit -m "v30: actualizar catalogo.json"
    git push
    Write-Host "catalogo.json actualizado y subido."
} else {
    Write-Host "catalogo.json ya estaba al día."
}
