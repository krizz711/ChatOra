import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const SERVER = import.meta.env.VITE_SERVER_URL || '';

export default function AuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      navigate('/login?error=no_token');
      return;
    }

    const fetchUser = async () => {
      try {
        localStorage.setItem('token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const res = await axios.get(`${SERVER}/api/auth/me`);
        loginWithToken(res.data.user, token);
        navigate('/');
      } catch {
        localStorage.removeItem('token');
        navigate('/login?error=auth_failed');
      }
    };

    fetchUser();
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'var(--text2)' }}>
      Signing you in...
    </div>
  );
}
