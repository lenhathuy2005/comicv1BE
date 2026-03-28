const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('admin_access_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (response.status === 401) {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');

    if (window.location.pathname !== '/admin/login') {
      window.location.href = '/admin/login';
    }

    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  }

  if (!response.ok) {
    throw new Error(result?.message || 'Request failed');
  }

  return result;
}

export { API_BASE_URL };