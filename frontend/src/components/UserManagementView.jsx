import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Edit2, Key, Plus, Shield, Trash2, UserCheck, UserX, Users, X } from 'lucide-react';
import { api } from '../services/api';

export default function UserManagementView({ currentUser }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Formulario Nuevo Usuario
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRol, setNewRol] = useState('consultante');

  // Formulario Edición
  const [editName, setEditName] = useState('');
  const [editRol, setEditRol] = useState('consultante');
  const [editPassword, setEditPassword] = useState('');

  const cargarUsuarios = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getUsuarios();
      setUsuarios(data);
    } catch (err) {
      setError(err.message || 'Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const handleCrear = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newEmail.includes('@')) {
      setError('Ingrese un correo electrónico corporativo válido.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('La contraseña temporal debe tener al menos 6 caracteres.');
      return;
    }

    try {
      await api.crearUsuario({
        email: newEmail.trim().toLowerCase(),
        nombre: newName.trim(),
        password: newPassword,
        rol: newRol
      });
      setSuccess(`Usuario ${newEmail} registrado con éxito.`);
      setShowCreateModal(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditar = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setError('');
    setSuccess('');

    const payload = {
      nombre: editName.trim(),
      rol: editRol
    };
    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    try {
      await api.actualizarUsuario(editingUser.id, payload);
      setSuccess(`Usuario ${editingUser.email} actualizado correctamente.`);
      setEditingUser(null);
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleEstado = async (u) => {
    setError('');
    setSuccess('');
    try {
      if (u.activo) {
        if (confirm(`¿Desactivar el acceso a ${u.email}?`)) {
          await api.desactivarUsuario(u.id);
          setSuccess(`Usuario ${u.email} desactivado.`);
        }
      } else {
        await api.actualizarUsuario(u.id, { activo: true });
        setSuccess(`Usuario ${u.email} reactivado.`);
      }
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Banner Superior con Acciones */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users size={22} color="#38bdf8" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#ffffff' }}>
              Control de Accesos y Usuarios Autorizados
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Gestión interna de credenciales previo a la migración con Microsoft Entra (Azure AD / Office 365).
          </p>
        </div>

        <button
          onClick={() => {
            setError('');
            setShowCreateModal(true);
          }}
          className="btn btn-primary"
          style={{ padding: '0.6rem 1.25rem' }}
        >
          <Plus size={18} />
          Nuevo Usuario
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem',
          color: '#f87171',
          fontSize: '0.85rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem',
          color: '#34d399',
          fontSize: '0.85rem'
        }}>
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Tabla de Usuarios */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>ID</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Correo Corporativo</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Nombre</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Perfil / Rol</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Estado</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Último Acceso</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, idx) => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)'
                  }}
                >
                  <td className="font-mono" style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                    #{u.id}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#f8fafc' }}>
                    {u.email}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                    {u.nombre || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={`badge ${u.rol === 'admin' ? 'badge-cyan' : 'badge-green'}`}>
                      {u.rol === 'admin' ? 'Administrador' : 'Consultante'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={`badge ${u.activo ? 'badge-green' : 'badge-red'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="font-mono" style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleString() : 'Sin registros'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setEditName(u.nombre || '');
                          setEditRol(u.rol);
                          setEditPassword('');
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        title="Modificar usuario o contraseña"
                      >
                        <Edit2 size={13} />
                        Editar
                      </button>

                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleToggleEstado(u)}
                          className={`btn ${u.activo ? 'btn-danger' : 'btn-success'}`}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          title={u.activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                        >
                          {u.activo ? <UserX size={13} /> : <UserCheck size={13} />}
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#ffffff' }}>Registrar Nuevo Usuario</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Correo Institucional CELEC</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="nombre.apellido@celec.gob.ec"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nombre y Apellidos</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Ing. Juan Pérez"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Perfil de Acceso</label>
                <select
                  className="form-select"
                  value={newRol}
                  onChange={(e) => setNewRol(e.target.value)}
                >
                  <option value="consultante">Consultante (Ver datos y exportar Excel)</option>
                  <option value="admin">Administrador (Control total + Gestión de usuarios)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña Temporal</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#ffffff' }}>
                Editar: {editingUser.email}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Perfil / Rol</label>
                <select
                  className="form-select"
                  value={editRol}
                  onChange={(e) => setEditRol(e.target.value)}
                >
                  <option value="consultante">Consultante</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Restablecer Contraseña (Opcional)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Dejar en blanco para conservar la actual"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
