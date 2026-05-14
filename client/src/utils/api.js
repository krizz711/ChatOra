import axios from 'axios';
import { getStoredToken } from './token';

const SERVER = import.meta.env.VITE_SERVER_URL || '';

export const api = axios.create({ baseURL: `${SERVER}/api` });

// Auto attach token
api.interceptors.request.use(cfg => {
  const token = getStoredToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const uploadFile = async (file, onProgress) => {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round(e.loaded * 100 / e.total)),
  });
  return res.data;
};

export const fetchGroups = () => api.get('/groups').then(r => r.data);
export const createGroup = (name, is_private) => api.post('/groups/create', { name, is_private }).then(r => r.data);
export const joinGroup = (groupId) => api.post(`/groups/join/${groupId}`).then(r => r.data);
export const joinByInvite = (code) => api.post(`/groups/join/invite/${code}`).then(r => r.data);
export const leaveGroup = (groupId) => api.delete(`/groups/leave/${groupId}`).then(r => r.data);
export const updateProfile = (data) => api.put('/auth/profile', data).then(r => r.data);
export const fetchStars = (userIds) => {
  if (!userIds?.length) return Promise.resolve({ counts: {}, starredByMe: [] });
  return api.get(`/auth/stars?ids=${userIds.join(',')}`).then(r => r.data);
};
export const toggleStar = (userId) => api.post(`/auth/star/${userId}`).then(r => r.data);
export const uploadAvatar = (file) => {
  const form = new FormData();
  form.append('avatar', file);
  return api.post('/auth/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};
