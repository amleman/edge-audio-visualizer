# Genera el paquete portable para compartir: release\EdgeAudioVisualizer-v<version>-win-x64.zip
# Incluye el runtime de .NET (self-contained), así quien lo descargue no necesita instalar nada.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$version = ([xml](Get-Content 'src-csharp\ScreenAudioVisualizer.csproj')).Project.PropertyGroup.Version | Where-Object { $_ } | Select-Object -First 1
$name = "EdgeAudioVisualizer-v$version-win-x64"
$outDir = Join-Path 'release' 'Edge Audio Visualizer'
$zip = Join-Path 'release' "$name.zip"

Write-Host "== Compilando interfaz (React) ==" -ForegroundColor Cyan
if (-not (Test-Path 'node_modules')) { npm ci }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del frontend' }

Write-Host "== Publicando programa (self-contained, win-x64) ==" -ForegroundColor Cyan
if (Test-Path 'release') { Remove-Item 'release' -Recurse -Force }
dotnet publish src-csharp -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true `
    -p:DebugType=none -o $outDir
if ($LASTEXITCODE -ne 0) { throw 'Falló dotnet publish' }

# Documentación XML de los paquetes NuGet: no sirve al usuario final
Get-ChildItem $outDir -Filter '*.xml' | Remove-Item
Copy-Item 'LEEME.txt' $outDir

Write-Host "== Comprimiendo ==" -ForegroundColor Cyan
Compress-Archive -Path $outDir -DestinationPath $zip -CompressionLevel Optimal
$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Listo: $zip ($sizeMb MB)" -ForegroundColor Green
