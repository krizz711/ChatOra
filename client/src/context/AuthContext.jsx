import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { initSocket, disconnectSocket } from '../socket';

const AuthContext = createContext(null);

const SERVER = import.meta.env.VITE_SERVER_URL || '';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchMe();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchMe = async () => {
    try {
      const res = await axios.get(`${SERVER}/api/auth/me`);
      setUser(res.data.user);
      initSocket(token);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, profileData = {}) => {
    const res = await axios.post(`${SERVER}/api/auth/login`, { email, password, ...profileData });
    const { user, token: t } = res.data;
    localStorage.setItem('token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(user);
    initSocket(t);
    return user;
  };

  const register = async (username, email, password, profileData = {}) => {
    const res = await axios.post(`${SERVER}/api/auth/register`, { username, email, password, ...profileData });
    const { user, token: t } = res.data;
    localStorage.setItem('token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(user);
    initSocket(t);
    return user;
  };

  const loginWithToken = (userData, t) => {
    localStorage.setItem('token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(userData);
    initSocket(t);
  };

  const loginAsGuest = async (username) => {
    const res = await axios.post(`${SERVER}/api/auth/guest`, { username });
    const { user: u, token: t } = res.data;
    localStorage.setItem('token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(u);
    initSocket(t);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    disconnectSocket();
  };

  const updateUser = (updated) => setUser(updated);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, loginWithToken, loginAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
