import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { initSocket, disconnectSocket } from '../socket';
import { clearStoredToken, getStoredToken, setStoredToken } from '../utils/token';
import { setNotificationSoundEnabled } from '../utils/notifications';
import { api, setApiAuthToken } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => getStoredToken());

  const logout = useCallback(() => {
    clearStoredToken();
    delete axios.defaults.headers.common['Authorization'];
    setApiAuthToken(null);
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  const fetchMe = useCallback(async (authToken) => {
    try {
      if (authToken) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        setApiAuthToken(authToken);
      }
      const res = await api.get('/auth/me');
      const me = res.data.user;
      setUser(me);
      if (me?.notification_sound !== undefined) {
        setNotificationSoundEnabled(me.notification_sound !== false);
      }
      initSocket(authToken);
    } catch (err) {
      // If we fail to fetch the current user (invalid token), ensure we log out locally
      logout();
    } finally {
      // Always clear loading so UI can proceed
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      // No token available — ensure loading is cleared
      setLoading(false);
    }
  }, [token, fetchMe]);

  const login = async (email, password, profileData = {}) => {
    const res = await api.post('/auth/login', { email, password, ...profileData });
    const { user, token: t } = res.data;
    setStoredToken(t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setApiAuthToken(t);
    setToken(t);
    setUser(user);
    initSocket(t);
    return user;
  };

  const register = async (username, email, password, profileData = {}) => {
    const res = await api.post('/auth/register', { username, email, password, ...profileData });
    const { user, token: t } = res.data;
    setStoredToken(t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setApiAuthToken(t);
    setToken(t);
    setUser(user);
    initSocket(t);
    return user;
  };

  const loginWithToken = useCallback((userData, t) => {
    setStoredToken(t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setApiAuthToken(t);
    setToken(t);
    setUser(userData);
    initSocket(t);
  }, []);

  const loginAsGuest = async (username, profile = {}) => {
    const res = await api.post('/auth/guest', { username, ...profile });
    const { user: u, token: t } = res.data;
    setStoredToken(t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setApiAuthToken(t);
    setToken(t);
    setUser(u);
    initSocket(t);
    return u;
  };

  // Previously logout was a simple function; keep it but ensure it's the same stable callback
  // exported above so other hooks can depend on it.

  const updateUser = (updated) => setUser((prev) => (prev ? { ...prev, ...updated } : updated));

  // Cross-tab logout sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'token' && e.newValue === null) logout();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [logout]);

  // Keep shared api client in sync if token was restored from storage on load
  useEffect(() => {
    if (token) setApiAuthToken(token);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, loginWithToken, loginAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
