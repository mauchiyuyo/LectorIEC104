import React, { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Activity, CheckSquare, Eye, Layers, Search, Server, Square } from 'lucide-react';

// Paleta de colores distintivos de alto contraste para las señales SCADA
const SCADA_PALETTE = [
  '#38bdf8', // Cyan
  '#34d399', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Teal
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Turquoise
  '#eab308', // Yellow
];

export default function DashboardView({
  datos,
  stats,
  selectedVariables,
  setSelectedVariables,
  loading
}) {
  const [searchTerm, setSearchTerm] = useState('');

  // Lista de todas las variables disponibles en el dataset actual
  const allVariables = useMemo(() => {
    if (!datos?.series) return [];
    return Object.keys(datos.series).sort();
  }, [datos]);

  // Filtrado de variables por término de búsqueda
  const filteredVariables = useMemo(() => {
    if (!searchTerm) return allVariables;
    const term = searchTerm.toLowerCase();
    return allVariables.filter(v => v.toLowerCase().includes(term));
  }, [allVariables, searchTerm]);

  // Alternar selección de una variable individual
  const toggleVariable = (variable) => {
    if (selectedVariables.includes(variable)) {
      setSelectedVariables(selectedVariables.filter(v => v !== variable));
    } else {
      setSelectedVariables([...selectedVariables, variable]);
    }
  };

  // Seleccionar todas las variables filtradas
  const selectAll = () => {
    const combined = Array.from(new Set([...selectedVariables, ...filteredVariables]));
    setSelectedVariables(combined);
  };

  // Deseleccionar todas las variables filtradas
  const deselectAll = () => {
    const toRemove = new Set(filteredVariables);
    setSelectedVariables(selectedVariables.filter(v => !toRemove.has(v)));
  };

  // Construir las trazas de datos para Plotly.js
  const plotTraces = useMemo(() => {
    if (!datos?.timestamps || !datos?.series) return [];

    return selectedVariables.map((variable, idx) => {
      const yValues = datos.series[variable] || [];
      const color = SCADA_PALETTE[idx % SCADA_PALETTE.length];

      return {
        x: datos.timestamps,
        y: yValues,
        name: variable,
        type: 'scatter',
        mode: 'lines',
        line: {
          color: color,
          width: 2,
          shape: 'spline' // curva suavizada
        },
        connectgaps: true,
        hovertemplate: `<b>%{y:.3f}</b><br><span style="font-size:0.75rem; color:#94a3b8">%{x}</span><extra>${variable}</extra>`
      };
    });
  }, [datos, selectedVariables]);

  // Configuración de Layout para Plotly (Tema Dark SCADA)
  const plotLayout = useMemo(() => {
    return {
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      margin: { l: 60, r: 30, t: 30, b: 60 },
      font: {
        family: 'Inter, sans-serif',
        color: '#94a3b8',
        size: 11
      },
      hoverlabel: {
        bgcolor: '#0f172a',
        bordercolor: '#38bdf8',
        font: { family: 'JetBrains Mono, monospace', color: '#f8fafc' }
      },
      xaxis: {
        title: { text: 'Hora (hh:mm:ss)', font: { size: 12, color: '#64748b' } },
        gridcolor: 'rgba(255, 255, 255, 0.06)',
        zerolinecolor: 'rgba(255, 255, 255, 0.1)',
        tickfont: { family: 'JetBrains Mono, monospace', size: 10 }
      },
      yaxis: {
        title: { text: 'Valor Medido', font: { size: 12, color: '#64748b' } },
        gridcolor: 'rgba(255, 255, 255, 0.06)',
        zerolinecolor: 'rgba(255, 255, 255, 0.1)',
        tickfont: { family: 'JetBrains Mono, monospace', size: 10 }
      },
      legend: {
        orientation: 'h',
        y: -0.22,
        x: 0.5,
        xanchor: 'center',
        font: { size: 11, color: '#cbd5e1' }
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Tarjetas de Indicadores Rápidos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        {/* Total Registros */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Activity size={24} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Registros Consolidados
            </div>
            <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>
              {datos?.total_registros?.toLocaleString() || 0}
            </div>
          </div>
        </div>

        {/* Origen PC1 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Server size={24} color="#34d399" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Fuente Primaria (PC1)
            </div>
            <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>
              {stats?.pc1_registros?.toLocaleString() || 0}
            </div>
          </div>
        </div>

        {/* Origen PC2 (Redundancia) */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layers size={24} color="#fbbf24" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Redundante (PC2)
            </div>
            <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>
              {stats?.pc2_registros?.toLocaleString() || 0}
            </div>
          </div>
        </div>

        {/* Variables Seleccionadas */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Eye size={24} color="#818cf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Variables en Gráfico
            </div>
            <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>
              {selectedVariables.length} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ {allVariables.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Área Principal: Gráfico + Selector Lateral de Variables */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '1.25rem',
        alignItems: 'start'
      }}>
        {/* Panel del Gráfico */}
        <div className="card" style={{ padding: '1rem', minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '0.75rem',
            marginBottom: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="#38bdf8" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#ffffff' }}>
                Series Temporales SCADA
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Zoom: Arrastre el cursor | Reset: Doble clic
            </span>
          </div>

          {plotTraces.length > 0 ? (
            <div style={{ flex: 1, width: '100%', minHeight: '450px' }}>
              <Plot
                data={plotTraces}
                layout={plotLayout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%', minHeight: '450px' }}
                config={{
                  responsive: true,
                  displaylogo: false,
                  modeBarButtonsToRemove: ['lasso2d', 'select2d']
                }}
              />
            </div>
          ) : (
            <div style={{
              flex: 1,
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              textAlign: 'center',
              gap: '0.75rem'
            }}>
              <Activity size={48} color="#334155" />
              <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {allVariables.length === 0
                  ? 'No hay datos cargados. Presione "Consultar Datos" arriba.'
                  : 'Ninguna variable seleccionada para graficar.'}
              </div>
              <div style={{ fontSize: '0.8rem', maxWidth: '380px' }}>
                {allVariables.length === 0
                  ? 'Seleccione la fecha y rango horario y presione Consultar para extraer del NAS.'
                  : 'Active las casillas de verificación en la lista lateral para visualizar las curvas.'}
              </div>
            </div>
          )}
        </div>

        {/* Panel Lateral: Lista de Variables con Checkboxes */}
        <div className="card" style={{ padding: '1rem', maxHeight: '580px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>
              Señales SCADA ({filteredVariables.length})
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={selectAll}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                title="Seleccionar todas las filtradas"
              >
                Todas
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                title="Deseleccionar todas"
              >
                Ninguna
              </button>
            </div>
          </div>

          {/* Buscador de variables */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Buscar variable o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '2.2rem', fontSize: '0.8rem' }}
            />
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* Lista scrolleable con checkboxes */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            paddingRight: '0.25rem'
          }}>
            {filteredVariables.map((variable) => {
              const isSelected = selectedVariables.includes(variable);
              const colorIdx = selectedVariables.indexOf(variable);
              const color = colorIdx >= 0 ? SCADA_PALETTE[colorIdx % SCADA_PALETTE.length] : 'transparent';

              return (
                <label
                  key={variable}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.45rem 0.6rem',
                    background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isSelected ? 'rgba(56, 189, 248, 0.25)' : 'transparent'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '0.775rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleVariable(variable)}
                    style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                  {isSelected && (
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      flexShrink: 0
                    }} />
                  )}
                  <span style={{
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: isSelected ? 500 : 400,
                    wordBreak: 'break-word',
                    lineHeight: '1.2'
                  }}>
                    {variable}
                  </span>
                </label>
              );
            })}

            {filteredVariables.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {allVariables.length === 0 ? 'Sin variables cargadas' : 'No se encontraron coincidencias'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
