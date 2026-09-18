// In local dev (vite dev server, no nginx in front of it) this points
// straight at the backend dev server. In the built production image it's
// left empty on purpose: nginx proxies /api/* to the right backend
// container for whichever environment (staging/production) that image is
// running in, so the same built frontend image works in both — see
// nginx.conf.template and scripts/deploy.sh's BACKEND_HOST.
const API_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const options = { method, headers };
  if (body !== undefined) options.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${path}`, options);

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  register: (name, email, password) => request('/api/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: (token) => request('/api/auth/me', { token }),

  listProjects: (token) => request('/api/projects', { token }),
  createProject: (token, name, description) =>
    request('/api/projects', { method: 'POST', body: { name, description }, token }),
  getProject: (token, id) => request(`/api/projects/${id}`, { token }),
  addMember: (token, id, email) =>
    request(`/api/projects/${id}/members`, { method: 'POST', body: { email }, token }),

  listTasks: (token, projectId, status) =>
    request(`/api/projects/${projectId}/tasks${status ? `?status=${status}` : ''}`, { token }),
  createTask: (token, projectId, payload) =>
    request(`/api/projects/${projectId}/tasks`, { method: 'POST', body: payload, token }),
  getTask: (token, taskId) => request(`/api/tasks/${taskId}`, { token }),
  updateTask: (token, taskId, payload) =>
    request(`/api/tasks/${taskId}`, { method: 'PATCH', body: payload, token }),
  deleteTask: (token, taskId) => request(`/api/tasks/${taskId}`, { method: 'DELETE', token }),

  listComments: (token, taskId) => request(`/api/tasks/${taskId}/comments`, { token }),
  addComment: (token, taskId, text) =>
    request(`/api/tasks/${taskId}/comments`, { method: 'POST', body: { text }, token }),
};

export { ApiError };
