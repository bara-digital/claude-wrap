# claude-wrap Windows installer
# Mirrors install.sh: downloads the release .exe and places it on PATH.

$ErrorActionPreference = "Stop"

$REPO = "bara-digital/claude-wrap"
$VERSION = if ($env:CLAUDE_WRAP_VERSION) { $env:CLAUDE_WRAP_VERSION } else { "latest" }
$INSTALL_DIR = if ($env:CLAUDE_WRAP_INSTALL_DIR) {
  $env:CLAUDE_WRAP_INSTALL_DIR
} else {
  Join-Path $env:LOCALAPPDATA (Join-Path "Programs" "claude-wrap")
}

# Detect architecture (Bun's stable Windows build is x64; arm64 is experimental)
$arch = "x64"
switch ($env:PROCESSOR_ARCHITECTURE) {
  "AMD64"  { $arch = "x64" }
  "ARM64"  { $arch = "arm64" }
  default  { $arch = "x64" }
}

$PLATFORM = "win32"

if ($VERSION -eq "latest") {
  $DOWNLOAD_URL = "https://github.com/$REPO/releases/latest/download/claude-wrap-$PLATFORM-$arch.exe"
} else {
  $DOWNLOAD_URL = "https://github.com/$REPO/releases/download/$VERSION/claude-wrap-$PLATFORM-$arch.exe"
}

Write-Host "Downloading claude-wrap $VERSION ($PLATFORM/$arch)..."

$exePath = Join-Path $env:TEMP ("claude-wrap-" + [System.Guid]::NewGuid().ToString() + ".exe")

if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
  & curl.exe -fsSL $DOWNLOAD_URL -o $exePath
} elseif (Get-Command Invoke-WebRequest -ErrorAction SilentlyContinue) {
  Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $exePath
} else {
  Write-Error "Neither curl.exe nor Invoke-WebRequest available."
  exit 1
}

if (-not (Test-Path $exePath)) {
  Write-Error "Download failed."
  exit 1
}

New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
$dest = Join-Path $INSTALL_DIR "claude-wrap.exe"
Move-Item -Force -Path $exePath -Destination $dest

Write-Host "Installed claude-wrap to $dest"
Write-Host ""
Write-Host "Add to PATH if needed: $INSTALL_DIR"
Write-Host ""
Write-Host "Quick start:"
Write-Host "  claude-wrap --init"
Write-Host "  claude-wrap"
