# scripts/install.ps1
# OmniSMM Skills Suite — Cross-Platform Windows/PowerShell Installer
param(
    [string]$TargetDir = (Get-Location).Path,
    [switch]$GlobalAntigravity,
    [switch]$SetupCursor,
    [switch]$SetupWindsurf,
    [switch]$SetupClaude
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  OmniSMM Architectural Skills Suite Installer (v1.0.0)   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$sourceRoot = Split-Path -Parent $PSScriptRoot

if ($GlobalAntigravity) {
    $globalSkillsDir = Join-Path $env:USERPROFILE ".gemini\antigravity\skills"
    Write-Host "[Mode: Global Antigravity] Installing into: $globalSkillsDir" -ForegroundColor Yellow
    if (!(Test-Path $globalSkillsDir)) { New-Item -ItemType Directory -Force -Path $globalSkillsDir | Out-Null }
    
    $skillsSource = Join-Path $sourceRoot ".agents\skills"
    Get-ChildItem -Path $skillsSource -Directory | ForEach-Object {
        $dest = Join-Path $globalSkillsDir $_.Name
        Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
        Write-Host "  + Installed skill: $($_.Name)" -ForegroundColor Green
    }
    Write-Host "OK: Skills installed globally for Google Antigravity." -ForegroundColor Green
    exit 0
}

Write-Host "[Mode: Local Project] Target directory: $TargetDir" -ForegroundColor Yellow

$destAgents = Join-Path $TargetDir ".agents"
$destRootAgents = Join-Path $TargetDir "AGENTS.md"

if (!(Test-Path $destAgents)) { New-Item -ItemType Directory -Force -Path $destAgents | Out-Null }

Copy-Item -Path (Join-Path $sourceRoot ".agents\*") -Destination $destAgents -Recurse -Force
Copy-Item -Path (Join-Path $sourceRoot "AGENTS.md") -Destination $destRootAgents -Force
Write-Host "OK: .agents/ and AGENTS.md installed into target project." -ForegroundColor Green

# Optional IDE integrations
if ($SetupCursor -or (Test-Path (Join-Path $TargetDir ".cursorrules"))) {
    $cursorRules = Join-Path $TargetDir ".cursorrules"
    $templateCursor = Join-Path $sourceRoot "templates\.cursorrules"
    if (Test-Path $templateCursor) {
        Copy-Item -Path $templateCursor -Destination $cursorRules -Force
        Write-Host "  + Configured Cursor IDE (.cursorrules)" -ForegroundColor Green
    }
}

if ($SetupWindsurf -or (Test-Path (Join-Path $TargetDir ".windsurfrules"))) {
    $windsurfRules = Join-Path $TargetDir ".windsurfrules"
    $templateWindsurf = Join-Path $sourceRoot "templates\.windsurfrules"
    if (Test-Path $templateWindsurf) {
        Copy-Item -Path $templateWindsurf -Destination $windsurfRules -Force
        Write-Host "  + Configured Windsurf IDE (.windsurfrules)" -ForegroundColor Green
    }
}

if ($SetupClaude -or (Test-Path (Join-Path $TargetDir "CLAUDE.md"))) {
    $claudeMd = Join-Path $TargetDir "CLAUDE.md"
    $templateClaude = Join-Path $sourceRoot "templates\CLAUDE.md"
    if (Test-Path $templateClaude) {
        Copy-Item -Path $templateClaude -Destination $claudeMd -Force
        Write-Host "  + Configured Claude Code (CLAUDE.md)" -ForegroundColor Green
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Installation completed successfully!                    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
