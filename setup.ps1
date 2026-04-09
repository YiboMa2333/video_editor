# AI Video Editor - Windows Setup Helper Script
#
# This script automates common setup tasks for the AI Video Editor on Windows.
# Usage: powershell -ExecutionPolicy Bypass -File setup.ps1
#
# What it does:
#   1. Checks for required tools (Node.js, Git, FFmpeg via pnpm)
#   2. Installs dependencies (pnpm, npm packages)
#   3. Offers to install mpv if not found
#   4. Sets up environment variables as needed
#   5. Provides troubleshooting guidance

param(
    [switch]$SkipMpv = $false,
    [switch]$SkipPnpm = $false,
    [switch]$SkipDeps = $false
)

# Colors for output
function Write-Success { Write-Host "$args" -ForegroundColor Green }
function Write-Warning { Write-Host "$args" -ForegroundColor Yellow }
function Write-Error { Write-Host "$args" -ForegroundColor Red }
function Write-Info { Write-Host "$args" -ForegroundColor Cyan }

Write-Info "=== AI Video Editor - Windows Setup Helper ==="
Write-Info ""

# Helper: Test if command exists
function Test-Command {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    return $null -ne $cmd
}

# Helper: Get installed version
function Get-CommandVersion {
    param([string]$Name, [string]$Flag = "--version")
    if (Test-Command $Name) {
        try {
            $output = & $Name $Flag 2>&1 | Select-Object -First 1
            return $output
        }
        catch {
            return "installed (version unknown)"
        }
    }
    return "NOT FOUND"
}

# === Check Required Tools ===
Write-Info "Checking required tools..."
Write-Info ""

$nodeVersion = Get-CommandVersion "node"
Write-Info "✓ Node.js: $nodeVersion"

$gitVersion = Get-CommandVersion "git"
Write-Info "✓ Git: $gitVersion"

$corepackVersion = Get-CommandVersion "corepack"
if ($corepackVersion -eq "NOT FOUND") {
    Write-Warning "⚠ Corepack: NOT FOUND (included with modern Node.js)"
}
else {
    Write-Info "✓ Corepack: $corepackVersion"
}

Write-Info ""

# === Install Package Dependencies ===
if (-not $SkipDeps) {
    Write-Info "Installing npm dependencies (via pnpm)..."
    Write-Info ""
    
    try {
        corepack pnpm install
        Write-Success "✓ Dependencies installed successfully"
    }
    catch {
        Write-Error "✗ Failed to install dependencies: $_"
        Write-Error "  Try running manually: corepack pnpm install"
    }
}

Write-Info ""

# === Approve Builds ===
if (-not $SkipPnpm) {
    Write-Info "Approving pnpm build scripts..."
    try {
        corepack pnpm approve-builds --all
        Write-Success "✓ Build scripts approved"
    }
    catch {
        Write-Warning "⚠ Could not auto-approve builds: $_"
    }
    
    Write-Info "Rebuilding Electron and esbuild..."
    try {
        corepack pnpm rebuild electron esbuild
        Write-Success "✓ Rebuild complete"
    }
    catch {
        Write-Warning "⚠ Rebuild had issues (may still work): $_"
    }
}

Write-Info ""

# === Check for mpv ===
Write-Info "Checking for mpv (video player)..."

$mpvFound = $false
$mpvPath = ""

# Check in tools/mpv/
if (Test-Path "tools/mpv/mpv.exe") {
    $mpvFound = $true
    $mpvPath = (Resolve-Path "tools/mpv/mpv.exe").Path
    Write-Success "✓ mpv found in tools/mpv/"
}
# Check in Program Files
elseif (Test-Path "C:\Program Files\MPV Player\mpv.exe") {
    $mpvFound = $true
    $mpvPath = "C:\Program Files\MPV Player\mpv.exe"
    Write-Success "✓ mpv found in Program Files"
}
# Check on PATH
elseif (Test-Command "mpv") {
    $mpvFound = $true
    Write-Success "✓ mpv found on system PATH"
}
else {
    Write-Warning "⚠ mpv NOT FOUND"
    Write-Warning ""
    Write-Warning "The app needs mpv for video preview. Install it with:"
    Write-Warning ""
    Write-Warning "  winget install shinchiro.mpv"
    Write-Warning ""
    Write-Warning "Or:"
    Write-Warning "  1. Download from: https://github.com/mpv-player/mpv/"
    Write-Warning "  2. Copy mpv.exe to: $(Resolve-Path '.') /tools/mpv/"
    Write-Warning "  3. Or set environment variable:"
    Write-Warning "     [Environment]::SetEnvironmentVariable('AI_VIDEO_EDITOR_MPV_PATH', 'C:\path\to\mpv.exe', 'User')"
    Write-Warning ""
    
    if (-not $SkipMpv) {
        $response = Read-Host "Would you like to install mpv now using winget? (Y/n)"
        if ($response -ne "n" -and $response -ne "N") {
            Write-Info "Installing mpv..."
            try {
                winget install --id shinchiro.mpv -e --accept-package-agreements --accept-source-agreements
                Write-Success "✓ mpv installed successfully"
                Write-Info "Please restart the terminal or run: mpv --version to verify"
            }
            catch {
                Write-Error "✗ Failed to install mpv: $_"
                Write-Info "Please install manually from: https://github.com/mpv-player/mpv/"
            }
        }
    }
}

Write-Info ""

# === FFmpeg Check ===
Write-Info "Checking for ffmpeg (auto-bundled)..."
if (Test-Command "ffmpeg") {
    $ffmpegVersion = Get-CommandVersion "ffmpeg" "-version"
    Write-Success "✓ ffmpeg available: $(($ffmpegVersion -split '\n')[0])"
}
else {
    Write-Warning "⚠ ffmpeg may not be available yet"
    Write-Info "  It will be installed via npm (ffmpeg-static) when needed"
}

Write-Info ""

# === Summary ===
Write-Success "=== Setup Summary ==="
Write-Info ""
Write-Info "Next steps:"
Write-Info "  1. Review the main README.md for detailed setup instructions"
Write-Info "  2. Start the desktop app: corepack pnpm dev:desktop"
Write-Info "  3. If you encounter errors, check tools/README.md or tools/Python.md"
Write-Info ""

if ($mpvFound) {
    Write-Success "✓ All core tools appear to be available!"
}
else {
    Write-Warning "⚠ Some tools may be missing. Check the warnings above."
}

Write-Info ""
Write-Info "Configuration files:"
Write-Info "  - .env.example (copy to .env and customize)"
Write-Info "  - tools/README.md (external tool setup)"
Write-Info "  - cache/README.md (cache configuration)"
Write-Info ""
