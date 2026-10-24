/**
 * api.js
 * Cliente HTTP centralizado para comunicación con el backend FastAPI.
 * Gestiona tokens JWT y llamadas protegidas.
 */

const API_BASE = '/api';

export const authStorage = {
  getToken: () => localStorage.getItem('scada_token'),
  setToken: (token) => localStorage.setItem('scada_token', token),
  getUser: () => {
    try {
      const u = localStorage.getItem('scada_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem('scada_user', JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem('scada_token');
    localStorage.removeItem('scada_user');
  }
};

async function request(endpoint, options = {}) {
  const token = authStorage.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Sesión expirada o inválida
    authStorage.clear();
    window.dispatchEvent(new Event('auth_expired'));
    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
  }

  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData.detail) errorMsg = errData.detail;
    } catch {
      // Ignorar si no es JSON
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Autenticación
  login: async (email, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    authStorage.setToken(data.access_token);
    authStorage.setUser(data.user);
    return data;
  },

  getMe: async () => {
    return request('/auth/me');
  },

  logout: () => {
    authStorage.clear();
  },

  // Estado del sistema
  getHealth: async () => {
    return request('/health');
  },

  // SCADA IEC104
  getElementos: async () => {
    return request('/elementos');
  },

  consultarDatos: async ({ fecha, hora_inicio, hora_fin, elementos }) => {
    return request('/datos', {
      method: 'POST',
      body: JSON.stringify({ fecha, hora_inicio, hora_fin, elementos })
    });
  },

  exportarExcel: async ({ fecha, hora_inicio, hora_fin, elementos }) => {
    const token = authStorage.getToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/exportar-excel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fecha, hora_inicio, hora_fin, elementos })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al exportar archivo Excel.');
    }

    // Obtener nombre del archivo del header si está disponible
    const disposition = response.headers.get('content-disposition');
    let filename = `Reporte_SCADA_${fecha}.xlsm`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return true;
  },

  // Administración de Usuarios (Solo Admin)
  getUsuarios: async () => {
    return request('/admin/usuarios');
  },

  crearUsuario: async ({ email, password, nombre, rol }) => {
    return request('/admin/usuarios', {
      method: 'POST',
      body: JSON.stringify({ email, password, nombre, rol })
    });
  },

  actualizarUsuario: async (id, datos) => {
    return request(`/admin/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(datos)
    });
  },

  desactivarUsuario: async (id) => {
    return request(`/admin/usuarios/${id}`, {
      method: 'DELETE'
    });
  }
};
