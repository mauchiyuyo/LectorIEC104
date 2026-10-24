<#
.SYNOPSIS
    Registra la tarea programada en Windows Task Scheduler para ejecutar el respaldo diario a las 06:00 AM.

.DESCRIPTION
    Crea o actualiza la tarea "Respaldo_SCADA_IEC104_NAS" configurada para correr diariamente
    a las 06:00 AM invocando el script backup_iec104_nas.ps1.

.PARAMETER TaskName
    Nombre de la tarea programada. Por defecto: "Respaldo_SCADA_IEC104_NAS"

.PARAMETER TriggerTime
    Hora diaria de ejecución en formato HH:mm. Por defecto: "06:00"

.PARAMETER ScriptPath
    Ruta completa al script de respaldo backup_iec104_nas.ps1.
#>

[CmdletBinding()]
param(
    [string]$TaskName = "Respaldo_SCADA_IEC104_NAS",
    [string]$TriggerTime = "06:00",
    # IMPORTANTE: Se usa la ruta absoluta porque $PSScriptRoot puede quedar vacio
    # cuando el Programador de Tareas lanza el script en segundo plano.
    [string]$ScriptPath = "D:\RespaldoIEC\backup_iec104_nas.ps1"
)

Write-Host "Configurando Tarea Programada de Windows..." -ForegroundColor Cyan
Write-Host "Nombre: $TaskName"
Write-Host "Hora de ejecución: $TriggerTime (Diaria)"
Write-Host "Script: $ScriptPath"

if (-not (Test-Path -Path $ScriptPath)) {
    Write-Error "No se encontró el script en: $ScriptPath"
    exit 1
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$ScriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At $TriggerTime

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$description = "Respaldo automático diario de logs SCADA IEC104 hacia el servidor NAS histórico."

try {
    # Registrar o actualizar tarea para el usuario actual
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description $description `
        -Force | Out-Null

    Write-Host "Tarea programada '$TaskName' registrada exitosamente." -ForegroundColor Green
    Write-Host "Puede consultarla o probarla en el 'Programador de tareas' (Task Scheduler) de Windows." -ForegroundColor Green
}
catch {
    Write-Warning "Fallo al registrar la tarea con cmdlets nativos: $_"
    Write-Host "Intentando método alternativo mediante schtasks.exe..." -ForegroundColor Yellow
    
    $cmd = "schtasks.exe /Create /TN `"$TaskName`" /TR `"powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \`"$ScriptPath\`"`" /SC DAILY /ST $TriggerTime /F"
    Invoke-Expression $cmd
}
