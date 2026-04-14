param(
  [Parameter(Mandatory = $true)]
  [string]$BackendUrl,
  [string]$FrontendUrl,
  [string]$ExpectedMilestone = "10-deployment",
  [string]$ExpectedAppEnvironment,
  [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

function Assert-Condition {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Join-Url {
  param(
    [string]$BaseUrl,
    [string]$Path
  )

  $normalizedBaseUrl = $BaseUrl.TrimEnd("/")

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return $normalizedBaseUrl
  }

  if ($Path.StartsWith("/")) {
    return "$normalizedBaseUrl$Path"
  }

  return "$normalizedBaseUrl/$Path"
}

function Invoke-DeploymentRequest {
  param([string]$Url)

  return Invoke-WebRequest -Uri $Url -MaximumRedirection 5 -TimeoutSec $TimeoutSeconds
}

function Test-FrontendRoute {
  param(
    [string]$BaseUrl,
    [string]$Path
  )

  $url = Join-Url -BaseUrl $BaseUrl -Path $Path
  $response = Invoke-DeploymentRequest -Url $url

  Assert-Condition ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) "Frontend route gagal diakses: $url"

  Write-Host ("[frontend] OK " + $url)
}

$healthUrl = Join-Url -BaseUrl $BackendUrl -Path "/health"
$backendResponse = Invoke-DeploymentRequest -Url $healthUrl
$backendPayload = $backendResponse.Content | ConvertFrom-Json

Assert-Condition ($backendResponse.StatusCode -eq 200) "Health check backend gagal dengan status $($backendResponse.StatusCode)."
Assert-Condition ($backendPayload.success -eq $true) "Response health backend tidak mengembalikan success=true."
Assert-Condition ($backendPayload.data.status -eq "ok") "Status backend bukan ok."
Assert-Condition ($backendPayload.data.environment.isReady -eq $true) "Backend production belum memiliki environment lengkap."
Assert-Condition ($backendPayload.data.milestone -eq $ExpectedMilestone) "Milestone backend tidak cocok. Dapat: $($backendPayload.data.milestone)."
Assert-Condition (-not [string]::IsNullOrWhiteSpace([string]$backendResponse.Headers["x-request-id"])) "Header x-request-id tidak ditemukan pada response backend."

if (-not [string]::IsNullOrWhiteSpace($ExpectedAppEnvironment)) {
  Assert-Condition ($backendPayload.data.appEnvironment -eq $ExpectedAppEnvironment) "APP_ENV backend tidak cocok. Dapat: $($backendPayload.data.appEnvironment)."
}

Write-Host ("[backend] OK " + $healthUrl)
Write-Host ("[backend] x-request-id " + $backendResponse.Headers["x-request-id"])

if (-not [string]::IsNullOrWhiteSpace($FrontendUrl)) {
  $frontendRoutes = @("/", "/login/", "/scan/")

  foreach ($route in $frontendRoutes) {
    Test-FrontendRoute -BaseUrl $FrontendUrl -Path $route
  }
}

Write-Host ""
Write-Host "Smoke test deployment lulus."
