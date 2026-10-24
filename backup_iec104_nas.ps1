<#
.SYNOPSIS
    Script de respaldo automatico de logs SCADA IEC104 hacia el servidor NAS.

.DESCRIPTION
    Calcula dinamicamente la fecha del dia anterior (ayer), busca los archivos
    de log correspondientes al dia (ej. *LOG<DD>*.txt), crea la estructura de
    carpetas \\NAS-CHMSF\Respaldo_SCADA\IEC104\PC1\YYYY\MM\ si no existe, y transfiere
    los archivos de forma segura con verificacion de tamano y registro de auditoria.

.PARAMETER SourceDir
    Directorio origen donde residen los logs generados por el SCADA.
    Por defecto es el directorio donde se ubica este script.

.PARAMETER NasBaseDir
    Ruta base compartida en el NAS.
    Por defecto: "\\NAS-CHMSF\Respaldo_SCADA\IEC104\PC1"

.PARAMETER TargetDate
    Fecha objetivo de los logs a respaldar. Por defecto es el dia anterior (ayer).

.PARAMETER NasUser
    Usuario con acceso al recurso compartido del NAS. Dejar vacío si no se requiere autenticación explícita.

.PARAMETER NasPassword
    Contraseña del usuario NAS. Dejar vacío si no se requiere autenticación explícita.

.PARAMETER LogPath
    Ruta del archivo de log local para registrar la actividad del respaldo.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $false)]
    [string]$SourceDir = "D:\home\ems\h9000\his\iec104s", # $PSScriptRoot,

    [Parameter(Mandatory = $false)]
    [string]$NasBaseDir = "\\NAS-CHMSF\Respaldo_SCADA\IEC104\PC1",

    [Parameter(Mandatory = $false)]
    [datetime]$TargetDate = (Get-Date).AddDays(-1),

    [Parameter(Mandatory = $false)]
    [string]$NasUser = "",

    [Parameter(Mandatory = $false)]
    [string]$NasPassword = "",

    [Parameter(Mandatory = $false)]
    [string]$LogPath = (Join-Path $PSScriptRoot "backup_history.log")
)

# Salida de consola en UTF-8 (protegido: puede fallar si no hay consola, ej. Task Scheduler)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "SUCCESS", "WARN", "ERROR")]
        [string]$Level = "INFO"
    )
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logLine = "[$timestamp] [$Level] $Message"
    
    # Color en consola
    switch ($Level) {
        "INFO" { Write-Host $logLine -ForegroundColor Cyan }
        "SUCCESS" { Write-Host $logLine -ForegroundColor Green }
        "WARN" { Write-Host $logLine -ForegroundColor Yellow }
        "ERROR" { Write-Host $logLine -ForegroundColor Red }
    }

    # Guardar en archivo de log (evitando que -WhatIf bloquee el registro)
    try {
        $logDir = Split-Path -Path $LogPath -Parent
        if ($logDir -and -not (Test-Path -Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force -WhatIf:$false | Out-Null
        }
        Add-Content -Path $LogPath -Value $logLine -Encoding UTF8 -WhatIf:$false
    }
    catch {
        Write-Warning "No se pudo escribir en el archivo de log: $_"
    }
}

# --- Autenticacion al recurso NAS (OPCIONAL: solo si se especifican credenciales) ---
# Si NasUser esta vacio, el script usa las credenciales del usuario de Windows que lo ejecuta.
if ($NasUser -ne "") {
    # Necesitamos el share UNC: \\SERVIDOR\Share (los dos primeros segmentos del path)
    # Ejemplo: \\NAS-CHMSF\Respaldo_SCADA\IEC104\PC1 -> \\NAS-CHMSF\Respaldo_SCADA
    $nasParts = $NasBaseDir.TrimStart('\') -split '\\'
    $nasShareUNC = "\\\\$($nasParts[0])\$($nasParts[1])"
    Write-Log "Autenticando en NAS ($nasShareUNC) con usuario: $NasUser"
    try {
        $securePass = ConvertTo-SecureString $NasPassword -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential($NasUser, $securePass)
        # Usar net use para mapear la conexion autenticada al share
        $netUseResult = net use $nasShareUNC /user:$NasUser $NasPassword 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "net use devolvio error: $netUseResult"
        }
        Write-Log "Autenticacion exitosa en el NAS ($nasShareUNC)." -Level "SUCCESS"
    }
    catch {
        Write-Log "Error de autenticacion en el NAS: $_" -Level "ERROR"
        Write-Log "Intente ejecutar el script sin credenciales si el usuario del sistema ya tiene acceso al NAS." -Level "WARN"
        exit 1
    }
}
else {
    Write-Log "Sin credenciales explicitas: usando autenticacion del usuario del sistema operativo."
}

Write-Log "=========================================================="
Write-Log "Iniciando proceso de COPIA (sin eliminar origen) SCADA IEC104"
Write-Log "Origen: $SourceDir"
Write-Log "Destino base NAS: $NasBaseDir"

