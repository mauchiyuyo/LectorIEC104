# Guía de Instalación y Despliegue en Servidor (172.16.231.7)

Esta guía describe el procedimiento paso a paso para desplegar el servidor Backend (FastAPI) y configurar las dependencias necesarias en la máquina de producción `172.16.231.7`.

---

## 1. Arquitectura y Ubicaciones

* **Servidor de Aplicación:** `172.16.231.7` (Windows).
* **Puerto Backend:** `8000` (http://172.16.231.7:8000).
* **Repositorio NAS de Archivos SCADA:** `\\NAS-CHMSF\Respaldo_SCADA\IEC104`
  * Redundancia PC1: `\\NAS-CHMSF\Respaldo_SCADA\IEC104\PC1\YYYY\MM\*.txt`
  * Redundancia PC2: `\\NAS-CHMSF\Respaldo_SCADA\IEC104\PC2\YYYY\MM\*.txt`
* **Base de Datos de Usuarios:** SQLite local (`backend/scada_iec104.db`).

---

## 2. Requisitos Previos en el Servidor (172.16.231.7)

1. **Python 3.10 o superior**:
   * Descargar el instalador oficial de [python.org](https://www.python.org/downloads/).
   * **Importante:** Marcar la casilla **"Add python.exe to PATH"** durante la instalación.
2. **Acceso de red al NAS:**
   * Abrir el explorador de Windows en `172.16.231.7` y verificar que se puede ingresar a `\\NAS-CHMSF\Respaldo_SCADA\IEC104`.
   * Si solicita credenciales, marcar **"Recordar mis credenciales"** para que queden guardadas en el Administrador de Credenciales de Windows para la cuenta que ejecuta el servicio.
3. **Regla de Firewall de Windows (Puerto 8000):**
   * Permitir tráfico entrante en el puerto TCP 8000 para que los usuarios autorizados de la red corporativa puedan conectarse a la API y Web.

---

## 3. Instalación Paso a Paso

### Paso 1: Copiar los Archivos del Proyecto
Copiar la carpeta `backend` desde su máquina de desarrollo al servidor de producción, por ejemplo a:
```
C:\SCADA_IEC104\backend\
```
La carpeta debe incluir:
* `main.py`
* `auth.py`
* `database.py`
* `parser.py`
* `requirements.txt`
* `install.ps1`
* Carpeta `definitions\` (contiene los archivos `.DEF`)
* Carpeta `templates\` (contiene `PlantillaGraficosIEC104.xlsm`)
* Carpeta `frontend_dist\` (contiene la interfaz web React compilada para ser servida en la raíz `/`)

### Paso 2: Ejecutar el Script de Instalación Automática
Abrir **PowerShell** en el servidor como **Administrador** y ejecutar:

```powershell
# Navegar al directorio donde se copió el backend
cd C:\SCADA_IEC104\backend

# Permitir ejecución de scripts en esta sesión (si estuviera restringido)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Ejecutar el instalador automático
.\install.ps1
```

**Lo que hace automáticamente `install.ps1`:**
1. Valida la presencia de Python en el sistema.
2. Crea el entorno virtual aislado (`venv`).
3. Instala todas las librerías necesarias especificadas en `requirements.txt`:
   * `fastapi` y `uvicorn` (Servidor REST asíncrono)
   * `pandas` y `openpyxl` (Procesamiento de datos y exportación con macros)
   * `sqlalchemy` (Gestión de base de datos de usuarios)
   * `python-jose` y `bcrypt` (Criptografía y tokens JWT)
4. Si detecta [NSSM (Non-Sucking Service Manager)](https://nssm.cc/), registra e inicia automáticamente el servicio de Windows `SCADA_IEC104_API` para que arranque solo al encender el servidor.

---

## 4. Inicio Manual del Servidor (Alternativa sin NSSM)

Si no desea instalar como servicio de Windows y prefiere iniciarlo manualmente o con el Programador de Tareas:

```powershell
cd C:\SCADA_IEC104\backend
.\venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000
```

---

## 5. Verificación de Funcionamiento

1. **Documentación Swagger Interactiva:**
   Desde el navegador de su equipo o de cualquier máquina corporativa, ingrese a:
   ```
   http://172.16.231.7:8000/docs
   ```
2. **Usuario Administrador Inicial:**
   Al arrancar por primera vez, el sistema autogenera el primer administrador en SQLite:
   * **Correo:** `admin@celec.gob.ec`
   * **Contraseña temporal:** `Celec2026*`
   *(Podrá cambiar esta clave desde el CRUD de usuarios o crear administradores adicionales).*
3. **Verificar Conexión con el NAS:**
   Consulte el endpoint de salud en:
   ```
   http://172.16.231.7:8000/api/health
   ```
   Verifique que reporte `"pc1_accesible": true` y `"pc2_accesible": true`.

---

## 6. Gestión de Usuarios y Roles (CRUD)

El backend cuenta con control de roles:
* **`admin`:** Tiene permisos para listar, crear, editar contraseñas y dar de baja a usuarios (`/api/admin/usuarios`), además de consultar datos y exportar reportes.
* **`consultante`:** Puede consultar variables SCADA, visualizar gráficos interactivos y exportar a Excel, pero no puede administrar usuarios.

Todos los correos deben pertenecer al dominio corporativo `@celec.gob.ec`.

---

## 7. Hoja de Ruta: Migración a Microsoft Entra (Azure AD / Office 365)

El sistema fue diseñado desde el inicio para una migración limpia a **Microsoft Entra**:
1. Actualmente emite tokens JWT estándar firmados localmente.
2. Al recibir la autorización institucional para registrar una aplicación en Azure Portal:
   * Se configurará el `Tenant ID` y `Client ID` de CELEC en `auth.py`.
   * El Frontend utilizará la librería MSAL (`@azure/msal-browser`) para realizar el login mediante la ventana de Office 365.
   * `auth.py` cambiará únicamente la función de verificación para validar la firma de Microsoft Entra y buscar el correo devuelto en la tabla `usuarios` para validar si tiene rol `admin` o `consultante`.
   * **No se requerirá reescribir la lógica de datos, endpoints ni reportes.**
