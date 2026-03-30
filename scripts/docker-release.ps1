# 在 repo 根目錄執行：建置並推送 GHCR 映像（版本標籤 + latest）
# 前置：docker login ghcr.io（PAT 需 write:packages、read:packages）
# 可選環境變數：$env:AGILETOOLS_VERSION = "1.0.3"

$ErrorActionPreference = "Stop"
$version = if ($env:AGILETOOLS_VERSION) { $env:AGILETOOLS_VERSION } else { "1.0.2" }
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:AGILETOOLS_VERSION = $version
$server = "ghcr.io/domain5566/agiletools-server"
$web = "ghcr.io/domain5566/agiletools-web"

Write-Host "Building $server`:$version and $web`:$version ..."
docker compose build

Write-Host "Tagging latest ..."
docker tag "${server}:${version}" "${server}:latest"
docker tag "${web}:${version}" "${web}:latest"

Write-Host "Pushing ..."
docker push "${server}:${version}"
docker push "${server}:latest"
docker push "${web}:${version}"
docker push "${web}:latest"

Write-Host "Done. Images: ${server}:${version}, ${server}:latest, ${web}:${version}, ${web}:latest"
