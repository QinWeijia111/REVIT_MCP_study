# 完整結構檢查腳本
# 確認所有路徑參照的一致性

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Complete Structure Check" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "C:\Users\01102088\Desktop\revit\REVIT_MCP_study"
$errors = @()
$warnings = @()
$passed = @()

# Check 1: Project files
Write-Host "[1] Checking Project Files..." -ForegroundColor Cyan
if (Test-Path "$projectRoot\MCP\RevitMCP.2024.csproj") {
    $passed += "✅ MCP\RevitMCP.2024.csproj exists"
}
else {
    $errors += "❌ MCP\RevitMCP.2024.csproj NOT FOUND"
}

# Check 2: Built DLL
Write-Host "[2] Checking Built DLL..." -ForegroundColor Cyan
if (Test-Path "$projectRoot\MCP\bin\Release.2024\RevitMCP.dll") {
    $dll = Get-Item "$projectRoot\MCP\bin\Release.2024\RevitMCP.dll"
    $passed += "✅ DLL built successfully ($($dll.Length) bytes, $($dll.LastWriteTime))"
}
else {
    $warnings += "⚠️  DLL not built yet (run: dotnet build -c Release)"
}

# Check 3: .addin files
Write-Host "[3] Checking .addin Files..." -ForegroundColor Cyan
if (Test-Path "$projectRoot\MCP\RevitMCP.2024.addin") {
    $addin = Get-Content "$projectRoot\MCP\RevitMCP.2024.addin" -Raw
    if ($addin -match '<Assembly>([^<]+)</Assembly>') {
        $assemblyPath = $matches[1]
        $passed += "✅ RevitMCP.2024.addin exists (Assembly: $assemblyPath)"
    }
}
else {
    $errors += "❌ MCP\RevitMCP.2024.addin NOT FOUND"
}

# Check 4: Install scripts
Write-Host "[4] Checking Install Scripts..." -ForegroundColor Cyan
$scriptFiles = @(
    "scripts\install-addon.ps1",
    "scripts\install-addon-bom.ps1"
)

foreach ($script in $scriptFiles) {
    $fullPath = Join-Path $projectRoot $script
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        if ($content -match 'MCP\\\\MCP\\\\') {
            $errors += "❌ $script contains OLD path (MCP\MCP\)"
        }
        elseif ($content -match 'MCP\\\\bin\\\\Release') {
            $passed += "✅ $script uses correct paths (MCP\bin\)"
        }
    }
}

# Check 5: Dependencies
Write-Host "[5] Checking Dependencies..." -ForegroundColor Cyan
$depPaths = @(
    "MCP\bin\Release.2024\Newtonsoft.Json.dll",
    "MCP\bin\Release.2024\RevitMCP.dll"
)

foreach ($dep in $depPaths) {
    $fullPath = Join-Path $projectRoot $dep
    if (Test-Path $fullPath) {
        $passed += "✅ $dep exists"
    }
    else {
        $warnings += "⚠️  $dep not found (may be auto-generated)"
    }
}

# Check 6: Domain files
Write-Host "[6] Checking Domain Files..." -ForegroundColor Cyan
$domainFiles = @(
    "domain\element-coloring-workflow.md",
    "domain\room-boundary.md"
)

foreach ($domain in $domainFiles) {
    if (Test-Path (Join-Path $projectRoot $domain)) {
        $passed += "✅ $domain exists"
    }
}

# Check 7: MCP-Server
Write-Host "[7] Checking MCP-Server..." -ForegroundColor Cyan
if (Test-Path "$projectRoot\MCP-Server\build\index.js") {
    $passed += "✅ MCP-Server built"
}
else {
    $warnings += "⚠️  MCP-Server not built (run: npm run build)"
}

# Summary
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Check Results" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($p in $passed) {
    Write-Host $p -ForegroundColor Green
}

foreach ($w in $warnings) {
    Write-Host $w -ForegroundColor Yellow
}

foreach ($e in $errors) {
    Write-Host $e -ForegroundColor Red
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Passed : $($passed.Count)" -ForegroundColor Green
Write-Host "  Warnings: $($warnings.Count)" -ForegroundColor Yellow
Write-Host "  Errors : $($errors.Count)" -ForegroundColor Red
Write-Host ""

if ($errors.Count -gt 0) {
    Write-Host "❌ FAILED: Please fix errors before deployment" -ForegroundColor Red
    exit 1
}
elseif ($warnings.Count -gt 0) {
    Write-Host "⚠️  WARNINGS: Review warnings before deployment" -ForegroundColor Yellow
    exit 0
}
else {
    Write-Host "✅ ALL CHECKS PASSED: Ready for deployment" -ForegroundColor Green
    exit 0
}
