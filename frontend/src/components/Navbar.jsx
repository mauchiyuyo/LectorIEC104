import React from 'react';
import { Activity, Database, LogOut, Shield, User, Users, BarChart3, Table2 } from 'lucide-react';

export default function Navbar({ user, activeTab, setActiveTab, onLogout, health }) {
  const isAdmin = user?.rol === 'admin';

  return (
    <header style={{
      background: 'rgba(15, 23, 42, 0.9)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0.75rem 1.5rem'
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Brand / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.35)'
          }}>
            <Activity size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
                CELEC EP
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                SCADA IEC104
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Monitoreo y Análisis de Telemetría Redundante
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '0.4rem', background: '#0b1120', padding: '0.3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.825rem' }}
          >
            <BarChart3 size={16} />
            Dashboard & Gráficos
          </button>

          <button
            onClick={() => setActiveTab('tabla')}
            className={`btn ${activeTab === 'tabla' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.825rem' }}
          >
            <Table2 size={16} />
            Datos Consolidados
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`btn ${activeTab === 'usuarios' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.825rem' }}
            >
              <Users size={16} />
              Gestión de Usuarios
            </button>
          )}
        </nav>

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* NAS Connection Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }} title="Conectividad con NAS histórico">
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: health?.nas?.pc1_accesible || health?.nas?.pc2_accesible ? '#10b981' : '#f59e0b',
              boxShadow: health?.nas?.pc1_accesible ? '0 0 8px #10b981' : 'none'
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>NAS SCADA</span>
          </div>

          {/* User Profile Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: '#1e293b',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)'
          }}>
            <User size={15} color="#38bdf8" />
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {user?.email || 'Usuario'}
            </span>
            <span className={`badge ${user?.rol === 'admin' ? 'badge-cyan' : 'badge-green'}`} style={{ fontSize: '0.65rem' }}>
              {user?.rol || 'Consultante'}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
            title="Cerrar Sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
