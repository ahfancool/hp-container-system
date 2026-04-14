param(
  [string]$RootEnvPath = ".env",
  [string]$FrontendEnvPath = "frontend/.env.local",
  [string]$BackendEnvPath = "backend/.dev.vars"
)

$requiredRootKeys = @(
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "JWT_SECRET"
)

$requiredFrontendKeys = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_API_BASE_URL"
)

$requiredBackendKeys = @(
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "JWT_SECRET"
)

function Get-KeyMap {
  param([string]$Path)

  $map = @{}

  if (-not (Test-Path -LiteralPath $Path)) {
    return $map
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()

    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf("=")

    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1).Trim()
    $map[$key] = $value
  }

  return $map
}

function Test-EnvFile {
  param(
    [string]$Label,
    [string]$Path,
    [string[]]$RequiredKeys
  )

  Write-Host "[$Label] $Path"

  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Warning "  File not found."
    return $false
  }

  $keyMap = Get-KeyMap -Path $Path
  $missing = @()

  foreach ($key in $RequiredKeys) {
    if (-not $keyMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace([string]$keyMap[$key])) {
      $missing += $key
    }
  }

  if ($missing.Count -eq 0) {
    Write-Host "  OK"
    return $true
  }

  Write-Warning ("  Missing keys: " + ($missing -join ", "))
  return $false
}

$results = @(
  (Test-EnvFile -Label "root" -Path $RootEnvPath -RequiredKeys $requiredRootKeys),
  (Test-EnvFile -Label "frontend" -Path $FrontendEnvPath -RequiredKeys $requiredFrontendKeys),
  (Test-EnvFile -Label "backend" -Path $BackendEnvPath -RequiredKeys $requiredBackendKeys)
)

if ($results -contains $false) {
  Write-Host ""
  Write-Host "Environment configuration is incomplete."
  exit 1
}

Write-Host ""
Write-Host "Environment files look ready for local development."
