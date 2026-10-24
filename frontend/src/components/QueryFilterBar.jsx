import React from 'react';
import { Calendar, Clock, Download, FileSpreadsheet, Play, Search } from 'lucide-react';

export default function QueryFilterBar({
  fecha,
  setFecha,
  horaInicio,
  setHoraInicio,
  horaFin,
  setHoraFin,
  onConsultar,
  onExportarExcel,
  loading,
  exporting,
  totalVariables,
  selectedVariablesCount
}) {
  // Accesos rápidos de rango horario
  const setQuickRange = (tipo) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    if (tipo === 'dia') {
      setHoraInicio('00:00');
      setHoraFin('23:59');
    } else if (tipo === 'hora') {
      const hFin = now.getHours();
      const mFin = now.getMinutes();
      const hIni = (hFin - 1 + 24) % 24;
      setHoraInicio(`${pad(hIni)}:${pad(mFin)}`);
      setHoraFin(`${pad(hFin)}:${pad(mFin)}`);
    } else if (tipo === '15min') {
      const hFin = now.getHours();
      const mFin = now.getMinutes();
      let mIni = mFin - 15;
      let hIni = hFin;
      if (mIni < 0) {
        mIni += 60;
        hIni = (hIni - 1 + 24) % 24;
      }
      setHoraInicio(`${pad(hIni)}:${pad(mIni)}`);
      setHoraFin(`${pad(hFin)}:${pad(mFin)}`);
    } else if (tipo === 'muestra') {
      // Rango de la muestra de prueba (00:00 a 00:11)
      setHoraInicio('00:00');
      setHoraFin('00:11');
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Controles de Entrada */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          {/* Selector de Fecha */}
          <div className="form-group">
            <label className="form-label">Fecha del Log</label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                className="form-input font-mono"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={{ width: '150px' }}
              />
            </div>
          </div>

          {/* Selector Hora Inicio */}
          <div className="form-group">
            <label className="form-label">Hora Inicio</label>
            <input
              type="time"
              className="form-input font-mono"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              style={{ width: '110px' }}
            />
          </div>

          {/* Selector Hora Fin */}
          <div className="form-group">
            <label className="form-label">Hora Fin</label>
            <input
              type="time"
              className="form-input font-mono"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              style={{ width: '110px' }}
            />
          </div>

          {/* Botones de Rango Rápido */}
          <div className="form-group">
            <label className="form-label">Rangos Rápidos</label>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button
                type="button"
                onClick={() => setQuickRange('muestra')}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.65rem', fontSize: '0.75rem' }}
                title="Rango de muestra del log (00:00 - 00:11)"
              >
                00:00-00:11
              </button>
              <button
                type="button"
                onClick={() => setQuickRange('15min')}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.65rem', fontSize: '0.75rem' }}
              >
                15 min
              </button>
              <button
                type="button"
                onClick={() => setQuickRange('hora')}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.65rem', fontSize: '0.75rem' }}
              >
                1 hora
              </button>
              <button
                type="button"
                onClick={() => setQuickRange('dia')}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.65rem', fontSize: '0.75rem' }}
              >
                Todo el Día
              </button>
            </div>
          </div>
        </div>

        {/* Botones de Acción (Consultar & Exportar Excel) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onConsultar}
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.4rem', fontSize: '0.9rem' }}
          >
            {loading ? (
              <>
                <div className="spinner" />
                Consultando NAS...
              </>
            ) : (
              <>
                <Search size={18} />
                Consultar Datos
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onExportarExcel}
            disabled={exporting || loading}
            className="btn btn-success"
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
            title="Genera y descarga el archivo .xlsm con la macro oficial"
          >
            {exporting ? (
              <>
                <div className="spinner" />
                Generando Excel...
              </>
            ) : (
              <>
                <FileSpreadsheet size={18} />
                Exportar Excel (.xlsm)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
