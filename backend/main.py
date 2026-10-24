"""
main.py
Servidor Backend REST API para SCADA IEC104.
Desarrollado con FastAPI para consulta histórica, visualización y administración de accesos.
"""
import os
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import (
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from database import RolUsuario, Usuario, create_tables, get_db
from parser import (
    build_analysis_dataset,
    export_to_excel_macro,
    load_definitions,
    parse_iec104_redundant,
)

# --- Rutas de Archivos y Configuración ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEF_FOLDER = os.getenv("DEF_FOLDER", os.path.join(BASE_DIR, "definitions"))
TEMPLATE_PATH = os.getenv("TEMPLATE_PATH", os.path.join(BASE_DIR, "templates", "PlantillaGraficosIEC104.xlsm"))
NAS_BASE_PATH = os.getenv("NAS_BASE_PATH", r"\\NAS-CHMSF\Respaldo_SCADA\IEC104")
LOCAL_TEST_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))


# --- Inicialización de la Aplicación ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Crear tablas en SQLite si no existen
    create_tables()

    # 2. Sembrar usuario Administrador inicial por defecto si la tabla está vacía
    from database import SessionLocal
    db = SessionLocal()
    try:
        total_usuarios = db.query(Usuario).count()
        if total_usuarios == 0:
            admin_default = Usuario(
                email="admin@celec.gob.ec",
                password_hash=hash_password("Celec2026*"),
                nombre="Administrador Sistema",
                rol=RolUsuario.admin,
                activo=True
            )
            db.add(admin_default)
            db.commit()
            print("[INFO] Usuario administrador inicial creado: admin@celec.gob.ec (Clave temporal: Celec2026*)")
    finally:
        db.close()

    yield


app = FastAPI(
    title="SCADA IEC104 API",
    description="API REST para consulta de logs históricos IEC104, consolidación redundante PC1/PC2 y gestión de accesos CELEC.",
    version="1.0.0",
    lifespan=lifespan
)

# --- Middleware CORS ---
# Permite conexión desde cualquier interfaz web local o en red corporativa
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Modelos de Petición para Datos ---
class ConsultaDatosRequest(BaseModel):
    fecha: str = Field(..., description="Fecha en formato YYYY-MM-DD (ej: 2026-10-08)")
    hora_inicio: str = Field(..., description="Hora de inicio en formato HH:MM (ej: 00:00)")
    hora_fin: str = Field(..., description="Hora de fin en formato HH:MM (ej: 00:11)")
    elementos: Optional[List[str]] = Field(None, description="Lista opcional de nombres o códigos a filtrar")


# ==============================================================================
# 1. ENDPOINTS DE AUTENTICACIÓN
# ==============================================================================

@app.post("/api/auth/login", response_model=Token, tags=["Autenticación"])
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Inicia sesión con correo corporativo y contraseña.
    Genera un token JWT para llamadas subsiguientes.
    """
    email_clean = login_data.email.strip().lower()
    usuario = db.query(Usuario).filter(Usuario.email == email_clean).first()

    if not usuario or not verify_password(login_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos"
        )

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Su cuenta ha sido desactivada. Comuníquese con el administrador."
        )

    # Actualizar última fecha de login
    usuario.last_login = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token(data={"sub": usuario.email, "rol": usuario.rol.value})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": usuario
    }


@app.get("/api/auth/me", response_model=UserResponse, tags=["Autenticación"])
def get_mi_perfil(current_user: Usuario = Depends(get_current_user)):
    """Retorna los datos del usuario actualmente autenticado."""
    return current_user


# ==============================================================================
# 2. ENDPOINTS DE ADMINISTRACIÓN DE USUARIOS (Solo Administradores)
# ==============================================================================

@app.get("/api/admin/usuarios", response_model=List[UserResponse], tags=["Administración de Usuarios"])
def listar_usuarios(
    admin: Usuario = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Obtiene la lista de todos los usuarios registrados."""
    return db.query(Usuario).order_by(Usuario.id.asc()).all()


