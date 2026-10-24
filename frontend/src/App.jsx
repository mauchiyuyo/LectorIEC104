import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import QueryFilterBar from './components/QueryFilterBar';
import DashboardView from './components/DashboardView';
import ConsolidatedDataView from './components/ConsolidatedDataView';
import UserManagementView from './components/UserManagementView';
import { api, authStorage } from './services/api';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(authStorage.getUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [health, setHealth] = useState(null);

  // Parámetros de Consulta
  // Por defecto inicializamos con la fecha del archivo de muestra
  const [fecha, setFecha] = useState('2026-10-08');
  const [horaInicio, setHoraInicio] = useState('00:00');
  const [horaFin, setHoraFin] = useState('00:11');

  // Datos y Estado
  const [datos, setDatos] = useState(null);
  const [selectedVariables, setSelectedVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Validar sesión al montar
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setDatos(null);
    };
    window.addEventListener('auth_expired', handleAuthExpired);

    if (authStorage.getToken()) {
      api.getMe()
        .then(u => setUser(u))
        .catch(() => authStorage.clear());
    }

    // Verificar salud del sistema y NAS
    api.getHealth()
      .then(h => setHealth(h))
      .catch(() => {});

    return () => window.removeEventListener('auth_expired', handleAuthExpired);
  }, []);

  const handleLoginSuccess = (loggedUser) => {
    setUser(loggedUser);
    setErrorMsg('');
    api.getHealth().then(h => setHealth(h)).catch(() => {});
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setDatos(null);
    setSelectedVariables([]);
  };

  // Consulta de Datos al Servidor
  const handleConsultar = async () => {
    setErrorMsg('');
    if (!fecha) {
      setErrorMsg('Por favor seleccione una fecha válida.');
      return;
    }
    if (!horaInicio || !horaFin) {
      setErrorMsg('Por favor defina la hora de inicio y fin.');
      return;
    }

    setLoading(true);
    try {
      const resp = await api.consultarDatos({
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin
      });

      setDatos(resp);

      // Si hay series y no tenemos variables seleccionadas, seleccionar las primeras 3 por defecto
      if (resp.series && Object.keys(resp.series).length > 0) {
        const available = Object.keys(resp.series);
        if (selectedVariables.length === 0) {
          setSelectedVariables(available.slice(0, 3));
        } else {
          // Filtrar variables seleccionadas que no existan en el nuevo conjunto
          const valid = selectedVariables.filter(v => available.includes(v));
          setSelectedVariables(valid.length > 0 ? valid : available.slice(0, 3));
        }
      }

      if (resp.total_registros === 0) {
        setErrorMsg('No se encontraron registros en el rango de tiempo seleccionado.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error consultando registros en el NAS.');
    } finally {
      setLoading(false);
    }
  };

  // Exportación a Excel con Macros
  const handleExportarExcel = async () => {
    setErrorMsg('');
    setExporting(true);
    try {
      await api.exportarExcel({
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin
      });
    } catch (err) {
      setErrorMsg(err.message || 'Error al generar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  // Si no está autenticado, mostrar pantalla de Login
  if (!user) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Barra de Navegación Principal */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        health={health}
      />

      {/* Contenedor Principal */}
      <main style={{
        maxWidth: '1600px',
        width: '100%',
        margin: '0 auto',
        padding: '1.25rem 1.5rem',
        flex: 1
      }}>
        {/* Barra Global de Filtrado y Consulta (Visible en Dashboard y Tabla de Datos) */}
        {activeTab !== 'usuarios' && (
          <QueryFilterBar
            fecha={fecha}
            setFecha={setFecha}
            horaInicio={horaInicio}
            setHoraInicio={setHoraInicio}
            horaFin={horaFin}
            setHoraFin={setHoraFin}
            onConsultar={handleConsultar}
            onExportarExcel={handleExportarExcel}
            loading={loading}
            exporting={exporting}
            totalVariables={datos?.resumen?.length || 0}
            selectedVariablesCount={selectedVariables.length}
          />
        )}

        {/* Mensaje de Error Global */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Vistas según Pestaña Activa */}
        {activeTab === 'dashboard' && (
          <DashboardView
            datos={datos}
            stats={datos?.stats}
            selectedVariables={selectedVariables}
            setSelectedVariables={setSelectedVariables}
            loading={loading}
          />
        )}

        {activeTab === 'tabla' && (
          <ConsolidatedDataView
            resumen={datos?.resumen || []}
            selectedVariables={selectedVariables}
            setSelectedVariables={setSelectedVariables}
          />
        )}

        {activeTab === 'usuarios' && user?.rol === 'admin' && (
          <UserManagementView currentUser={user} />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '0.85rem 1.5rem',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        background: 'rgba(15, 23, 42, 0.5)'
      }}>
        CELEC EP &copy; 2026 &mdash; Sistema de Monitoreo y Análisis de Registros Históricos IEC 60870-5-104
      </footer>
    </div>
  );
}
