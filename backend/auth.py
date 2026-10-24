"""
auth.py
Manejo de autenticación, hash de contraseñas, tokens JWT y autorización de roles.
Diseñado para facilitar la transición futura a Microsoft Entra (Azure AD / Office 365).
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from database import RolUsuario, Usuario, get_db

# --- Configuración de Seguridad ---
# En producción, SECRET_KEY puede configurarse vía variable de entorno
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "celec-scada-iec104-secret-key-2026-production-ready")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 horas de sesión

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# --- Funciones de Criptografía ---
def hash_password(password: str) -> str:
    """Genera hash seguro con bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña plana coincide con el hash almacenado."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Genera un JWT con tiempo de expiración."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# --- Esquemas Pydantic ---
class UserLogin(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: str
    password: str
    nombre: Optional[str] = None
    rol: RolUsuario = RolUsuario.consultante


class UserUpdate(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[RolUsuario] = None
    activo: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    nombre: Optional[str] = None
    rol: RolUsuario
    activo: bool
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# --- Dependencias de Seguridad y Roles ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Usuario:
    """
    Decodifica el JWT y obtiene el usuario actual.
    
    NOTA PARA MIGRACIÓN A MICROSOFT ENTRA (Azure AD):
    Para migrar a Entra, esta función validará el Bearer Token emitido por Azure:
    - Se decodificará con las claves públicas de Microsoft Entra (https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys)
    - Se extraerá el 'preferred_username' o 'email' del claim corporativo (@celec.gob.ec).
    - Se verificará que exista en la tabla local de usuarios autorizados.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales de autenticación inválidas o sesión expirada",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    usuario = db.query(Usuario).filter(Usuario.email == email.strip().lower()).first()
    if usuario is None:
        raise credentials_exception

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo. Contacte al administrador del sistema."
        )

    return usuario


def require_admin(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    """Verifica que el usuario tenga rol de administrador."""
    if current_user.rol != RolUsuario.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida: Se requiere perfil de Administrador."
        )
    return current_user
