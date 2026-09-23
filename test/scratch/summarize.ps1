$ErrorActionPreference = "SilentlyContinue"
$eslint = Get-Content eslint_output.json | ConvertFrom-Json
$errCount = 0
$warnCount = 0
foreach($f in $eslint) {
    $errCount += $f.errorCount
    $warnCount += $f.warningCount
}
$audit = Get-Content npm_audit.json | ConvertFrom-Json
$crit = $audit.metadata.vulnerabilities.critical
$high = $audit.metadata.vulnerabilities.high
$moderate = $audit.metadata.vulnerabilities.moderate
$low = $audit.metadata.vulnerabilities.low

$buildOut = Get-Content build_output.txt -Tail 20 | Out-String

$report = @{
    eslintErr = $errCount
    eslintWarn = $warnCount
    auditCrit = $crit
    auditHigh = $high
    auditMod = $moderate
    auditLow = $low
    buildOut = $buildOut
}
$report | ConvertTo-Json | Out-File summary.json -Encoding utf8
