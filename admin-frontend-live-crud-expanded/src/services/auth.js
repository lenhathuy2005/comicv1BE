import { apiRequest } from './api';

export async function loginAdmin({ identifier, password }) {
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });

  return result?.data;
}

export function saveAdminAuth(data) {
  localStorage.setItem('admin_access_token', data.accessToken);
  localStorage.setItem('admin_refresh_token', data.refreshToken || '');
  localStorage.setItem('admin_user', JSON.stringify(data.user || {}));
}

export function getAdminUser() {
  const raw = localStorage.getItem('admin_user');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAdminLoggedIn() {
  return !!localStorage.getItem('admin_access_token');
}

export function clearAdminAuth() {
  localStorage.removeItem('admin_access_token');
  localStorage.removeItem('admin_refresh_token');
  localStorage.removeItem('admin_user');
}