# 1. Calcular fecha objetivo (ayer) y componentes de ruta
$yearStr = $TargetDate.ToString("yyyy")
$monthStr = $TargetDate.ToString("MM")
$dayStr = $TargetDate.ToString("dd")
$targetDateStr = $TargetDate.ToString("yyyy-MM-dd")

Write-Log "Fecha objetivo de respaldo: $targetDateStr (Dia: $dayStr, Mes: $monthStr, Ano: $yearStr)"

# 2. Validar directorio origen
if (-not (Test-Path -Path $SourceDir)) {
    Write-Log "El directorio origen no existe: $SourceDir" -Level "ERROR"
    exit 1
}

# 3. Definir y asegurar carpeta de destino en el NAS (\\NAS-CHMSF\Respaldo_SCADA\IEC104\YYYY\MM)
$destFolder = Join-Path $NasBaseDir "$yearStr\$monthStr"
Write-Log "Ruta destino calculada: $destFolder"

if ($PSCmdlet.ShouldProcess($destFolder, "Verificar/Crear directorio destino en NAS")) {
    try {
        if (-not (Test-Path -Path $destFolder)) {
            Write-Log "Creando estructura de carpetas en NAS: $destFolder"
            New-Item -ItemType Directory -Path $destFolder -Force | Out-Null
            Write-Log "Directorio creado exitosamente." -Level "SUCCESS"
        }
        else {
            Write-Log "El directorio destino ya existe en el NAS."
        }
    }
    catch {
        Write-Log "Error al acceder o crear el directorio en el NAS ($destFolder): $_" -Level "ERROR"
        Write-Log "Verifique conectividad de red y permisos de acceso al recurso compartido." -Level "ERROR"
        exit 2
    }
}

# 4. Buscar archivos de log de la fecha objetivo
# Patron correspondiente a los logs diarios del SCADA: *LOG<DD>*.txt
# $searchPattern = "*LOG$dayStr*.txt"
$searchPattern = "IEC104S_COM_ND104S_LOG$dayStr*.txt"
Write-Log "Buscando archivos con patron: '$searchPattern' en '$SourceDir'..."

$matchingFiles = Get-ChildItem -Path $SourceDir -Filter $searchPattern -File | Where-Object {
    $_.FullName -ne (Resolve-Path -Path $LogPath -ErrorAction SilentlyContinue)
}

if (-not $matchingFiles -or $matchingFiles.Count -eq 0) {
    Write-Log "No se encontraron archivos de log para el dia $dayStr ($targetDateStr)." -Level "WARN"
    Write-Log "Proceso finalizado sin archivos transferidos."
    exit 0
}

Write-Log "Se encontraron $($matchingFiles.Count) archivo(s) para respaldar:"
foreach ($f in $matchingFiles) {
    $sizeMB = [math]::Round($f.Length / 1MB, 2)
    Write-Log " - $($f.Name) ($sizeMB MB)"
}

# 5. Copia segura con verificacion de integridad (el archivo origen NUNCA se elimina)
$successCount = 0
$errorCount = 0

foreach ($file in $matchingFiles) {
    $targetFilePath = Join-Path $destFolder $file.Name

    if ($PSCmdlet.ShouldProcess($file.FullName, "Copiar hacia $targetFilePath")) {
        try {
            Write-Log "Copiando: $($file.Name) ..."
            
            # Copiar con sobreescritura controlada
            Copy-Item -Path $file.FullName -Destination $targetFilePath -Force
            
            # Verificacion de integridad (existencia y tamano identico)
            if (Test-Path -Path $targetFilePath) {
                $destItem = Get-Item -Path $targetFilePath
                if ($destItem.Length -eq $file.Length) {
                    Write-Log "Copia verificada con exito: $($file.Name) ($($destItem.Length) bytes)" -Level "SUCCESS"
                    Write-Log "Archivo origen conservado en: $($file.FullName)"
                    $successCount++
                }
                else {
                    Write-Log "Discrepancia en tamano de archivo: Destino=$($destItem.Length) vs Origen=$($file.Length)" -Level "ERROR"
                    $errorCount++
                }
            }
            else {
                Write-Log "El archivo destino no existe tras la copia: $targetFilePath" -Level "ERROR"
                $errorCount++
            }
        }
        catch {
            Write-Log "Fallo al copiar $($file.Name): $_" -Level "ERROR"
            $errorCount++
        }
    }
}

Write-Log "=========================================================="
Write-Log "Resumen del Respaldo: $successCount exitoso(s), $errorCount error(es)." -Level $(if ($errorCount -gt 0) { "WARN" } else { "SUCCESS" })
Write-Log "Fin del proceso de respaldo."
Write-Log "=========================================================="

if ($errorCount -gt 0) {
    exit 3
}
else {
    exit 0
}
