<#
.SYNOPSIS
    BulletBoost Local Demonstration & Development Startup Script
.DESCRIPTION
    Resolves project root, verifies prerequisites (Python, Node.js, dependencies, ML artifacts, Ollama),
    reliably starts FastAPI backend, verifies backend health, and launches Vite frontend.
#>

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   BulletBoost - Resume Bullet-Point Enhancer" -ForegroundColor Green
Write-Host "   Local Demonstration & Development Environment" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 0. Resolve Project Root Directory
$ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ProjectRoot) { $ProjectRoot = (Get-Location).Path }
Set-Location $ProjectRoot
Write-Host "Project Root: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# 1. Check Python installation (3.10+)
Write-Host "[1/7] Checking Python installation..." -ForegroundColor Yellow
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Error "Python was not found in PATH. Please install Python 3.10+ and add it to your PATH."
    exit 1
}
$pyVersion = python --version
Write-Host "  Found: $pyVersion" -ForegroundColor Green

# Verify Python version >= 3.10
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Python 3.10 or higher is required. Found $pyVersion"
    exit 1
}

# 2. Check Node.js and npm
Write-Host "[2/7] Checking Node.js and npm..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $nodeCmd -or -not $npmCmd) {
    Write-Error "Node.js or npm was not found in PATH. Please install Node.js 18+ and npm."
    exit 1
}
$nodeVersion = node --version
$npmVersion = npm --version
Write-Host "  Found: Node.js $nodeVersion (npm $npmVersion)" -ForegroundColor Green

# 3. Check Backend and Frontend Dependencies
Write-Host "[3/7] Verifying dependencies..." -ForegroundColor Yellow

# Backend dependencies verification
Write-Host "  Checking Python backend packages..." -ForegroundColor Gray
$depCheckOutput = python -c "
import sys
missing = []
for pkg in ['fastapi', 'uvicorn', 'pydantic', 'pypdf', 'docx', 'multipart', 'sklearn', 'joblib', 'pandas', 'numpy']:
    try:
        __import__(pkg)
    except ImportError:
        missing.append(pkg)
if missing:
    print('MISSING:' + ','.join(missing))
    sys.exit(1)
else:
    print('OK')
"
if ($LASTEXITCODE -ne 0 -or $depCheckOutput -like "MISSING*") {
    Write-Error "Missing Python backend dependencies: $depCheckOutput"
    Write-Host "Please install them with: pip install -r backend/requirements.txt" -ForegroundColor Yellow
    exit 1
}
Write-Host "  All required Python packages verified." -ForegroundColor Green

# Frontend dependencies verification
$nodeModulesDir = Join-Path $ProjectRoot "node_modules"
if (-not (Test-Path $nodeModulesDir)) {
    Write-Error "Frontend dependencies (node_modules) are not installed."
    Write-Host "Please install frontend dependencies with: npm install" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Frontend node_modules verified." -ForegroundColor Green

# 4. Check ML Classifier Artifacts
Write-Host "[4/7] Checking Custom ML Classifier model artifacts..." -ForegroundColor Yellow
$modelPath = Join-Path $ProjectRoot "backend\models\bullet_classifier.joblib"
$reportPath = Join-Path $ProjectRoot "backend\models\evaluation_report.json"
if (-not (Test-Path $modelPath) -or -not (Test-Path $reportPath)) {
    Write-Host "  Model artifacts missing. Training reproducible scikit-learn classifier..." -ForegroundColor Yellow
    $trainScript = Join-Path $ProjectRoot "backend\scripts\train_classifier.py"
    python $trainScript
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to train classifier. Check backend/scripts/train_classifier.py"
        exit 1
    }
}
Write-Host "  Model artifacts and evaluation report verified." -ForegroundColor Green

# 5. Check Ollama Status
Write-Host "[5/7] Checking Local Ollama service..." -ForegroundColor Yellow
$ollamaStatusText = "Unavailable (Demo fallback active)"
try {
    $res = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host "  Ollama service is RUNNING at http://localhost:11434" -ForegroundColor Green

    $modelNames = $res.models | ForEach-Object { $_.name }
    $hasModel = $modelNames | Where-Object { $_ -like "llama3.2:3b*" -or $_ -like "llama3.2*" }
    if ($hasModel) {
        Write-Host "  Configured model found: $hasModel" -ForegroundColor Green
        $ollamaStatusText = "Running (llama3.2:3b ready)"
    } else {
        Write-Warning "  Target model 'llama3.2:3b' is not installed in Ollama."
        Write-Host "  To install the model, run in a separate terminal: ollama pull llama3.2:3b" -ForegroundColor Cyan
        Write-Host "  Resume parsing and demo enhancements will function normally." -ForegroundColor Gray
        $ollamaStatusText = "Running, but llama3.2:3b not pulled"
    }
} catch {
    Write-Warning "  Ollama is NOT running at http://localhost:11434."
    Write-Host "  To enable local LLM enhancement, start Ollama Desktop or run 'ollama serve'." -ForegroundColor Cyan
    Write-Host "  BulletBoost will parse resumes normally and offer demo enhancement." -ForegroundColor Gray
    $ollamaStatusText = "Not running (demo fallback active)"
}

# 6. Start Backend FastAPI Server
Write-Host "[6/7] Starting Python FastAPI Backend on port 8000..." -ForegroundColor Yellow

$backendNeedsLaunch = $true
$existingPortConn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

