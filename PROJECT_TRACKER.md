# Tracker y Memoria del Proyecto: Lector y Visualizador Web IEC104

Este documento sirve como memoria de estado para retomar el desarrollo del proyecto en cualquier momento.

## 🎯 Objetivo Principal
Automatizar la recolección diaria de logs SCADA (archivos de texto IEC104), almacenarlos en un servidor NAS histórico, y disponibilizar una Aplicación Web interactiva. Esta aplicación debe permitir consultar, visualizar gráficamente y exportar datos a reportes avanzados en Excel.

---

## 🚦 Estado General del Proyecto
**Estado Actual:** Todas las Fases completadas (0, 1, 2, 3, 4 y 5) ✅. **Sistema funcional completo listo para pruebas y despliegue en producción.**

---

## 📁 Archivos Activos Actuales
*   `backend/main.py`: Servidor API REST FastAPI con autenticación, endpoints SCADA y CRUD de usuarios.
*   `backend/auth.py`: Lógica de autenticación JWT, hashing bcrypt y roles (`admin`/`consultante`). Compatible con Microsoft Entra.
*   `backend/database.py`: Modelo SQLite / SQLAlchemy para control de usuarios autorizados.
*   `backend/parser.py`: Motor de lectura consolidada PC1/PC2, cálculo de estadísticas y exportador `.xlsm`.
*   `backend/install.ps1`: Script PowerShell de instalación y despliegue para el servidor `172.16.231.7`.
*   `DEPLOYMENT_GUIDE.md`: Guía detallada paso a paso de despliegue en servidor.
*   `PlantillaGraficosIEC104.xlsm`: Archivo base con macros VBA para gráficos de series de tiempo.
*   `backup_iec104_nas.ps1`: Script de respaldo diario hacia el NAS histórico.
*   `register_backup_task.ps1`: Tarea programada en Task Scheduler (06:00 AM).
*   `backend/definitions/` e `iec104s-nd/`: Diccionarios de variables SCADA (`.DEF`).

---

## 🗺️ Roadmap y Registro de Progreso (Fases)

### ✅ Fase 0: Prototipo Core de Procesamiento y Excel (COMPLETADO)
*   **Logro:** Construcción del motor en Python que lee, procesa y formatea los datos masivos del SCADA.
*   **Detalles técnicos:** 
    *   Uso de `pandas` para estructuración (pivot tables) y consolidación de máximos, mínimos y promedios.
    *   Solución de tipado de datos en el Eje X de Excel (mantener el índice como objeto datetime numérico real en lugar de string) para asegurar que el gráfico *Scatter* mapee correctamente el tiempo.
    *   Corrección y optimización de macro VBA en la plantilla `.xlsm` para reconocer "Sí/No" en columnas G (Eje Principal) y H (Eje Secundario), y mostrar etiquetas de tiempo inclinadas a 45 grados.

