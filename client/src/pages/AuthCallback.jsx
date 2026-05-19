import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clearStoredToken } from '../utils/token';
import { api } from '../utils/api';

export default function AuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserFromCookie = async () => {
      try {
        const res = await api.get('/auth/oauth-token', { withCredentials: true });
        const { user, token } = res.data;
        loginWithToken(user, token);
        navigate('/');
      } catch (err) {
        clearStoredToken();
        navigate('/login?error=auth_failed');
      }
    };

    try {
      fetchUserFromCookie();
    } catch (err) {
      navigate('/login?error=auth_failed');
    }
  }, [loginWithToken, navigate]);

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'var(--text2)'
    }}>
      Signing you in...
    </div>
  );
}