if ($existingPortConn) {
    $owningPid = ($existingPortConn | Select-Object -First 1).OwningProcess
    # Check if the process occupying port 8000 is already a healthy BulletBoost API
    $isAlreadyBulletBoost = $false
    try {
        $healthTest = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
        if ($healthTest.status -eq "ok" -or $healthTest.app -like "*BulletBoost*") {
            $isAlreadyBulletBoost = $true
        }
    } catch {
        $isAlreadyBulletBoost = $false
    }

    if ($isAlreadyBulletBoost) {
        Write-Host "  Port 8000 is already running a healthy BulletBoost FastAPI instance (PID: $owningPid). Reusing." -ForegroundColor Green
        $backendNeedsLaunch = $false
    } else {
        $proc = Get-Process -Id $owningPid -ErrorAction SilentlyContinue
        $procName = if ($proc) { $proc.ProcessName } else { "Unknown" }
        Write-Error "Port 8000 is occupied by process '$procName' (PID: $owningPid), which is not a healthy BulletBoost API instance."
        Write-Host "BulletBoost cannot bind to port 8000 while another process is using it." -ForegroundColor Red
        Write-Host "Please terminate the conflicting process or close the application occupying port 8000 before running start_local.ps1." -ForegroundColor Yellow
        exit 1
    }
}

if ($backendNeedsLaunch) {
    $backendProcess = Start-Process powershell -WorkingDirectory $ProjectRoot -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting BulletBoost FastAPI Server on http://127.0.0.1:8000...' -ForegroundColor Cyan; python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload" -PassThru
    Write-Host "  Backend process launched (PID: $($backendProcess.Id))." -ForegroundColor Gray
    Write-Host "  Waiting for backend health check at http://127.0.0.1:8000/api/health..." -ForegroundColor Yellow

    $backendHealthy = $false
    $maxWaitSec = 25
    $elapsed = 0
    while ($elapsed -lt $maxWaitSec) {
        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
        if ($backendProcess.HasExited) {
            Write-Error "FastAPI backend process exited unexpectedly with code $($backendProcess.ExitCode)."
            Write-Host "Please check the backend PowerShell terminal window for errors." -ForegroundColor Red
            exit 1
        }
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($h.status -eq "ok" -or $h.app -like "*BulletBoost*") {
                $backendHealthy = $true
                break
            }
        } catch {
            # Continue waiting
        }
    }

    if (-not $backendHealthy) {
        Write-Error "FastAPI backend failed to respond at http://127.0.0.1:8000/api/health within $maxWaitSec seconds."
        Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
        Write-Host "  1. Check the opened Backend PowerShell window for Python traceback messages." -ForegroundColor Yellow
        Write-Host "  2. Test manually: cd '$ProjectRoot'; python -m uvicorn backend.app.main:app --port 8000" -ForegroundColor Yellow
        Write-Host "  3. Verify port 8000 is not blocked by Windows Firewall or security software." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  FastAPI backend verified healthy (status: ok)!" -ForegroundColor Green
}

# 7. Start Frontend Vite Server (Only after backend is confirmed healthy)
Write-Host "[7/7] Checking React/Vite Frontend..." -ForegroundColor Yellow

$detectedVitePort = $null
$existingViteConns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -ge 5173 -and $_.LocalPort -le 5180 }
if ($existingViteConns) {
    foreach ($conn in $existingViteConns) {
        $p = $conn.LocalPort
        try {
            $testRes = Invoke-WebRequest -Uri "http://localhost:$p" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($testRes.StatusCode -eq 200) {
                $detectedVitePort = $p
                $owningVitePid = $conn.OwningProcess
                Write-Host "  Frontend Vite server is already running on http://localhost:$detectedVitePort (PID: $owningVitePid). Reusing." -ForegroundColor Green
                break
            }
        } catch {
            # Try next port if any
        }
    }
}

if (-not $detectedVitePort) {
    Write-Host "  Starting Vite dev server in a new window..." -ForegroundColor Yellow
    $frontendProcess = Start-Process powershell -WorkingDirectory $ProjectRoot -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting BulletBoost Vite Dev Server...' -ForegroundColor Cyan; npm run dev" -PassThru
    Write-Host "  Frontend process launched (PID: $($frontendProcess.Id)). Waiting for port allocation..." -ForegroundColor Gray
    
    $waitViteSec = 15
    $elapsedVite = 0
    while ($elapsedVite -lt $waitViteSec -and -not $detectedVitePort) {
        Start-Sleep -Milliseconds 500
        $elapsedVite += 0.5
        $newConns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -ge 5173 -and $_.LocalPort -le 5180 }
        foreach ($conn in $newConns) {
            $p = $conn.LocalPort
            try {
                $testRes = Invoke-WebRequest -Uri "http://localhost:$p" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
                if ($testRes.StatusCode -eq 200) {
                    $detectedVitePort = $p
                    break
                }
            } catch {
                # continue polling
            }
        }
    }
}

$frontendUrl = if ($detectedVitePort) { "http://localhost:$detectedVitePort" } else { "http://localhost:5173 (Port not confirmed yet)" }
Write-Host "  Frontend active at: $frontendUrl" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   BulletBoost is ready for Demonstration!" -ForegroundColor Green
Write-Host "   Frontend Application:  $frontendUrl" -ForegroundColor Cyan
Write-Host "   Backend API Health:    http://127.0.0.1:8000/api/health" -ForegroundColor Cyan
Write-Host "   Swagger API Docs:      http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "   Ollama Status:         $ollamaStatusText" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter to exit this launcher (services will remain running in their windows)."
Read-Host
