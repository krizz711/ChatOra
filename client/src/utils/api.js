import axios from 'axios';
import { getStoredToken } from './token';

/** In dev, always use Vite proxy (/api → :5000) so auth cookies/tokens stay same-origin. */
function resolveApiBaseURL() {
  if (import.meta.env.DEV) return '/api';
  const server = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
  return server ? `${server}/api` : '/api';
}

export const api = axios.create({ baseURL: resolveApiBaseURL() });

export function setApiAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Attach JWT on every request (storage + axios default fallback)
api.interceptors.request.use((cfg) => {
  const token = getStoredToken();
  const header =
    token
      ? `Bearer ${token}`
      : api.defaults.headers.common.Authorization || axios.defaults.headers.common.Authorization;

  if (header) {
    cfg.headers.Authorization = header;
  }
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

export const fetchFriends = () => api.get('/friends').then(r => r.data);
export const fetchFriendRequests = () => api.get('/friends/requests').then(r => r.data);
export const sendFriendRequest = (userId) => api.post(`/friends/request/${userId}`).then(r => r.data);
export const acceptFriendRequest = (requestId) => api.post(`/friends/accept/${requestId}`).then(r => r.data);
export const declineFriendRequest = (requestId) => api.post(`/friends/decline/${requestId}`).then(r => r.data);
export const unfriend = (userId) => api.delete(`/friends/${userId}`).then(r => r.data);
export const checkFriendship = (userId) => api.get(`/friends/check/${userId}`).then(r => r.data);
export const updateCallSettings = (settings) => api.put('/friends/settings', settings).then(r => r.data);

export const fetchFriendsForUser = (userId) =>
  api.get(`/friends/list/${userId}`).then(r => r.data);

export const fetchUserProfile = (userId) =>
  api.get(`/auth/users/${userId}`).then(r => r.data);

export const fetchSettings = () => api.get('/settings').then(r => r.data);

export const updateSettings = (settings) => api.put('/settings', settings).then(r => r.data);

export const sendHelpMessage = (message, authToken) =>
  api.post('/settings/help', { message }, authToken ? {
    headers: { Authorization: `Bearer ${authToken}` },
  } : undefined).then(r => r.data);

export const blockUser = (userId) =>
  api.post(`/settings/block/${userId}`).then(r => r.data);

export const unblockUser = (userId) =>
  api.delete(`/settings/block/${userId}`).then(r => r.data);
