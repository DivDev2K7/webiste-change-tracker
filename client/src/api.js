const TOKEN_KEY = 'wcd_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken('');
    window.location.reload();
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  config: () => request('/config'),
  authStatus: () => request('/auth/status'),
  login: (password) => request('/auth/login', { method: 'POST', body: { password } }),
  listWatches: () => request('/watches'),
  getWatch: (id) => request(`/watches/${id}`),
  createWatch: (body) => request('/watches', { method: 'POST', body }),
  updateWatch: (id, body) => request(`/watches/${id}`, { method: 'PUT', body }),
  deleteWatch: (id) => request(`/watches/${id}`, { method: 'DELETE' }),
  checkWatch: (id) => request(`/watches/${id}/check`, { method: 'POST' }),
  snapshots: (id) => request(`/watches/${id}/snapshots`),
  diff: (id, from, to) => request(`/watches/${id}/diff?from=${from}&to=${to}`),
  testAlert: (notify) => request('/alerts/test', { method: 'POST', body: notify })
};

// The picker iframe can't send headers, so the token travels in the query string.
export const previewUrl = (url) =>
  `/api/watches/preview?url=${encodeURIComponent(url)}${getToken() ? `&token=${getToken()}` : ''}`;

export function timeAgo(date) {
  if (!date) return 'Never';
  const s = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const INTERVALS = [
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 180, label: 'Every 3 hours' },
  { value: 360, label: 'Every 6 hours' },
  { value: 720, label: 'Every 12 hours' },
  { value: 1440, label: 'Every 24 hours' }
];

export const intervalLabel = (m) => INTERVALS.find((i) => i.value === m)?.label.replace('Every ', '') || `${m} min`;
