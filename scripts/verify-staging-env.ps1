<#
.SYNOPSIS
  Read-only preflight for local staging environment files. Makes no network calls.
.DESCRIPTION
  Requires explicit, independently verified staging and production Supabase project refs
  and the expected staging API URL. Prints checks only; never prints env values or secrets.
  This is an operator preflight, not a substitute for provider-side environment separation.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $StagingProjectRef,
  [Parameter(Mandatory = $true)] [string] $ProductionProjectRef,
  [Parameter(Mandatory = $true)] [uri] $ExpectedStagingApiUrl,
  [string] $ApiEnvFile = 'apps/api/.env.staging',
  [string] $WebEnvFile = 'apps/web/.env.staging'
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

function Read-EnvFile([string] $Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Required environment file is missing: $Path"
  }
  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
  }
  return $values
}

function Check([string] $Name, [bool] $Passed) {
  if ($Passed) { Write-Output "PASS $Name" }
  else { Write-Output "FAIL $Name"; $failures.Add($Name) }
}

Check 'staging and production project refs are both explicit and different' (
  -not [string]::IsNullOrWhiteSpace($StagingProjectRef) -and
  -not [string]::IsNullOrWhiteSpace($ProductionProjectRef) -and
  $StagingProjectRef -ne $ProductionProjectRef
)

try { $api = Read-EnvFile $ApiEnvFile } catch { Write-Output "FAIL API staging env file exists and parses"; exit 1 }
try { $web = Read-EnvFile $WebEnvFile } catch { Write-Output "FAIL web staging env file exists and parses"; exit 1 }

$apiRef = ''
$webRef = ''
$apiUrlValid = $false
$webUrlValid = $false
try {
  $apiUri = [uri]$api['SUPABASE_URL']
  $apiRef = $apiUri.Host.Split('.')[0]
  $apiUrlValid = $apiUri.Scheme -eq 'https' -and $apiUri.Host -eq "$StagingProjectRef.supabase.co"
} catch {}
try {
  $webUri = [uri]$web['NEXT_PUBLIC_SUPABASE_URL']
  $webRef = $webUri.Host.Split('.')[0]
  $webUrlValid = $webUri.Scheme -eq 'https' -and $webUri.Host -eq "$StagingProjectRef.supabase.co"
} catch {}

Check 'API Supabase URL matches the explicit staging project ref over HTTPS' $apiUrlValid
Check 'web Supabase URL matches the same explicit staging project ref over HTTPS' $webUrlValid
Check 'API and web Supabase project refs match' ($apiRef -eq $webRef -and $apiRef -eq $StagingProjectRef)
Check 'staging project ref differs from production ref' ($StagingProjectRef -ne $ProductionProjectRef)

$apiKey = [string]$api['SUPABASE_SERVICE_ROLE_KEY']
Check 'API has a non-placeholder server service key' (
  -not [string]::IsNullOrWhiteSpace($apiKey) -and
  $apiKey -notin @('dummy_key', 'changeme', 'your-service-role-key', '<staging-service-role-secret-from-secret-manager>')
)
Check 'web environment contains no service-role key variable' (
  -not ($web.Keys | Where-Object { $_ -match 'SERVICE_ROLE|SECRET_KEY' })
)
Check 'dispensing mode is explicitly legacy' ($api['PRESCRIPTION_WRITE_MODE'] -eq 'legacy')

$configuredApiUrlValid = $false
try {
  $configuredApiUri = [uri]$web['NEXT_PUBLIC_API_URL']
  $configuredApiUrlValid = $configuredApiUri.Scheme -eq $ExpectedStagingApiUrl.Scheme -and
    $configuredApiUri.Authority -eq $ExpectedStagingApiUrl.Authority -and
    $configuredApiUri.AbsolutePath.TrimEnd('/') -eq $ExpectedStagingApiUrl.AbsolutePath.TrimEnd('/')
} catch {}
Check 'web API URL matches the explicit expected staging API origin' $configuredApiUrlValid

if ($failures.Count -gt 0) {
  Write-Output "NO-GO: $($failures.Count) staging environment check(s) failed. No values or secrets were printed."
  exit 1
}
Write-Output 'GO for configuration preflight only. This does not authorize remote access, migrations, deployment, or data changes.'
