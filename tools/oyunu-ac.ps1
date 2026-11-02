$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$name = Split-Path $project -Leaf
$port = if ($name -match '^deneme(\d+)$') { 4200 + [int]$Matches[1] } else { 4180 }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Oyunu açmak için Node.js gerekli.' }
$running = $false
try { $status = Invoke-RestMethod -Uri "http://127.0.0.1:$port/lan/status" -TimeoutSec 2; $running = $status.lan -and $status.version -eq $name } catch {}
if (-not $running) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) { throw "Port $port başka bir uygulamada kullanılıyor. Çalışan uygulamayı kontrol edin." }
    $env:LAN_PORT = [string]$port
    Start-Process -FilePath $nodePath -ArgumentList ('"' + (Join-Path $project 'assets\lan-server.cjs') + '"') -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $project '.oyun-server.log') -RedirectStandardError (Join-Path $project '.oyun-server-error.log') | Out-Null
    for ($i=0; $i -lt 20; $i++) { try { $status = Invoke-RestMethod -Uri "http://127.0.0.1:$port/lan/status" -TimeoutSec 1; if ($status.lan) { $running=$true; break } } catch {}; Start-Sleep -Milliseconds 250 }
    if (-not $running) { throw 'Sunucu açılamadı. .oyun-server-error.log dosyasını kontrol edin.' }
}
Start-Process "http://127.0.0.1:$port/assets/game3d.html"
