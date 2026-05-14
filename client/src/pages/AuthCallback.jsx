import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clearStoredToken } from '../utils/token';
import axios from 'axios';

const SERVER = import.meta.env.VITE_SERVER_URL || '';

export default function AuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserFromCookie = async () => {
      try {
        // Exchange short-lived httpOnly cookie for token + user
        const res = await axios.get(`${SERVER}/api/auth/oauth-token`, { withCredentials: true });
        const { user, token } = res.data;
        // Let loginWithToken be the single source of truth for storing token and headers
        loginWithToken(user, token);

        const u = user || {};
        const needsProfile = (u.age === null || u.age === undefined || u.country === null || u.country === undefined || !u.gender || u.gender === 'other') && !u.isGuest;
        if (needsProfile) {
          navigate('/profile?setup=1');
        } else {
          navigate('/');
        }
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
  // loginWithToken is stable from AuthContext; include navigate as dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginWithToken, navigate]);

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'var(--text2)' }}>
      Signing you in...
    </div>
  );
}
