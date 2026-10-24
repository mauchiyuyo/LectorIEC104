<#
.SYNOPSIS
    Script de instalacion del backend SCADA IEC104 para el servidor de produccion.
.DESCRIPTION
    Crea el entorno virtual, instala dependencias y registra el servicio de Windows
    para que el servidor FastAPI inicie automaticamente con el sistema.
    Debe ejecutarse como Administrador en el servidor 172.16.231.7.
#>

$ErrorActionPreference = "Stop"
$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonExe  = "python"
$ServiceName = "SCADA_IEC104_API"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Instalador del Backend SCADA IEC104 API" -ForegroundColor Cyan
Write-Host " Directorio: $BackendDir" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Verificar Python
try {
    $pyVersion = & $PythonExe --version 2>&1
    Write-Host "[OK] Python encontrado: $pyVersion" -ForegroundColor Green
} catch {
    Write-Error "Python no encontrado en PATH. Instala Python 3.10+ y vuelve a ejecutar."
    exit 1
}

# 2. Crear entorno virtual
$venvDir = Join-Path $BackendDir "venv"
if (-not (Test-Path $venvDir)) {
    Write-Host "[...] Creando entorno virtual en $venvDir ..."
    & $PythonExe -m venv $venvDir
    Write-Host "[OK] Entorno virtual creado." -ForegroundColor Green
} else {
    Write-Host "[OK] Entorno virtual ya existe." -ForegroundColor Yellow
}

# 3. Instalar dependencias
$pipExe = Join-Path $venvDir "Scripts\pip.exe"
$reqFile = Join-Path $BackendDir "requirements.txt"
Write-Host "[...] Instalando dependencias desde requirements.txt ..."
& $pipExe install --upgrade pip | Out-Null
& $pipExe install -r $reqFile
Write-Host "[OK] Dependencias instaladas." -ForegroundColor Green

# 4. Registrar como servicio de Windows con NSSM (si esta disponible)
#    Si no tienes NSSM, el script imprime el comando para arranque manual.
$nssmExe = "nssm.exe"
$uvicornExe = Join-Path $venvDir "Scripts\uvicorn.exe"
$mainModule  = "main:app"

if (Get-Command $nssmExe -ErrorAction SilentlyContinue) {
    Write-Host "[...] Registrando servicio Windows '$ServiceName' con NSSM ..."
    & $nssmExe install $ServiceName $uvicornExe "$mainModule --host 0.0.0.0 --port 8000 --workers 2"
    & $nssmExe set $ServiceName AppDirectory $BackendDir
    & $nssmExe set $ServiceName DisplayName "SCADA IEC104 API Backend"
    & $nssmExe set $ServiceName Description "Servidor FastAPI para consulta historica de logs IEC104"
    & $nssmExe set $ServiceName Start SERVICE_AUTO_START
    Start-Service -Name $ServiceName
    Write-Host "[OK] Servicio '$ServiceName' registrado e iniciado." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host " NSSM no encontrado. Para arranque automatico instala NSSM:" -ForegroundColor Yellow
    Write-Host "   https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host ""
    Write-Host " Para iniciar el servidor MANUALMENTE ejecuta:" -ForegroundColor Yellow
    Write-Host "   cd `"$BackendDir`"" -ForegroundColor White
    Write-Host "   .\venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000" -ForegroundColor White
    Write-Host "============================================================" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[LISTO] Instalacion completada. API disponible en http://172.16.231.7:8000" -ForegroundColor Green
Write-Host "         Documentacion Swagger: http://172.16.231.7:8000/docs" -ForegroundColor Green
