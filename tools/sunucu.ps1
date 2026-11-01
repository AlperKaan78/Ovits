# Mor Sarmasik yerel sunucusu (Kisi 1). Kurulum gerektirmez: Windows PowerShell yeterli.
# Yalnizca bu bilgisayardan (localhost) erisilir; depo klasoru disina dosya vermez.
# Kullanim: baslat.bat (ya da: powershell -ExecutionPolicy Bypass -File tools\sunucu.ps1 -Port 4180 -Open oyun.html)
param([int]$Port = 4180, [string]$Open = 'oyun.html', [switch]$NoBrowser)

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.md' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.webp' = 'image/webp'
  '.glb' = 'model/gltf-binary'; '.gltf' = 'model/gltf+json'; '.bin' = 'application/octet-stream'
  '.wav' = 'audio/wav'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch {
  Write-Host "Port $Port kullanimda olabilir. Oyun zaten aciksa tarayicida http://localhost:$Port/$Open adresine gidin."
  if (-not $NoBrowser) { Start-Process "http://localhost:$Port/$Open" }
  exit 1
}
Write-Host "Mor Sarmasik calisiyor: http://localhost:$Port/$Open"
Write-Host "Oyunu kapatinca bu pencereyi de kapatin."
if (-not $NoBrowser) { Start-Process "http://localhost:$Port/$Open" }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if (-not $rel) { $rel = $Open }
    $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $full.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
    } else {
      $bytes = [IO.File]::ReadAllBytes($full)
      $type = $types[[IO.Path]::GetExtension($full).ToLower()]
      if (-not $type) { $type = 'application/octet-stream' }
      $res.ContentType = $type
      $res.Headers.Add('Cache-Control', 'no-store')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.Close()
  }
}
