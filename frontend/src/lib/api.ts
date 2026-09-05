import axios from 'axios';

// Central axios instance: attaches JWT, redirects to login on 401.
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear();
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export function apiError(err: any): string {
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}

export default api;
