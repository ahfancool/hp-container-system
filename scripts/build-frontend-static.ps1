param(
  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$AppEnv,
  [string]$PublicEnvFile = "./frontend/.env.production"
)

$ErrorActionPreference = "Stop"

function Resolve-PublicEnvFile {
  param([string]$RequestedPath)

  $candidatePaths = @($RequestedPath)

  if ($RequestedPath -eq "./frontend/.env.production") {
    $candidatePaths += "./frontend/.env.preview"
  }

  foreach ($candidate in $candidatePaths) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  throw "Public env file tidak ditemukan. Siapkan frontend/.env.production atau frontend/.env.preview terlebih dulu."
}

function Read-PublicEnvMap {
  param([string]$Path)

  $values = @{}

  foreach ($line in Get-Content $Path) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
      continue
    }

    if ($line -match "^(.*?)=(.*)$") {
      $values[$matches[1].Trim()] = $matches[2].Trim()
    }
  }

  return $values
}

$resolvedEnvFile = Resolve-PublicEnvFile -RequestedPath $PublicEnvFile
$envMap = Read-PublicEnvMap -Path $resolvedEnvFile

foreach ($requiredKey in @("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
  if (-not $envMap.ContainsKey($requiredKey) -or [string]::IsNullOrWhiteSpace($envMap[$requiredKey])) {
    throw "Key $requiredKey tidak ditemukan di $resolvedEnvFile."
  }
}

$env:NEXT_PUBLIC_SUPABASE_URL = $envMap["NEXT_PUBLIC_SUPABASE_URL"]
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $envMap["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
$env:NEXT_PUBLIC_API_BASE_URL = $ApiBaseUrl
$env:NEXT_PUBLIC_APP_ENV = $AppEnv

Write-Host "Building frontend static export with:"
Write-Host "  env file: $resolvedEnvFile"
Write-Host "  NEXT_PUBLIC_API_BASE_URL: $ApiBaseUrl"
Write-Host "  NEXT_PUBLIC_APP_ENV: $AppEnv"

npm run build --workspace frontend