### ✅ Fase 1: Automatización de Respaldo NAS (COMPLETADO)
*   **Logro:** Automatización integral del respaldo diario de los archivos de log del SCADA al NAS. Script probado y tarea programada verificada.
*   **Detalles técnicos:**
    *   `backup_iec104_nas.ps1` (en producción en `D:\RespaldoIEC\`):
        *   Cálculo dinámico de la fecha de "ayer" (`(Get-Date).AddDays(-1)`), desglosada en Día, Mes y Año.
        *   Creación dinámica del árbol de directorios en el NAS: `\\NAS-CHMSF\Respaldo_SCADA\IEC104\PC1\YYYY\MM\`.
        *   Búsqueda de archivos por patrón exacto (`IEC104S_COM_ND104S_LOG<DD>*.txt`).
        *   **Solo copia** (nunca elimina el origen). Verificación de integridad por comparación de tamaños en bytes.
        *   Registro de auditoría en `D:\RespaldoIEC\backup_history.log` con niveles `[INFO]`, `[SUCCESS]`, `[WARN]`, `[ERROR]`.
        *   Autenticación NAS **opcional** vía parámetros `-NasUser` / `-NasPassword`. Si se omiten, usa las credenciales del usuario de Windows. Autenticación implementada con `net use` al share completo (`\\NAS-CHMSF\Respaldo_SCADA`).
        *   `[Console]::OutputEncoding` protegido con `try/catch` para funcionar en Task Scheduler (sin consola).
        *   Soporte para modo simulación (`-WhatIf`) y parámetros configurables (`-SourceDir`, `-NasBaseDir`, `-TargetDate`).
    *   `register_backup_task.ps1`:
        *   Tarea `Respaldo_SCADA_IEC104_NAS` registrada en Task Scheduler, ejecución diaria a las 06:00 AM.
        *   Ruta del script hardcodeada a `D:\RespaldoIEC\backup_iec104_nas.ps1` para evitar problemas con `$PSScriptRoot` vacío en Task Scheduler.
    *   **Verificación:** Tarea ejecutada manualmente con `Start-ScheduledTask` y log monitoreado con `Get-Content -Wait`.

### 🔨 Fase 2: Backend API (Servidor de Datos) (EN PROGRESO)
*   **Objetivo:** Crear un servidor Python que exponga los datos del NAS como una API REST consumible por la aplicación web.
*   **Stack:** Python + FastAPI + Uvicorn + SQLite (BD de usuarios).
*   **Servidor de despliegue:** `172.16.231.7` (también alojará el Frontend).
*   **Desarrollo:** En PC personal, desplegado luego en servidor de producción.
*   **Rutas NAS a consultar (siempre ambas):**
    *   `\\NAS-CHMSF\Respaldo_SCADA\IEC104\PC1\YYYY\MM\*.txt`
    *   `\\NAS-CHMSF\Respaldo_SCADA\IEC104\PC2\YYYY\MM\*.txt`
    *   Estrategia: fusionar datos de ambas fuentes; si un mismo timestamp aparece en ambas, priorizar PC1.
*   **Autenticación de Usuarios:**
    *   Sistema propio temporal con tabla `usuarios` en SQLite.
    *   Campos: `id`, `email` (@celec.gob.ec), `password_hash` (bcrypt), `rol` (`admin` | `consultante`), `activo` (bool), `created_at`.
    *   JWT (JSON Web Tokens) para sesiones sin estado, compatible con futura migración a Microsoft Entra (Azure AD).
    *   **Migración futura a Entra:** El diseño con JWT facilita reemplazar la emisión del token propio por el token OAuth2 de Azure, con mínimos cambios de código.
*   **Carpeta del proyecto:** `backend/`
*   **Endpoints planeados:**
    *   `POST /api/auth/login` → Valida email/clave, retorna JWT.
    *   `GET /api/auth/me` → Retorna perfil del usuario autenticado.
    *   `GET /api/elementos` → Lista variables disponibles (archivos `.DEF`).
    *   `POST /api/datos` → Recibe `{ fecha, hora_inicio, hora_fin }`, busca en PC1+PC2, retorna JSON.
    *   `GET /api/exportar-excel` → Genera y descarga el `.xlsm` con la plantilla.
    *   `GET /api/admin/usuarios` → CRUD de usuarios (solo rol `admin`).
    *   `POST /api/admin/usuarios` → Crear usuario.
    *   `PUT /api/admin/usuarios/{id}` → Editar usuario.
    *   `DELETE /api/admin/usuarios/{id}` → Desactivar usuario.
*   **Tareas completadas:**
    *   [x] Crear estructura de carpetas `backend/` autosuficiente con `definitions/` y `templates/`.
    *   [x] Crear `backend/requirements.txt` con todas las dependencias (`fastapi`, `uvicorn`, `pandas`, `openpyxl`, `sqlalchemy`, `bcrypt`, `python-jose`).
    *   [x] Crear `backend/install.ps1` — script de instalación y registro de servicio para el servidor de producción `172.16.231.7`.
    *   [x] Crear `DEPLOYMENT_GUIDE.md` — guía paso a paso para el despliegue en servidor.
    *   [x] Refactorizar lectura en `backend/parser.py`: búsqueda redundante PC1/PC2, cálculo de estadísticas y generación de `.xlsm` con macros.
    *   [x] Crear modelo de BD SQLite con tabla `usuarios` en `backend/database.py` (SQLAlchemy).
    *   [x] Implementar autenticación JWT y contraseñas seguras con bcrypt en `backend/auth.py`.
    *   [x] Implementar endpoints de Login, Perfil, CRUD de usuarios (admin), Consulta redundante, Exportación Excel y Salud en `backend/main.py`.
    *   [x] Configurar CORS universal para soportar frontend web.
    *   [x] Preparado para futura migración a Microsoft Entra (Azure AD / Office 365).

### ✅ Fase 3: Frontend (Interfaz Web)
*   **Objetivo:** Interfaz gráfica completa para el usuario servida directamente por FastAPI en el puerto 8000.
*   **Tareas completadas:**
    *   [x] Inicializar proyecto modular en `frontend/` con React y Vite.
    *   [x] Implementar sistema de diseño dark industrial SCADA en `index.css` con tipografía Inter y JetBrains Mono.
    *   [x] Implementar barra de navegación con tabs, estado de conectividad con el NAS y perfil de usuario con logout en `Navbar.jsx`.
    *   [x] Crear pantalla de login corporativo con validación `@celec.gob.ec` en `LoginModal.jsx`.
    *   [x] Crear selectores de fecha y horas con accesos rápidos ("15 min", "1 hora", "Día completo") en `QueryFilterBar.jsx`.
    *   [x] Crear vista de datos consolidados con tabla interactiva en `ConsolidatedDataView.jsx`.
    *   [x] Crear panel de administración de usuarios (CRUD para admin) en `UserManagementView.jsx`.

### ✅ Fase 4: Gráficos Web Interactivos (Dashboard)
*   **Objetivo:** Replicar y superar la experiencia del gráfico de Excel en la Web.
*   **Tareas completadas:**
    *   [x] Integrar `Plotly.js` (`react-plotly.js` y `plotly.js-dist-min`) en `DashboardView.jsx`.
    *   [x] Panel lateral de filtrado con buscador de variables y casillas de verificación dinámicas con paleta de colores de alto contraste.
    *   [x] Tooltips nativos sincronizados con fecha, hora y valores reales al pasar el mouse por las curvas.
    *   [x] Tarjetas de estadísticas de redundancia: Total registros consolidados, fuentes PC1 y PC2 leídas.

### ✅ Fase 5: Módulo de Exportación Web a Excel
*   **Objetivo:** Proveer reporte offline preservando la plantilla macro original.
*   **Tareas completadas:**
    *   [x] Habilitar botón "Exportar Excel (.xlsm)" en la barra superior.
    *   [x] Conectar llamada asíncrona al backend para generar el reporte `.xlsm` manteniendo macros VBA, hojas individuales y validaciones.
    *   [x] Descarga automática directa al navegador del usuario.
    *   [x] Servir el frontend compilado (`frontend_dist/`) directamente desde FastAPI sin requerir Node.js en producción.

---
*Nota para el IA: Al cargar este archivo, asimila el contexto de las fases y pregunta al usuario si desea continuar con la Tarea Activa detallada en el próximo paso.*