@app.post("/api/admin/usuarios", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Administración de Usuarios"])
def crear_usuario(
    usuario_in: UserCreate,
    admin: Usuario = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Registra un nuevo usuario autorizado en el sistema."""
    email_clean = usuario_in.email.strip().lower()

    if not email_clean.endswith("@celec.gob.ec") and "@" in email_clean:
        # Advertencia o validación de dominio corporativo
        pass

    existente = db.query(Usuario).filter(Usuario.email == email_clean).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El correo {email_clean} ya está registrado."
        )

    nuevo = Usuario(
        email=email_clean,
        password_hash=hash_password(usuario_in.password),
        nombre=usuario_in.nombre,
        rol=usuario_in.rol,
        activo=True
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.put("/api/admin/usuarios/{usuario_id}", response_model=UserResponse, tags=["Administración de Usuarios"])
def actualizar_usuario(
    usuario_id: int,
    usuario_in: UserUpdate,
    admin: Usuario = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Actualiza los datos o estado de un usuario."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario_in.nombre is not None:
        usuario.nombre = usuario_in.nombre
    if usuario_in.rol is not None:
        usuario.rol = usuario_in.rol
    if usuario_in.activo is not None:
        usuario.activo = usuario_in.activo
    if usuario_in.password:
        usuario.password_hash = hash_password(usuario_in.password)

    db.commit()
    db.refresh(usuario)
    return usuario


@app.delete("/api/admin/usuarios/{usuario_id}", tags=["Administración de Usuarios"])
def desactivar_usuario(
    usuario_id: int,
    admin: Usuario = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Desactiva el acceso a un usuario (baja lógica)."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario.id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta de administrador actual.")

    usuario.activo = False
    db.commit()
    return {"mensaje": f"Usuario {usuario.email} desactivado correctamente"}


# ==============================================================================
# 3. ENDPOINTS DE DATOS SCADA Y LOGS IEC104
# ==============================================================================

@app.get("/api/elementos", tags=["SCADA IEC104"])
def listar_elementos(current_user: Usuario = Depends(get_current_user)):
    """
    Retorna el catálogo completo de variables configuradas a partir de los archivos .DEF.
    """
    definitions = load_definitions(DEF_FOLDER)
    elementos = [
        {"codigo": k, "nombre": v}
        for k, v in sorted(definitions.items(), key=lambda item: item[1])
    ]
    return {
        "total": len(elementos),
        "elementos": elementos
    }


@app.post("/api/datos", tags=["SCADA IEC104"])
def consultar_datos(
    req: ConsultaDatosRequest,
    current_user: Usuario = Depends(get_current_user)
):
    """
    Consulta y consolida registros de PC1 y PC2 en el NAS para la fecha y rango horario especificados.
    Retorna el resumen estadístico y las series temporales para graficar en el dashboard.
    """
    try:
        datetime.strptime(req.fecha, "%Y-%m-%d")
        datetime.strptime(req.hora_inicio, "%H:%M")
        datetime.strptime(req.hora_fin, "%H:%M")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha u hora inválido. Use fecha: YYYY-MM-DD y horas: HH:MM"
        )

    records, stats = parse_iec104_redundant(
        target_date=req.fecha,
        start_time_str=req.hora_inicio,
        end_time_str=req.hora_fin,
        def_folder=DEF_FOLDER,
        nas_base_path=NAS_BASE_PATH,
        local_fallback_dirs=[LOCAL_TEST_DIR],
        filter_elements=req.elementos
    )

    if not records:
        return {
            "mensaje": "No se encontraron registros en el rango de tiempo especificado en PC1 ni PC2.",
            "stats": stats,
            "resumen": [],
            "series": {},
            "timestamps": [],
            "total_registros": 0
        }

    dataset = build_analysis_dataset(records)

    return {
        "stats": stats,
        "total_registros": len(records),
        "resumen": dataset["resumen"],
        "series": dataset["series"],
        "timestamps": dataset["timestamps"]
    }


@app.post("/api/exportar-excel", tags=["SCADA IEC104"])
def exportar_excel(
    req: ConsultaDatosRequest,
    current_user: Usuario = Depends(get_current_user)
):
    """
    Genera y descarga el archivo .xlsm consolidando los datos con la plantilla macro oficial.
    """
    records, stats = parse_iec104_redundant(
        target_date=req.fecha,
        start_time_str=req.hora_inicio,
        end_time_str=req.hora_fin,
        def_folder=DEF_FOLDER,
        nas_base_path=NAS_BASE_PATH,
        local_fallback_dirs=[LOCAL_TEST_DIR],
        filter_elements=req.elementos
    )

    if not records:
        raise HTTPException(
            status_code=404,
            detail="No se encontraron registros en el período solicitado para generar el archivo Excel."
        )

    # Crear archivo temporal
    temp_dir = tempfile.mkdtemp()
    timestamp_filename = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_name = f"Reporte_IEC104_{req.fecha}_{req.hora_inicio.replace(':', '')}_{req.hora_fin.replace(':', '')}_{timestamp_filename}.xlsm"
    out_path = os.path.join(temp_dir, out_name)

    try:
        export_to_excel_macro(records, TEMPLATE_PATH, out_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando reporte Excel: {str(e)}")

    return FileResponse(
        path=out_path,
        filename=out_name,
        media_type="application/vnd.ms-excel.sheet.macroEnabled.12"
    )


# ==============================================================================
# 4. SALUD Y ESTADO DEL SISTEMA
# ==============================================================================

@app.get("/api/health", tags=["Sistema"])
def health_check():
    """Verifica estado del servidor y conectividad con el NAS."""
    pc1_path = os.path.join(NAS_BASE_PATH, "PC1")
    pc2_path = os.path.join(NAS_BASE_PATH, "PC2")
    return {
        "status": "online",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "nas": {
            "base_path": NAS_BASE_PATH,
            "pc1_accesible": os.path.exists(pc1_path),
            "pc2_accesible": os.path.exists(pc2_path)
        },
        "definitions_cargadas": len(load_definitions(DEF_FOLDER)),
        "plantilla_disponible": os.path.exists(TEMPLATE_PATH)
    }


# ==============================================================================
# 5. SERVIR INTERFAZ WEB REACT (COMPILADA)
# ==============================================================================
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend_dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

