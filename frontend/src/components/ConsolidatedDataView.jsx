import React, { useState, useMemo } from 'react';
import { Check, Eye, Search, Table2 } from 'lucide-react';

export default function ConsolidatedDataView({
  resumen,
  selectedVariables,
  setSelectedVariables
}) {
  const [search, setSearch] = useState('');

  // Filtrado de filas
  const filteredData = useMemo(() => {
    if (!resumen) return [];
    if (!search) return resumen;
    const term = search.toLowerCase();
    return resumen.filter(item => item.elemento.toLowerCase().includes(term));
  }, [resumen, search]);

  const toggleGraficar = (elemento) => {
    if (selectedVariables.includes(elemento)) {
      setSelectedVariables(selectedVariables.filter(v => v !== elemento));
    } else {
      setSelectedVariables([...selectedVariables, elemento]);
    }
  };

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      {/* Header con Buscador */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Table2 size={20} color="#38bdf8" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>
            Resumen Estadístico Consolidado
          </h3>
          <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
            {filteredData.length} Variables
          </span>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por nombre de variable..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.2rem', fontSize: '0.85rem' }}
          />
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
      </div>

      {/* Tabla de Datos */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
          <thead>
            <tr style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Elemento / Señal</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Máximo</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Momento Máx</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Mínimo</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Momento Mín</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Promedio</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Graficar</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => {
              const isSelected = selectedVariables.includes(row.elemento);

              return (
                <tr
                  key={row.elemento}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)'}
                >
                  <td style={{ padding: '0.7rem 1rem', fontWeight: 500, color: '#f8fafc' }}>
                    {row.elemento}
                  </td>
                  <td className="font-mono" style={{ padding: '0.7rem 1rem', color: '#38bdf8', fontWeight: 600 }}>
                    {row.maximo?.toFixed(3)}
                  </td>
                  <td className="font-mono" style={{ padding: '0.7rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {row.momento_max}
                  </td>
                  <td className="font-mono" style={{ padding: '0.7rem 1rem', color: '#fbbf24', fontWeight: 600 }}>
                    {row.minimo?.toFixed(3)}
                  </td>
                  <td className="font-mono" style={{ padding: '0.7rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {row.momento_min}
                  </td>
                  <td className="font-mono" style={{ padding: '0.7rem 1rem', color: '#34d399', fontWeight: 600 }}>
                    {row.promedio?.toFixed(3)}
                  </td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleGraficar(row.elemento)}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      {isSelected ? (
                        <>
                          <Check size={13} />
                          En Gráfico
                        </>
                      ) : (
                        <>
                          <Eye size={13} />
                          Graficar
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredData.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  {resumen?.length === 0
                    ? 'No hay registros cargados. Ejecute una consulta en el panel superior.'
                    : 'No se encontraron variables con el término de búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
