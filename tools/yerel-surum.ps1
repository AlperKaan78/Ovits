param([string]$ArchiveRoot = (Split-Path $PSScriptRoot -Parent | Split-Path -Parent))
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$archive = [IO.Path]::GetFullPath($ArchiveRoot)
if ($archive -eq $source -or $archive.StartsWith($source + [IO.Path]::DirectorySeparatorChar)) { throw 'Arşiv proje klasörünün dışında olmalı.' }
$versions = @(Get-ChildItem -LiteralPath $archive -Directory | Where-Object { $_.Name -match '^deneme(\d+)$' } | ForEach-Object { [int]($_.Name -replace '^deneme', '') })
$next = if ($versions.Count) { [Math]::Max(2, ($versions | Measure-Object -Maximum).Maximum + 1) } else { 2 }
$destination = Join-Path $archive ('deneme' + $next)
if (Test-Path -LiteralPath $destination) { throw 'Var olan sürümün üzerine yazılamaz.' }
New-Item -ItemType Directory -Path $destination | Out-Null
$files = @(Get-ChildItem -LiteralPath $source -File -Recurse -Force | Where-Object { $_.FullName.Substring($source.Length).TrimStart([char[]]'\/') -notmatch '^\.git([\\/]|$)' })
$hashes = foreach ($file in $files) {
    $relative = $file.FullName.Substring($source.Length).TrimStart([char[]]'\/')
    $target = Join-Path $destination $relative
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $target
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $hash) { throw "Kopyalama doğrulanamadı: $relative" }
    [ordered]@{ file = $relative; sha256 = $hash; bytes = $file.Length }
}
$head = & git -C $source rev-parse HEAD
$dirty = @(& git -C $source status --short)
[ordered]@{ version = 'deneme' + $next; created = (Get-Date -Format o); source = $source; commit = $head; pendingChanges = $dirty; files = $files.Count; note = 'Tam oyun kopyası; Git geçmişi .git hariç. Önceki sürümlerin üzerine yazılmaz.' } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $destination 'SURUM-BILGISI.json') -Encoding utf8
$hashes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $destination 'DOSYA-OZETLERI.json') -Encoding utf8
Write-Output "$destination — $($files.Count) dosya, SHA256 doğrulandı."
