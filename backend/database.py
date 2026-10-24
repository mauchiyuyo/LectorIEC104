"""
database.py
Configuracion de la base de datos SQLite y modelo de la tabla de usuarios.
"""
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import enum

# --- Configuracion ---
DATABASE_URL = "sqlite:///./scada_iec104.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # Necesario para SQLite con FastAPI
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# --- Modelos ---
class Base(DeclarativeBase):
    pass


class RolUsuario(str, enum.Enum):
    admin       = "admin"
    consultante = "consultante"


class Usuario(Base):
    __tablename__ = "usuarios"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    nombre        = Column(String, nullable=True)
    rol           = Column(Enum(RolUsuario), default=RolUsuario.consultante, nullable=False)
    activo        = Column(Boolean, default=True, nullable=False)
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login    = Column(DateTime, nullable=True)


def create_tables():
    """Crea todas las tablas si no existen."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependencia FastAPI: provee sesion de BD y la cierra al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
